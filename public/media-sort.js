export function mediaDate(value=''){
  const match=value.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  const stamp=Date.parse(match?`${match[3]}-${match[2]}-${match[1]}`:value);
  return Number.isFinite(stamp)?stamp:0;
}
export function formatMediaDate(value=''){
  if(!value)return '';
  const match=value.match(/^(\d{2})-(\d{2})-(\d{4})$/),iso=value.match(/^\d{4}-\d{2}-\d{2}$/);
  if(!match&&!iso)return value;
  const normalized=match?`${match[3]}-${match[2]}-${match[1]}`:value;
  const date=new Date(normalized+'T12:00:00Z');
  if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==normalized)return value;
  return date.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric',timeZone:'UTC'});
}
export function latestMediaEntry(entries){
  const dated=entries.map(entry=>{
    const date=entry.completed||entry.started||'';
    const verb=entry.type==='game'?'played':['movie','anime'].includes(entry.type)?'watched':'read';
    return {...entry,date,verb,timestamp:mediaDate(date)};
  }).filter(entry=>entry.date&&formatMediaDate(entry.date)!==entry.date);
  dated.sort((a,b)=>b.timestamp-a.timestamp||a.title.localeCompare(b.title));
  return dated[0]||null;
}
export function sortMedia(entries,order='title-asc'){
  const title=(a,b)=>a.title.localeCompare(b.title,undefined,{sensitivity:'base'});
  return [...entries].sort((a,b)=>{
    if(order==='title-desc')return title(b,a);
    if(order==='rating-desc')return (Number(b.rating)||0)-(Number(a.rating)||0)||title(a,b);
    if(order==='rating-asc')return (a.rating?Number(a.rating):Infinity)-(b.rating?Number(b.rating):Infinity)||title(a,b);
    if(order==='completed-desc'||order==='started-desc'){const field=order.split('-')[0];return mediaDate(b[field])-mediaDate(a[field])||title(a,b);}
    return title(a,b);
  });
}
