export function calendarSource(value) {
  let url;
  try {url=new URL(String(value).trim().replace(/^webcal:/i,'https:'));}catch{throw new Error('Use a Google Calendar link or a direct HTTPS iCal/ICS feed URL.');}
  if(url.protocol!=='https:'||url.username||url.password||url.port)throw new Error('Calendar links must use HTTPS without embedded credentials or custom ports.');
  if(url.hostname==='calendar.google.com'&&url.pathname.startsWith('/calendar')&&!url.pathname.includes('/ical/')) {
    const ids=url.searchParams.getAll('src').filter(Boolean);
    if(!ids.length&&url.searchParams.get('cid')){
      const cid=url.searchParams.get('cid');
      try {ids.push(cid.includes('@')?cid:atob(cid.replaceAll('-','+').replaceAll('_','/')));}catch{throw new Error('Use the link from Google Calendar → Settings → Integrate calendar.');}
    }
    if(!ids.length||ids.length>10||ids.some(id=>id.length>500||/[\x00-\x1f]/.test(id)))throw new Error('Use a Google Calendar embed/share link that includes a calendar source.');
    return {kind:'google',ids,timeZone:url.searchParams.get('ctz')||''};
  }
  url.hash='';
  return {kind:'ics',url:url.href};
}

export function googleCalendarEmbed(sources,timeZone='UTC') {
  const ids=[...new Set(sources.filter(s=>s.kind==='google').flatMap(s=>s.ids))];
  if(!ids.length)return null;
  const url=new URL('https://calendar.google.com/calendar/embed');
  for(const id of ids)url.searchParams.append('src',id);
  url.searchParams.set('ctz',timeZone);url.searchParams.set('mode','AGENDA');
  url.searchParams.set('showTitle','0');url.searchParams.set('showPrint','0');
  return {src:url.href,count:ids.length,timeZone};
}
