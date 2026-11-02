import https from 'node:https';
import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';
import { Worker } from 'node:worker_threads';
import { calendarSource } from './public/calendar-links.js';

const blocked=new BlockList();
for(const [network,bits] of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.0.2.0',24],['192.168.0.0',16],['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',4],['240.0.0.0',4]])blocked.addSubnet(network,bits,'ipv4');
const globalV6=new BlockList();globalV6.addSubnet('2000::',3,'ipv6');
const blockedV6=new BlockList();blockedV6.addSubnet('2001:db8::',32,'ipv6');blockedV6.addSubnet('2001::',32,'ipv6');
export function publicAddress(address){const family=isIP(address);return family===4?!blocked.check(address,'ipv4'):family===6&&globalV6.check(address,'ipv6')&&!blockedV6.check(address,'ipv6');}

export async function fetchCalendarFeed(value,redirects=0){
  const parsed=calendarSource(value);if(parsed.kind!=='ics')throw new Error('Use a direct iCal/ICS feed link.');
  const url=new URL(parsed.url);const hostname=url.hostname.replace(/^\[|\]$/g,'');
  const addresses=isIP(hostname)?[{address:hostname,family:isIP(hostname)}]:await lookup(hostname,{all:true});
  if(!addresses.length||addresses.some(a=>!publicAddress(a.address)))throw new Error('Calendar feeds must be on a public HTTPS host.');
  const chosen=addresses.find(a=>a.family===4)||addresses[0];
  const result=await new Promise((resolve,reject)=>{
    const request=https.get(url,{agent:false,headers:{Accept:'text/calendar, text/plain','User-Agent':'Phi-local-calendar'},lookup:(_host,options,callback)=>options.all?callback(null,[chosen]):callback(null,chosen.address,chosen.family)},response=>{
      if([301,302,303,307,308].includes(response.statusCode)){response.resume();resolve({redirect:response.headers.location});return;}
      if(response.statusCode!==200){response.resume();reject(new Error('Calendar feed unavailable. Check its sharing settings and link.'));return;}
      const chunks=[];let size=0;
      response.on('data',chunk=>{size+=chunk.length;if(size>2_000_000){response.destroy();reject(new Error('Calendar feed exceeds the 2 MB limit.'));return;}chunks.push(chunk);});
      response.on('end',()=>resolve({text:Buffer.concat(chunks).toString('utf8')}));response.on('error',reject);
    });
    request.setTimeout(10000,()=>request.destroy(new Error('Calendar provider timed out. Try again later.')));request.on('error',reject);
  });
  if(result.redirect){if(redirects>=3)throw new Error('Calendar feed redirected too many times.');return fetchCalendarFeed(new URL(result.redirect,url).href,redirects+1);}
  return result.text;
}

export function parseCalendarInWorker(source,now=new Date()){
  return new Promise((resolve,reject)=>{
    const worker=new Worker(new URL('./calendar-parser.mjs',import.meta.url),{workerData:{source,now:now.toISOString()},resourceLimits:{maxOldGenerationSizeMb:64}});
    let settled=false;
    const done=(error,result)=>{if(settled)return;settled=true;clearTimeout(timer);worker.terminate();error?reject(error):resolve(result);};
    const timer=setTimeout(()=>done(new Error('Calendar processing timed out. Try a smaller feed.')),5000);
    worker.once('message',message=>done(message.error?new Error(message.error):null,message.result));worker.once('error',()=>done(new Error('Calendar processing failed. Try a smaller feed.')));worker.once('exit',code=>{if(!settled)done(new Error('Calendar processing stopped unexpectedly.'));});
  });
}
