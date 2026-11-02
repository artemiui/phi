import { randomUUID } from 'node:crypto';

export const mediaTypes=['movie','anime','game','manga','light novel','book','other'];
function invalid(message){throw Object.assign(new Error(message),{status:400});}
export function validMedia(input,previous={}){
  if(!input||typeof input!=='object'||Array.isArray(input))invalid('Invalid media entry.');
  const result={};
  for(const [key,value] of Object.entries(input)){
    if(key==='id')continue;
    if(typeof value!=='string'||value.length>10000||key.length>80)invalid('Media fields must be text under 10,000 characters.');
    if(['__proto__','constructor','prototype'].includes(key))invalid('Invalid media field.');
    if(value.trim())result[key]=value.trim();
  }
  if(!result.title||result.title.length>300)invalid('Add a title under 300 characters.');
  if(!mediaTypes.includes(result.type))invalid('Choose a media type.');
  if(result.rating&&(!/^\d(?:\.\d)?$/.test(result.rating)||Number(result.rating)<.5||Number(result.rating)>5||Number(result.rating)*2%1))invalid('Use a rating from 0.5 to 5 in half steps.');
  for(const field of ['started','completed'])if(result[field]&&result[field]!==previous[field]){
    const match=result[field].match(/^(\d{2})-(\d{2})-(\d{4})$/);
    const date=match&&new Date(`${match[3]}-${match[2]}-${match[1]}T12:00:00Z`);
    if(!match||!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==`${match[3]}-${match[2]}-${match[1]}`)invalid('Use valid dates in DD-MM-YYYY format.');
  }
  if(result.cover_link){let url;try{url=new URL(result.cover_link);}catch{invalid('Use an HTTPS cover URL.');}if(url.protocol!=='https:'||url.username||url.password)invalid('Use an HTTPS cover URL.');}
  return result;
}
export function createMediaStore(db){
  db.exec('CREATE TABLE IF NOT EXISTS media_entries (id TEXT PRIMARY KEY, value TEXT NOT NULL)');
  return {
    list:()=>db.prepare('SELECT id,value FROM media_entries').all().map(r=>({...JSON.parse(r.value),id:r.id})).sort((a,b)=>a.title.localeCompare(b.title,'en',{sensitivity:'base'})),
    get:id=>{const r=db.prepare('SELECT value FROM media_entries WHERE id=?').get(id);return r?{...JSON.parse(r.value),id}:null;},
    save:(input,id=randomUUID())=>{const row=db.prepare('SELECT value FROM media_entries WHERE id=?').get(id);const value=validMedia(input,row?JSON.parse(row.value):{});db.prepare('INSERT OR REPLACE INTO media_entries VALUES (?,?)').run(id,JSON.stringify(value));return {...value,id};},
    remove:id=>db.prepare('DELETE FROM media_entries WHERE id=?').run(id),
    replace:items=>{
      const values=items.map(item=>({id:randomUUID(),...validMedia(item)}));
      db.exec('SAVEPOINT media_import');try{db.exec('DELETE FROM media_entries');const stmt=db.prepare('INSERT INTO media_entries VALUES (?,?)');for(const {id,...value} of values)stmt.run(id,JSON.stringify(value));db.exec('RELEASE media_import');}catch(error){db.exec('ROLLBACK TO media_import; RELEASE media_import');throw error;}
    }
  };
}
