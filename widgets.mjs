import { readdir, readFile, lstat, realpath } from 'node:fs/promises';
import path from 'node:path';

export function parseContributions(html) {
  const counts=new Map();
  for(const match of html.matchAll(/<tool-tip\b([^>]*)>([\s\S]*?)<\/tool-tip>/g)) {
    const id=match[1].match(/\bfor="([^"]+)"/)?.[1];
    const text=match[2].replace(/<[^>]*>/g,'').trim();
    const count=text.match(/^([\d,]+) contributions?/i);
    if(id)counts.set(id,count?Number(count[1].replaceAll(',','')):0);
  }
  const days=[];
  for(const match of html.matchAll(/<(?:td|rect)\b([^>]*\bdata-date="\d{4}-\d{2}-\d{2}"[^>]*)>/g)) {
    const attributes=match[1];
    const date=attributes.match(/\bdata-date="([^"]+)"/)?.[1];
    const level=Number(attributes.match(/\bdata-level="([0-4])"/)?.[1] || 0);
    const id=attributes.match(/\bid="([^"]+)"/)?.[1];
    if(date)days.push({date,level,count:counts.get(id)??null});
  }
  if(days.length<7)throw new Error('GitHub’s calendar format was not recognized. Try refreshing later.');
  days.sort((a,b)=>a.date.localeCompare(b.date));
  return { days, total:days.reduce((n,d)=>n+(d.count||0),0) };
}

export async function readVaultGraph(vaultDirectory) {
  if(!path.isAbsolute(vaultDirectory)||/^\\\\/.test(vaultDirectory))throw new Error('Choose an absolute local vault folder path.');
  let root;
  try { root=await realpath(vaultDirectory); if(!(await lstat(root)).isDirectory())throw new Error(); }
  catch {throw new Error('Vault folder not found. Check its path in Settings.');}
  const files=[];let truncated=false;
  async function walk(dir) {
    const entries=await readdir(dir,{withFileTypes:true});
    entries.sort((a,b)=>a.name.localeCompare(b.name));
    for(const entry of entries) {
      if(entry.name.startsWith('.')||entry.name==='node_modules'||entry.isSymbolicLink())continue;
      if(files.length>=3000){truncated=true;return;}
      const absolute=path.join(dir,entry.name);
      if(entry.isDirectory())await walk(absolute);
      else if(entry.isFile()&&entry.name.toLowerCase().endsWith('.md'))files.push(absolute);
    }
  }
  await walk(root);
  const nodes=files.map(absolute=>{const relative=path.relative(root,absolute).replaceAll('\\','/');return {id:relative,label:path.basename(relative,'.md'),uri:'obsidian://open?path='+encodeURIComponent(absolute)}});
  const byPath=new Map(nodes.map(n=>[n.id.toLowerCase().replace(/\.md$/,''),n.id]));
  const basenames=new Map();
  for(const n of nodes){const key=n.label.toLowerCase();const list=basenames.get(key)||[];list.push(n.id);basenames.set(key,list)}
  function resolveLink(raw,from) {
    let target=raw.split('|')[0].split('#')[0].trim();
    try {target=decodeURIComponent(target)} catch {return null}
    if(!target||/^[a-z]+:/i.test(target))return null;
    target=target.replace(/\\/g,'/').replace(/\.md$/i,'').toLowerCase();
    const relative=path.posix.normalize(path.posix.join(path.posix.dirname(from.toLowerCase()),target));
    const exact=byPath.get(relative)||byPath.get(target.replace(/^\//,''));
    if(exact)return exact;
    const base=basenames.get(path.posix.basename(target));
    if(base?.length===1)return base[0];
    const suffix=[...byPath.entries()].filter(([key])=>key.endsWith('/'+target));
    return suffix.length===1?suffix[0][1]:null;
  }
  const edges=new Map();let readBytes=0;let skipped=0;
  for(let i=0;i<files.length;i++) {
    const file=files[i];const stat=await lstat(file);
    if(stat.size>1_000_000||readBytes+stat.size>24_000_000){skipped++;continue}
    readBytes+=stat.size;
    let content;
    try {content=await readFile(file,'utf8')}catch{skipped++;continue}
    content=content.replace(/```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]+`/g,'');
    const links=[...content.matchAll(/\[\[([^\]\n]+)\]\]/g)].map(m=>m[1]);
    for(const m of content.matchAll(/\]\(<?([^\s)>]+)>?(?:\s+"[^"]*")?\)/g))links.push(m[1]);
    for(const link of links){const target=resolveLink(link,nodes[i].id);if(target&&target!==nodes[i].id){const pair=[nodes[i].id,target].sort();edges.set(pair.join('\0'),{source:pair[0],target:pair[1]})}}
  }
  const allEdges=[...edges.values()];const degree=new Map(nodes.map(n=>[n.id,0]));
  for(const e of allEdges){degree.set(e.source,degree.get(e.source)+1);degree.set(e.target,degree.get(e.target)+1)}
  const visible=nodes.sort((a,b)=>degree.get(b.id)-degree.get(a.id)||a.id.localeCompare(b.id)).slice(0,160);
  const ids=new Set(visible.map(n=>n.id));
  return { vaultName:path.basename(root),totalNotes:nodes.length,totalLinks:allEdges.length,nodes:visible.map(n=>({...n,degree:degree.get(n.id)})),edges:allEdges.filter(e=>ids.has(e.source)&&ids.has(e.target)),truncated:truncated||visible.length<nodes.length,skipped,updatedAt:new Date().toISOString() };
}
