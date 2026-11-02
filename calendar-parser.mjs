import ical from 'node-ical';
import { isMainThread, parentPort, workerData } from 'node:worker_threads';

const text=value=>String(value?.val??value?.value??value??'').slice(0,1000);
function dayString(date){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:date.tz||Intl.DateTimeFormat().resolvedOptions().timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);const get=type=>parts.find(p=>p.type===type).value;return `${get('year')}-${get('month')}-${get('day')}`;}
export async function parseAgenda(source,now=new Date()){
  if(!/^\uFEFF?\s*BEGIN:VCALENDAR/m.test(source))throw new Error('The link did not return an iCalendar feed.');
  const parsed=await ical.async.parseICS(source);const to=new Date(now.getTime()+30*86400000);const events=[];let skipped=0;
  for(const entry of Object.values(parsed)){
    if(entry?.type!=='VEVENT'||entry.status==='CANCELLED'||!(entry.start instanceof Date))continue;
    if(entry.rrule&&/FREQ=(SECONDLY|MINUTELY|HOURLY)|BYSECOND=|BYMINUTE=/i.test(entry.rrule.toString())){skipped++;continue;}
    for(const instance of ical.expandRecurringEvent(entry,{from:now,to,expandOngoing:true})){
      if(instance.event.status==='CANCELLED'||!Number.isFinite(instance.start.getTime()))continue;
      events.push({title:text(instance.summary)||'Untitled event',start:instance.start.toISOString(),end:instance.end?.toISOString()||instance.start.toISOString(),allDay:instance.isFullDay,date:instance.isFullDay?dayString(instance.start):'',location:text(instance.event.location),recurring:instance.isRecurring});
      if(events.length>2000)break;
    }
    if(events.length>2000)break;
  }
  events.sort((a,b)=>a.start.localeCompare(b.start));
  return {events:events.slice(0,30),skipped,hasMore:events.length>30};
}
if(!isMainThread)parseAgenda(workerData.source,new Date(workerData.now)).then(result=>parentPort.postMessage({result}),()=>parentPort.postMessage({error:'Could not parse this calendar feed. Check that the link returns valid iCalendar data.'}));
