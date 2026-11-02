export const MAX_POST_IMAGES=20;
export const MAX_PHOTO_DATA_LENGTH=48_000_000;
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function photoGrid(post){
  if(!post.images.length)return '';
  const count=Math.min(4,post.images.length),extra=post.images.length-count;
  return `<div class="post-images ${count===1?'single':''}" data-photo-count="${count}">${post.images.slice(0,4).map((src,index)=>`<button type="button" data-image-post="${escape(post.id)}" data-image-index="${index}" aria-label="Open photo ${index+1} of ${post.images.length}${index===3&&extra?', '+extra+' more photos':''}"><img loading="lazy" src="${escape(src)}" alt="${escape(post.alt||`Photo ${index+1} attached to post`)}">${index===3&&extra?`<span class="photo-overflow" aria-hidden="true">+${extra}</span>`:''}</button>`).join('')}</div>`;
}
export function createPhotoViewer(getPosts){
  const dialog=document.querySelector('#lightbox'),image=document.querySelector('#lightbox-image');
  dialog.insertAdjacentHTML('beforeend','<div class="photo-viewer-controls"><button type="button" class="icon-button" data-photo-prev aria-label="Previous photo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="m14 5-7 7 7 7"/></svg></button><span data-photo-count aria-live="polite"></span><button type="button" class="icon-button" data-photo-next aria-label="Next photo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="m10 5 7 7-7 7"/></svg></button></div>');
  const previous=dialog.querySelector('[data-photo-prev]'),next=dialog.querySelector('[data-photo-next]'),count=dialog.querySelector('[data-photo-count]');
  let selectedPost=null,index=0;
  function render(){
    const post=getPosts().find(post=>post.id===selectedPost);if(!post)return;
    image.src=post.images[index];image.alt=post.alt||`Photo ${index+1} of ${post.images.length}`;
    count.textContent=`${index+1} / ${post.images.length}`;
    previous.disabled=index===0;next.disabled=index===post.images.length-1;
    previous.hidden=next.hidden=post.images.length===1;
  }
  function move(delta){const post=getPosts().find(post=>post.id===selectedPost);if(!post)return;index=Math.max(0,Math.min(post.images.length-1,index+delta));render();}
  previous.onclick=()=>move(-1);next.onclick=()=>move(1);
  dialog.addEventListener('keydown',event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();move(event.key==='ArrowLeft'?-1:1);}});
  return (id,photoIndex)=>{const post=getPosts().find(post=>post.id===id);if(!post?.images[photoIndex])return;selectedPost=id;index=photoIndex;render();if(!dialog.open)dialog.showModal();};
}
