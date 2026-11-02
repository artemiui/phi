const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let activeKey='',configuration=null;
const sidebarScreen=window.matchMedia('(min-width: 1181px)');
sidebarScreen.addEventListener('change',placeWidgets);
function placeWidgets(){
  if(!configuration)return;
  const timeline=document.querySelector('#timeline-widgets'),sidebar=document.querySelector('#sidebar-widgets');
  for(const id of ['calendar','github','obsidian']){
    const widget=document.querySelector('#'+id+'-widget');
    if(widget)(sidebarScreen.matches&&configuration[id+'Placement']==='sidebar'?sidebar:timeline).append(widget);
  }
  timeline.hidden=!timeline.children.length;
  sidebar.hidden=!sidebar.children.length;
}
const refreshGlyph='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 7v5h-5M20 12a8 8 0 1 0-2 6"/></svg>';
export function configureWidgets(config) {
  configuration=config;
  const key=JSON.stringify([config.githubEnabled,config.githubUsername,config.obsidianEnabled,config.obsidianVault,config.calendarEnabled,config.calendarSources,config.calendarTitle,config.calendarTimezone]);
  if(key===activeKey){placeWidgets();return;}
  activeKey=key;
  const root=document.querySelector('#timeline-widgets');
  document.querySelector('#sidebar-widgets').replaceChildren();
  root.innerHTML=`${config.calendarEnabled?widgetShell('calendar',config.calendarTitle||'Calendar',config.calendarTimezone||'UTC'):''}${config.githubEnabled?widgetShell('github','GitHub contributions','@'+config.githubUsername):''}${config.obsidianEnabled?widgetShell('obsidian','Your connected thoughts','Obsidian graph'):''}`;
  placeWidgets();
  if(config.calendarEnabled)loadWidget('calendar',key);
  if(config.githubEnabled)loadWidget('github',key);
  if(config.obsidianEnabled)loadWidget('obsidian',key);
}
function widgetShell(id,title,subtitle){return `<details class="timeline-widget" id="${id}-widget" open><summary><div><h2>${escape(title)}</h2><span>${escape(subtitle)}</span></div><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="m8 10 4 4 4-4"/></svg></summary><div class="widget-content" id="${id}-widget-content"><p class="widget-state">${loadingMessage(id)}</p></div></details>`}
const loadingMessage=id=>id==='github'?'Fetching public contributions…':id==='calendar'?'Reading your calendar sources…':'Reading local note links…';
async function loadWidget(id,key,refresh=false){
  const target=document.querySelector('#'+id+'-widget-content');if(!target)return;
  target.innerHTML='<p class="widget-state">'+loadingMessage(id)+'</p>';
  try{
    const response=await fetch('/api/'+(id==='obsidian'?'obsidian-graph':id)+(refresh?'?refresh=1':''));
    const data=await response.json();
    if(key!==activeKey)return;
    if(!response.ok)throw new Error(data.error||'Widget unavailable. Try again.');
    if(data.disabled){target.innerHTML='<p class="widget-state">Disabled in Settings.</p>';return}
    if(id==='github')renderGithub(target,data);else if(id==='calendar')renderCalendar(target,data);else renderGraph(target,data);
  }catch(error){if(key===activeKey)target.innerHTML=`<p class="widget-state">${escape(error.message)}</p><button type="button" class="text-button" data-refresh-widget="${id}">Try again</button>`}
}
function renderGithub(root,data){
  const days=data.days;const first=new Date(days[0].date+'T12:00:00Z');const offset=first.getUTCDay();const weeks=Math.ceil((days.length+offset)/7);
  const width=weeks*10+4;let months='';let previous='';
  const cells=days.map((d,i)=>{const date=new Date(d.date+'T12:00:00Z');const week=Math.floor((i+offset)/7);const day=(i+offset)%7;const month=date.toLocaleDateString(undefined,{month:'short',timeZone:'UTC'});if(month!==previous&&day===0){months+=`<text x="${week*10}" y="10">${escape(month)}</text>`;previous=month}return `<rect x="${week*10}" y="${19+day*10}" width="7" height="7" rx="1.4" class="contribution level-${d.level}" data-day="${i}"><title>${d.date}: ${d.count===null?'activity level '+d.level:d.count+' contributions'}</title></rect>`}).join('');
  root.innerHTML=`<div class="heatmap-scroll"><svg class="heatmap" viewBox="0 0 ${width} 90" role="img" tabindex="0" aria-label="GitHub contributions for ${escape(data.username)}. Use arrow keys to explore daily counts." aria-describedby="github-day-info">${months}${cells}</svg></div><div class="heatmap-info"><span id="github-day-info" aria-live="polite">${data.total.toLocaleString()} contributions in the last year</span><span class="heatmap-legend" aria-label="Darker to lighter means fewer to more contributions">Less ${[0,1,2,3,4].map(n=>`<i class="level-${n}"></i>`).join('')} More</span></div><div class="widget-footer"><span>${data.stale?'Offline · saved calendar':data.cached?'Saved calendar':'Updated from GitHub'} · ${new Date(data.fetchedAt).toLocaleDateString()}</span><button type="button" class="icon-button" data-refresh-widget="github" aria-label="Refresh GitHub contributions">${refreshGlyph}</button></div>`;
  let selected=days.length-1;
  const select=index=>{selected=Math.max(0,Math.min(days.length-1,index));const d=days[selected];root.querySelector('#github-day-info').textContent=`${new Date(d.date+'T12:00:00Z').toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'})}: ${d.count===null?'activity level '+d.level:d.count+' contributions'}`;root.querySelectorAll('.contribution.selected').forEach(e=>e.classList.remove('selected'));root.querySelector(`[data-day="${selected}"]`).classList.add('selected')};
  const svg=root.querySelector('svg.heatmap');
  for(const event of ['pointerover','click'])svg.addEventListener(event,e=>{if(e.target.dataset.day!==undefined)select(Number(e.target.dataset.day))});
  svg.addEventListener('focus',()=>select(selected));
  svg.addEventListener('keydown',e=>{const delta={ArrowLeft:-7,ArrowRight:7,ArrowUp:-1,ArrowDown:1};if(e.key in delta){e.preventDefault();select(selected+delta[e.key])}else if(e.key==='Home'||e.key==='End'){e.preventDefault();select(e.key==='Home'?0:days.length-1)}});
}
function layoutGraph(nodes,edges){
  const n=nodes.length;const positions=nodes.map((node,i)=>{const angle=i*2.399963229728653;const radius=25+Math.sqrt(i/Math.max(1,n))*100;return {...node,x:260+Math.cos(angle)*radius*1.8,y:145+Math.sin(angle)*radius,vx:0,vy:0}});
  const byId=new Map(positions.map(p=>[p.id,p]));
  for(let t=0;t<180;t++){
    for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){const a=positions[i],b=positions[j];const dx=a.x-b.x,dy=a.y-b.y;const d2=Math.max(25,dx*dx+dy*dy);const force=140/d2;const fx=dx*force,fy=dy*force;a.vx+=fx;a.vy+=fy;b.vx-=fx;b.vy-=fy}
    for(const edge of edges){const a=byId.get(edge.source),b=byId.get(edge.target);if(!a||!b)continue;const dx=b.x-a.x,dy=b.y-a.y;const distance=Math.max(1,Math.hypot(dx,dy));const f=(distance-45)*.006;a.vx+=dx/distance*f;a.vy+=dy/distance*f;b.vx-=dx/distance*f;b.vy-=dy/distance*f}
    for(const p of positions){p.vx+=(260-p.x)*.006;p.vy+=(145-p.y)*.006;p.vx*=.75;p.vy*=.75;p.x+=Math.max(-8,Math.min(8,p.vx));p.y+=Math.max(-8,Math.min(8,p.vy))}
  }
  // Fit the settled graph once, rather than pinning repelled notes to a box edge.
  const minX=Math.min(...positions.map(p=>p.x)),maxX=Math.max(...positions.map(p=>p.x));
  const minY=Math.min(...positions.map(p=>p.y)),maxY=Math.max(...positions.map(p=>p.y));
  for(const p of positions){p.x=n===1?260:25+(p.x-minX)/Math.max(1,maxX-minX)*470;p.y=n===1?145:25+(p.y-minY)/Math.max(1,maxY-minY)*235}
  return {positions,byId};
}
function renderGraph(root,data){
  if(!data.nodes.length){root.innerHTML='<p class="widget-state">No Markdown notes found in this folder. Choose another vault in Settings.</p>';return}
  const {positions,byId}=layoutGraph(data.nodes,data.edges);
  const lines=data.edges.map(e=>{const a=byId.get(e.source),b=byId.get(e.target);return `<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}"/>`}).join('');
  const points=positions.map((p,i)=>`<a href="${escape(p.uri)}" aria-label="Open ${escape(p.label)} in Obsidian" data-graph-note="${i}"><title>${escape(p.id)} · ${p.degree} connections</title><circle class="graph-hit" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="12"/><circle class="graph-dot" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${Math.min(8,3+Math.sqrt(p.degree))}"/>${i<5?`<text x="${(p.x+10).toFixed(1)}" y="${(p.y+4).toFixed(1)}">${escape(p.label.slice(0,22))}${p.label.length>22?'…':''}</text>`:''}</a>`).join('');
  root.innerHTML=`<div class="graph-toolbar"><span>${escape(data.vaultName)}</span><span>${data.totalNotes} notes · ${data.totalLinks} links</span></div><svg class="obsidian-graph" viewBox="0 0 520 285" role="group" aria-label="Local Obsidian note graph">${lines}${points}</svg><p class="graph-note-info" aria-live="polite">Select a node to open its note in Obsidian.</p><details class="graph-note-list"><summary>Browse notes${data.truncated?' · showing '+data.nodes.length+' most connected':''}</summary><div>${data.nodes.map(p=>`<a href="${escape(p.uri)}">${escape(p.id)}</a>`).join('')}</div></details><div class="widget-footer">${data.skipped?`<span>${data.skipped} large/unreadable notes skipped</span>`:''}<a href="#settings">Configure</a><button type="button" class="icon-button" data-refresh-widget="obsidian" aria-label="Refresh Obsidian graph">${refreshGlyph}</button></div>`;
  for(const event of ['pointerover','focusin'])root.querySelector('.obsidian-graph').addEventListener(event,e=>{const link=e.target.closest('[data-graph-note]');if(link){const p=data.nodes[Number(link.dataset.graphNote)];root.querySelector('.graph-note-info').textContent=p.id+' · '+p.degree+' connections'}});
}
function renderCalendar(root,data){
  root.innerHTML=`${data.google?'<div class="google-calendar-slot"></div>':''}${data.feedCount?`<section class="calendar-agenda" aria-label="Upcoming events"><h3>Coming up</h3>${data.events.length?data.events.map(event=>{const date=new Date(event.allDay?event.date+'T12:00:00Z':event.start);const timeZone=event.allDay?'UTC':data.timeZone;return `<article class="agenda-event"><time class="agenda-date" datetime="${escape(event.start)}"><span>${date.toLocaleDateString(undefined,{month:'short',timeZone})}</span><strong>${date.toLocaleDateString(undefined,{day:'numeric',timeZone})}</strong></time><div><h4>${escape(event.title)}</h4><p>${event.allDay?'All day':date.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit',timeZone})}${event.location?' · '+escape(event.location):''}</p></div></article>`}).join(''):'<p class="widget-state">No upcoming events in the next 30 days.</p>'}</section>`:''}${data.warnings.map(warning=>`<p class="calendar-warning">${escape(warning)}</p>`).join('')}<div class="widget-footer"><a href="#settings">Configure</a><span>${escape(data.timeZone)}${data.stale?' · saved events':''}</span><button type="button" class="icon-button" data-refresh-widget="calendar" aria-label="Refresh calendar">${refreshGlyph}</button></div>`;
  if(data.google)renderGooglePlaceholder(root.querySelector('.google-calendar-slot'),data.google);
}
function renderGooglePlaceholder(slot,google){
  slot.innerHTML=`<div class="calendar-connect"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M4 5h16v16H4ZM8 2v6M16 2v6M4 11h16M8 15h2M14 15h2"/></svg><h3>Your calendars, together.</h3><p>${google.count} Google ${google.count===1?'calendar':'calendars'} · connects when loaded</p><button type="button" class="secondary" data-load-calendar>Load Google Calendar</button><a href="${escape(google.src)}" target="_blank" rel="noreferrer">Open in Google Calendar ↗</a></div>`;
  slot.querySelector('[data-load-calendar]').onclick=()=>{
    slot.innerHTML=`<div class="calendar-frame-scroll"><iframe class="calendar-frame" src="${escape(google.src)}" title="Google Calendar — ${google.count} calendars" referrerpolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-popups allow-forms"></iframe></div><div class="embed-controls"><span>Private calendars require access in Google. <a href="${escape(google.src)}" target="_blank" rel="noreferrer">Open in Google ↗</a></span><button type="button" class="text-button" data-unload-calendar>Unload calendar</button></div>`;
    slot.querySelector('[data-unload-calendar]').onclick=()=>{renderGooglePlaceholder(slot,google);slot.querySelector('[data-load-calendar]').focus({preventScroll:true});};
    slot.querySelector('[data-unload-calendar]').focus({preventScroll:true});
  };
}
document.addEventListener('click',e=>{const button=e.target.closest('[data-refresh-widget]');if(button&&configuration)loadWidget(button.dataset.refreshWidget,activeKey,true)});
