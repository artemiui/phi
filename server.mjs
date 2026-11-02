import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID, createHash } from 'node:crypto';
import { parseContributions, readVaultGraph } from './widgets.mjs';
import { calendarSource, googleCalendarEmbed } from './public/calendar-links.js';
import { fetchCalendarFeed, parseCalendarInWorker } from './calendar.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(process.env.PHI_DATA_DIR || path.join(root, 'data'));
mkdirSync(dataDir, { recursive: true });
const db = new DatabaseSync(path.join(dataDir, 'phi.sqlite'));
db.exec(`PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS config (id INTEGER PRIMARY KEY CHECK(id=1), value TEXT NOT NULL); CREATE TABLE IF NOT EXISTS posts (id TEXT PRIMARY KEY, value TEXT NOT NULL);`);
db.exec('CREATE TABLE IF NOT EXISTS widget_cache (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
const defaults = { appName: 'Phi', name: 'Your name', greetingName: 'there', handle: 'username', bio: '', location: '', website: '', avatar: '', banner: '', theme: 'dark', units: 'celsius', weatherEnabled: false, introEnabled: true, joined: new Date().toISOString() };
if (!db.prepare('SELECT id FROM config').get()) db.prepare('INSERT INTO config VALUES (1, ?)').run(JSON.stringify(defaults));
const widgetDefaults={githubPlacement:'timeline',obsidianPlacement:'timeline',calendarPlacement:'timeline',githubEnabled:false,githubUsername:'',obsidianEnabled:false,obsidianVault:'',calendarEnabled:false,calendarSources:[],calendarTitle:'Calendar',calendarTimezone:'UTC'};
const config = () => ({ ...defaults, ...widgetDefaults, ...JSON.parse(db.prepare('SELECT value FROM config WHERE id=1').get().value) });
const posts = () => db.prepare('SELECT value FROM posts').all().map(r => JSON.parse(r.value)).sort((a,b) => b.datetime.localeCompare(a.datetime));
function check(ok, message) { if (!ok) throw Object.assign(new Error(message), { status: 400 }); }
function str(value, max, label) { check(typeof value === 'string' && value.length <= max, `${label} is too long or invalid.`); return value.trim(); }
function image(value) {
  check(typeof value === 'string', 'Invalid image.');
  if (!value) return '';
  check(value.length <= 12_000_000 && /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(value), 'Use a PNG, JPEG, WebP, or GIF under 8 MB.');
  return value;
}
function validConfig(c) {
  const result = {};
  for (const [key, max] of Object.entries({ appName: 30, name: 60, greetingName: 40, handle: 30, bio: 240, location: 100, website: 200 })) result[key] = str(c[key] ?? defaults[key], max, key);
  check(result.name && result.greetingName && result.appName, 'App, profile, and greeting names are required.');
  check(/^[a-zA-Z0-9_]+$/.test(result.handle), 'Handle can contain letters, numbers, and underscores.');
  check(!result.website || /^https?:\/\//i.test(result.website), 'Website must start with https:// or http://.');
  for (const id of ['github','obsidian','calendar']) {
    const key=id+'Placement';
    result[key]=c[key]??'timeline';
    check(['timeline','sidebar'].includes(result[key]), 'Choose timeline or right sidebar for widget placement.');
  }
  const githubUsername=str(c.githubUsername||'',39,'GitHub username');
  check(!githubUsername||/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(githubUsername),'Enter a valid GitHub username.');
  const obsidianVault=str(c.obsidianVault||'',1000,'Vault path');
  check(!c.githubEnabled||githubUsername,'Add a GitHub username to enable the widget.');
  check(!c.obsidianEnabled||(path.isAbsolute(obsidianVault)&&!/^\\\\/.test(obsidianVault)),'Add an absolute local vault folder path.');
  const calendarSources=c.calendarSources??[];
  check(Array.isArray(calendarSources)&&calendarSources.length<=5,'Add up to five calendar links.');
  const calendarLinks=calendarSources.map(source=>{const link=str(source,2048,'Calendar link');try{calendarSource(link);}catch(error){check(false,error.message);}return link;});
  check(!c.calendarEnabled||calendarLinks.length,'Add a calendar link to enable the widget.');
  const calendarTitle=str(c.calendarTitle||'Calendar',60,'Calendar title');
  const calendarTimezone=str(c.calendarTimezone||'UTC',80,'Calendar time zone');
  try{new Intl.DateTimeFormat('en',{timeZone:calendarTimezone});}catch{check(false,'Enter a valid IANA time zone, such as UTC.');}
  return { ...result, githubUsername,githubEnabled:c.githubEnabled===true,obsidianVault,obsidianEnabled:c.obsidianEnabled===true, calendarSources:calendarLinks,calendarEnabled:c.calendarEnabled===true,calendarTitle,calendarTimezone, avatar: image(c.avatar || ''), banner: image(c.banner || ''), theme: c.theme === 'light' ? 'light' : 'dark', units: c.units === 'fahrenheit' ? 'fahrenheit' : 'celsius', weatherEnabled: c.weatherEnabled === true, introEnabled: c.introEnabled !== false, joined: config().joined };
}
function validPost(p) {
  const content = str(p.content || '', 5000, 'Post');
  check(Array.isArray(p.images) && p.images.length <= 4, 'Choose up to four images.');
  const images = p.images.map(image); check(content || images.length, 'Write something or add an image.');
  const datetime = new Date(p.datetime); check(Number.isFinite(datetime.getTime()), 'Choose a valid date and time.');
  return { content, images, location: str(p.location || '', 150, 'Location'), datetime: datetime.toISOString(), alt: str(p.alt || '', 500, 'Image description') };
}
async function body(req) {
  let size = 0; const chunks = [];
  for await (const chunk of req) { size += chunk.length; if (size > 55_000_000) throw Object.assign(new Error('Request exceeds 55 MB.'), { status: 413 }); chunks.push(chunk); }
  try { return JSON.parse(Buffer.concat(chunks).toString()); } catch { throw Object.assign(new Error('Invalid JSON.'), {status:400}); }
}
const mime = { '.html':'text/html; charset=utf-8', '.css':'text/css', '.js':'text/javascript', '.mjs':'text/javascript', '.svg':'image/svg+xml', '.woff2':'font/woff2', '.woff':'font/woff', '.ttf':'font/ttf' };
let githubPending=null,graphPending=null;
const calendarPending=new Map();
async function calendarFeed(source,refresh){
  const key='calendar:'+createHash('sha256').update(source).digest('hex');
  const row=db.prepare('SELECT value FROM widget_cache WHERE key=?').get(key);const cached=row?JSON.parse(row.value):null;
  if(cached&&Date.now()-cached.fetchedAt<(refresh?60000:900000))return {...cached,cached:true};
  try{
    if(!calendarPending.has(key)){
      const promise=(async()=>{const text=await fetchCalendarFeed(source);const result={...await parseCalendarInWorker(text),fetchedAt:Date.now()};db.prepare('INSERT OR REPLACE INTO widget_cache VALUES (?,?)').run(key,JSON.stringify(result));return result;})();
      calendarPending.set(key,promise);promise.finally(()=>calendarPending.delete(key)).catch(()=>{});
    }
    return await calendarPending.get(key);
  }catch{if(cached)return {...cached,cached:true,stale:true};throw new Error('Could not read this feed. Check its iCal link, sharing settings, and internet connection.');}
}
export const server = http.createServer(async (req, res) => {
  const send = (status, value) => { res.writeHead(status, { 'Content-Type':'application/json', 'Cache-Control':'no-store' }); res.end(JSON.stringify(value)); };
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; font-src 'self'; connect-src 'self' https://api.open-meteo.com; frame-src https://www.youtube-nocookie.com https://open.spotify.com https://player.vimeo.com https://w.soundcloud.com https://calendar.google.com; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
  try {
    const host = req.headers.host || '';
    if (!/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host)) return send(403, {error:'Phi only accepts localhost requests.'});
    if (req.headers.origin && req.headers.origin !== `http://${host}`) return send(403, {error:'Cross-origin requests are blocked.'});
    const url = new URL(req.url, `http://${host}`);
    if (url.pathname === '/api/state' && req.method === 'GET') return send(200, { config: config(), posts: posts() });
    if(url.pathname==='/api/calendar'&&req.method==='GET'){
      const c=config();if(!c.calendarEnabled)return send(200,{disabled:true});
      const sources=c.calendarSources.map(calendarSource);const feeds=sources.filter(s=>s.kind==='ics');
      const results=await Promise.allSettled(feeds.map(feed=>calendarFeed(feed.url,url.searchParams.has('refresh'))));
      const events=[],warnings=[];let stale=false;
      results.forEach((result,i)=>{if(result.status==='fulfilled'){events.push(...result.value.events.map(event=>({...event,feed:i+1})));if(result.value.stale){stale=true;warnings.push(`Feed ${i+1}: saved events shown while offline.`);}if(result.value.skipped)warnings.push(`Feed ${i+1}: high-frequency recurrence rules were omitted.`);}else warnings.push(`Feed ${i+1}: ${result.reason.message}`);});
      events.sort((a,b)=>a.start.localeCompare(b.start));
      return send(200,{google:googleCalendarEmbed(sources,c.calendarTimezone),events:events.filter(e=>new Date(e.end)>=new Date()).slice(0,30),warnings,stale,feedCount:feeds.length,timeZone:c.calendarTimezone,updatedAt:Date.now()});
    }
    if (url.pathname === '/api/github' && req.method === 'GET') {
      const c=config();if(!c.githubEnabled)return send(200,{disabled:true});
      const key='github:'+c.githubUsername.toLowerCase();
      const row=db.prepare('SELECT value FROM widget_cache WHERE key=?').get(key);const cached=row?JSON.parse(row.value):null;
      if(cached&&Date.now()-cached.fetchedAt<(url.searchParams.has('refresh')?60000:3600000))return send(200,{...cached,cached:true});
      try {
        if(!githubPending||githubPending.key!==key){const promise=(async()=>{const response=await fetch(`https://github.com/users/${encodeURIComponent(c.githubUsername)}/contributions`,{headers:{Accept:'text/html','User-Agent':'Phi-local-timeline'},signal:AbortSignal.timeout(12000),redirect:'error'});if(!response.ok)throw new Error(response.status===404?'GitHub user not found.':'GitHub is unavailable. Try later.');const html=await response.text();if(html.length>3000000)throw new Error('GitHub response was too large.');const result={...parseContributions(html),username:c.githubUsername,fetchedAt:Date.now()};db.prepare('INSERT OR REPLACE INTO widget_cache VALUES (?,?)').run(key,JSON.stringify(result));return result})();githubPending={key,promise};promise.finally(()=>{if(githubPending?.promise===promise)githubPending=null}).catch(()=>{})}
        return send(200,await githubPending.promise);
      }catch(e){return cached?send(200,{...cached,cached:true,stale:true}):send(502,{error:e.message.includes('GitHub')?e.message:'Could not reach GitHub. Try again when online.'})}
    }
    if(url.pathname==='/api/obsidian-graph'&&req.method==='GET'){
      const c=config();if(!c.obsidianEnabled)return send(200,{disabled:true});
      try{if(!graphPending||graphPending.path!==c.obsidianVault){const promise=readVaultGraph(c.obsidianVault);graphPending={path:c.obsidianVault,promise};promise.finally(()=>{if(graphPending?.promise===promise)graphPending=null}).catch(()=>{})}return send(200,await graphPending.promise)}catch(e){return send(400,{error:e.message})}
    }
    if (url.pathname === '/api/config' && req.method === 'PUT') { const c = validConfig(await body(req)); db.prepare('UPDATE config SET value=? WHERE id=1').run(JSON.stringify(c)); return send(200, c); }
    if (url.pathname === '/api/posts' && req.method === 'POST') { const p = {...validPost(await body(req)), id:randomUUID(), createdAt:new Date().toISOString()}; db.prepare('INSERT INTO posts VALUES (?,?)').run(p.id,JSON.stringify(p)); return send(201,p); }
    const match = url.pathname.match(/^\/api\/posts\/([a-f0-9-]+)$/);
    if (match && ['PUT','DELETE'].includes(req.method)) {
      const row = db.prepare('SELECT value FROM posts WHERE id=?').get(match[1]); if (!row) return send(404,{error:'Post not found.'});
      if (req.method === 'DELETE') { db.prepare('DELETE FROM posts WHERE id=?').run(match[1]); return send(200,{ok:true}); }
      const p = {...JSON.parse(row.value), ...validPost(await body(req))}; db.prepare('UPDATE posts SET value=? WHERE id=?').run(JSON.stringify(p),match[1]); return send(200,p);
    }
    if (url.pathname === '/api/export' && req.method === 'GET') { res.setHeader('Content-Disposition','attachment; filename="phi-backup.json"'); return send(200,{version:1,exportedAt:new Date().toISOString(),config:config(),posts:posts()}); }
    if (url.pathname === '/api/import' && req.method === 'POST') {
      const b = await body(req); check(b.version===1 && Array.isArray(b.posts) && b.posts.length<=10000,'Invalid Phi backup.');
      const c = validConfig(b.config || {}); if (b.config?.joined && Number.isFinite(new Date(b.config.joined).getTime())) c.joined=new Date(b.config.joined).toISOString(); const incoming = b.posts.map(p => ({...validPost(p),id:randomUUID(),createdAt:new Date().toISOString()}));
      db.exec('BEGIN'); try { db.prepare('UPDATE config SET value=? WHERE id=1').run(JSON.stringify(c)); db.exec('DELETE FROM posts'); const stmt=db.prepare('INSERT INTO posts VALUES (?,?)'); for (const p of incoming) stmt.run(p.id,JSON.stringify(p)); db.exec('COMMIT'); } catch(e) { db.exec('ROLLBACK'); throw e; }
      return send(200,{ok:true});
    }
    if (url.pathname.startsWith('/api/')) return send(404,{error:'Not found.'});
    if (req.method !== 'GET') return send(405,{error:'Method not allowed.'});
    const requested = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
    const filename=path.resolve(root,'public',requested);
    if (!filename.startsWith(path.join(root,'public')+path.sep) || !existsSync(filename)) return send(404,{error:'Not found.'});
    res.writeHead(200,{'Content-Type':mime[path.extname(filename)] || 'application/octet-stream','Cache-Control':'no-cache'}); res.end(readFileSync(filename));
  } catch(e) { if (!e.status) console.error(e); send(e.status || 500,{error:e.status?e.message:'Something went wrong. Please try again.'}); }
});
if (process.argv[1] === fileURLToPath(import.meta.url)) server.listen(Number(process.env.PORT || 3000),'127.0.0.1',() => console.log(`Phi is ready at http://localhost:${server.address().port}`));
