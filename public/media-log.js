import {mediaTypeIcon} from './media-icons.js';
import {ratingControl,bindRating,setRating} from './media-rating.js';
import {sortMedia,formatMediaDate} from './media-sort.js';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const types=['movie','anime','game','manga','light novel','book','other'];
const fields={title:'Title',cover_link:'Cover URL',started:'Started · DD-MM-YYYY',completed:'Completed · DD-MM-YYYY',director:'Director / creator',released:'Release year',genre:'Genre',format:'Format',eps:'Episodes / chapters','total episodes':'Total episodes / chapters',body:'Notes'};
let entries=[],search='',type='',rating='',sort='title-asc',editing=null,root,notify;
async function request(url,method='GET',value){const response=await fetch(url,{method,headers:{'Content-Type':'application/json'},body:value===undefined?undefined:JSON.stringify(value)});const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not save media.');return data;}
export async function renderMediaLog(target,notice){
  root=target;notify=notice;
  root.innerHTML='<p class="media-intro">Loading your media log…</p>';
  try{entries=await request('/api/media');draw();}catch(error){root.innerHTML=`<p class="media-intro">${escape(error.message)}</p><button class="secondary" data-retry-media>Try again</button>`;root.querySelector('[data-retry-media]').onclick=()=>renderMediaLog(target,notice);}
}
function stars(value){const glyph='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2.5 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3-5.8 3 1.1-6.5-4.7-4.6 6.5-.9Z"/></svg>';return '<span class="rating-stars" role="img" aria-label="'+value+' out of 5 stars"><span class="star-outline">'+glyph.repeat(5)+'</span><span class="star-fill" style="clip-path:inset(0 '+(100-value*20)+'% 0 0)">'+glyph.repeat(5)+'</span></span>';}
function draw(){
  root.innerHTML=`<div class="media-log-tools"><div class="media-log-search-row"><label class="media-log-search"><span class="sr-only">Search media</span><input type="search" data-media-search value="${escape(search)}" placeholder="Search media"></label><button class="primary" data-add-media>Add entry</button></div><div class="media-log-filters"><label>Type<select data-media-type><option value="">All types</option>${types.map(t=>`<option ${t===type?'selected':''}>${t}</option>`).join('')}</select></label><div class="media-log-filter"><span>Minimum rating</span>${ratingControl('minimumRating','Minimum rating',rating)}</div><label>Sort by<select data-media-sort>${Object.entries({'title-asc':'Title · A to Z','title-desc':'Title · Z to A','rating-desc':'Rating · highest first','rating-asc':'Rating · lowest first','completed-desc':'Recently completed','started-desc':'Recently started'}).map(([value,label])=>`<option value="${value}" ${sort===value?'selected':''}>${label}</option>`).join('')}</select></label></div></div><div class="media-log-results"></div><dialog class="media-entry-dialog"><form data-media-form><div class="dialog-heading"><h2>Media entry</h2><button type="button" class="icon-button" data-close-media aria-label="Close media entry">×</button></div><div class="form-grid">${Object.entries(fields).map(([key,label])=>`<label class="${key==='body'||key==='title'?'wide':''}">${label}${key==='body'?`<textarea name="${key}" maxlength="10000"></textarea>`:`<input name="${key}" ${key==='title'?'required maxlength="300"':key==='cover_link'?'type="url"':''}>`}</label>`).join('')}<label>Type<select name="type">${types.map(t=>`<option>${t}</option>`).join('')}</select></label><div class="media-log-filter"><span>Rating</span>${ratingControl('rating','Entry rating')}</div></div><div class="dialog-actions"><button type="button" class="secondary" data-delete-media>Delete entry</button><button type="submit" class="primary">Save entry</button></div></form></dialog>`;
  root.querySelector('[data-add-media]').onclick=()=>open();
  root.querySelector('[data-media-search]').oninput=e=>{search=e.target.value;results();};
  root.querySelector('[data-media-type]').onchange=e=>{type=e.target.value;results();};
  bindRating(root.querySelector('[data-rating-control=minimumRating]'),value=>{rating=value;results();});
  bindRating(root.querySelector('[data-rating-control=rating]'),()=>{});
  root.querySelector('[data-media-sort]').onchange=e=>{sort=e.target.value;results();};
  root.querySelector('[data-close-media]').onclick=()=>root.querySelector('dialog').close();
  root.querySelector('[data-media-form]').onsubmit=save;
  root.querySelector('[data-delete-media]').onclick=remove;
  results();
}
function results(){
  const list=sortMedia(entries.filter(e=>(!type||e.type===type)&&(!rating||Number(e.rating)>=Number(rating))&&`${e.title} ${e.body||''}`.toLowerCase().includes(search.toLowerCase())),sort);
  root.querySelector('.media-log-results').innerHTML=`<p class="media-log-count">${list.length} ${list.length===1?'entry':'entries'}</p>${list.length?`<div class="media-log-grid">${list.map(e=>`<button class="media-log-card" data-media-id="${escape(e.id)}">${e.cover_link?`<img src="${escape(e.cover_link)}" loading="lazy" referrerpolicy="no-referrer" alt="Cover of ${escape(e.title)}">`:'<span class="media-cover-placeholder" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 3h16v18H4ZM8 8h8M8 12h8M8 16h5"/></svg></span>'}<span class="media-log-title">${escape(e.title)}</span><small class="media-card-meta">${mediaTypeIcon(e.type)}${e.rating?stars(Number(e.rating)):''}</small><small>${escape(formatMediaDate(e.completed||e.started||''))}</small></button>`).join('')}</div>`:'<p class="media-intro">No entries yet. Add something you watched, read, or played.</p>'}`;
  for(const card of root.querySelectorAll('[data-media-id]'))card.onclick=()=>open(entries.find(e=>e.id===card.dataset.mediaId));
}
function open(entry=null){
  editing=entry;const form=root.querySelector('form');form.reset();
  for(const key of [...Object.keys(fields),'type','rating'])form.elements[key].value=entry?.[key]|| (key==='type'?'movie':'');
  setRating(root.querySelector('[data-rating-control=rating]'),entry?.rating||'');
  root.querySelector('[data-delete-media]').hidden=!entry;
  root.querySelector('dialog').showModal();form.elements.title.focus();
}
async function save(event){
  event.preventDefault();const form=event.target,button=form.querySelector('[type=submit]');button.disabled=true;
  try{const values={...editing,...Object.fromEntries(new FormData(form))};delete values.id;await request('/api/media'+(editing?'/'+editing.id:''),editing?'PUT':'POST',values);root.querySelector('dialog').close();entries=await request('/api/media');results();document.dispatchEvent(new Event('media-log-changed'));notify('Media entry saved.');}catch(error){notify(error.message,true);}finally{button.disabled=false;}
}
async function remove(){
  if(!editing||!confirm(`Delete “${editing.title}” from your media log?`))return;
  const button=root.querySelector('[data-delete-media]');button.disabled=true;
  try{await request('/api/media/'+editing.id,'DELETE');root.querySelector('dialog').close();entries=await request('/api/media');results();notify('Media entry deleted.');}catch(error){notify(error.message,true);}finally{button.disabled=false;}
}
