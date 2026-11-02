export function mediaDate(value=''){
  const match=value.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  const stamp=Date.parse(match?`${match[3]}-${match[2]}-${match[1]}`:value);
  return Number.isFinite(stamp)?stamp:0;
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
