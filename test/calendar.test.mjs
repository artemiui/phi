import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calendarSource, googleCalendarEmbed } from '../public/calendar-links.js';
import { publicAddress, fetchCalendarFeed, parseCalendarInWorker } from '../calendar.mjs';
import { parseAgenda } from '../calendar-parser.mjs';

test('Google Calendar links combine sources and preserve an explicit time zone',()=>{
  const sources=['https://calendar.google.com/calendar/embed?src=one%40example.com&ctz=Asia%2FManila','https://calendar.google.com/calendar/embed?src=two%40group.calendar.google.com'].map(calendarSource);
  const embed=googleCalendarEmbed(sources,'Asia/Manila');const url=new URL(embed.src);
  assert.equal(url.origin,'https://calendar.google.com');assert.deepEqual(url.searchParams.getAll('src'),['one@example.com','two@group.calendar.google.com']);assert.equal(url.searchParams.get('ctz'),'Asia/Manila');assert.equal(embed.count,2);
  assert.equal(calendarSource('webcal://example.com/feed.ics').url,'https://example.com/feed.ics');
  assert.throws(()=>calendarSource('javascript:alert(1)'),/HTTPS/);
  assert.throws(()=>calendarSource('https://user:pass@example.com/calendar.ics'),/credentials/);
  assert.throws(()=>calendarSource('https://calendar.google.com/calendar/u/0/r'),/source/);
});

test('calendar feeds reject local/private addresses before making an HTTP request',async()=>{
  for(const address of ['127.0.0.1','10.0.0.2','192.168.1.1','169.254.169.254','100.64.0.1','::1','::ffff:127.0.0.1','fc00::1','2001:db8::1'])assert.equal(publicAddress(address),false,address);
  assert.equal(publicAddress('8.8.8.8'),true);assert.equal(publicAddress('2606:4700:4700::1111'),true);
  await assert.rejects(fetchCalendarFeed('https://127.0.0.1/private.ics'),/public HTTPS/);
});

const fixture=String.raw`BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:recurring
DTSTART;TZID=Asia/Manila:20261102T100000
DTEND;TZID=Asia/Manila:20261102T110000
RRULE:FREQ=DAILY;COUNT=3
EXDATE;TZID=Asia/Manila:20261103T100000
SUMMARY:Study\, then rest
END:VEVENT
BEGIN:VEVENT
UID:all-day
DTSTART;VALUE=DATE:20261103
DTEND;VALUE=DATE:20261104
SUMMARY:All-day event
END:VEVENT
BEGIN:VEVENT
UID:cancelled
DTSTART:20261104T100000Z
DTEND:20261104T110000Z
STATUS:CANCELLED
SUMMARY:Should not appear
END:VEVENT
END:VCALENDAR`;

test('calendar agenda expands recurrences, exclusions, time zones, and all-day events',async()=>{
  const result=await parseAgenda(fixture,new Date('2026-11-02T00:00:00Z'));
  assert.equal(result.events.length,3);assert.equal(result.events[0].start,'2026-11-02T02:00:00.000Z');assert.equal(result.events[0].title,'Study, then rest');assert.equal(result.events[1].allDay,true);assert.equal(result.events[1].date,'2026-11-03');assert.equal(result.events[2].start,'2026-11-04T02:00:00.000Z');
  const worker=await parseCalendarInWorker(fixture,new Date('2026-11-02T00:00:00Z'));assert.deepEqual(worker.events,result.events);
  await assert.rejects(parseAgenda('<html>Login page</html>'),/iCalendar/);
});
