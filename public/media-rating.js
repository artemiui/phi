const star='<path d="m12 2.5 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3-5.8 3 1.1-6.5-4.7-4.6 6.5-.9Z"/>';
export function ratingControl(name,label,value=''){
  return `<div class="rating-control" data-rating-control="${name}" role="group" aria-label="${label}"><div class="rating-actions">${[1,2,3,4,5].map(n=>`<button type="button" data-rating-star="${n}" aria-label="${n} ${n===1?'star':'stars'}" title="Choose ${n} stars; use arrow keys for half stars"><svg viewBox="0 0 24 24" aria-hidden="true"><g class="rating-outline">${star}</g><g class="rating-fill">${star}</g></svg></button>`).join('')}</div><output aria-live="polite" data-rating-output></output><button type="button" class="rating-clear" data-rating-clear aria-label="Clear rating">Clear</button><input type="hidden" name="${name}" value="${value}"></div>`;
}
export function setRating(group,value){
  const rating=Number(value)||0;group.querySelector('input').value=rating?rating.toFixed(1):'';
  group.querySelector('[data-rating-clear]').hidden=!rating;
  paintRating(group,rating);
  for(const button of group.querySelectorAll('[data-rating-star]'))button.setAttribute('aria-pressed',String(rating>0&&Math.ceil(rating)===Number(button.dataset.ratingStar)));
}
function paintRating(group,rating){
  group.querySelector('[data-rating-output]').textContent=rating?rating+(group.dataset.ratingControl==='minimumRating'?'+':' / 5'):(group.dataset.ratingControl==='minimumRating'?'Any':'Unrated');
  for(const button of group.querySelectorAll('[data-rating-star]')){
    const n=Number(button.dataset.ratingStar),filled=Math.max(0,Math.min(1,rating-(n-1)));
    button.querySelector('.rating-fill').style.clipPath=`inset(0 ${100-filled*100}% 0 0)`;
  }
}
export function ratingAtPosition(starValue,clientX,left,width){return Number(starValue)-(clientX<left+width/2?.5:0);}
export function bindRating(group,onChange){
  const change=value=>{setRating(group,value);onChange(group.querySelector('input').value);};
  setRating(group,group.querySelector('input').value);
  const restore=()=>paintRating(group,Number(group.querySelector('input').value)||0);
  group.querySelector('.rating-actions').onpointerleave=restore;
  group.querySelector('.rating-actions').onpointercancel=restore;
  for(const button of group.querySelectorAll('[data-rating-star]')){
    const pointedRating=event=>{const box=button.getBoundingClientRect();return ratingAtPosition(button.dataset.ratingStar,event.clientX,box.x,box.width);};
    button.onpointermove=button.onpointerenter=event=>{
      if(event.pointerType==='touch')return;
      const value=pointedRating(event);paintRating(group,value);button.title=`Select ${value} ${value===1?'star':'stars'}`;
    };
    button.onclick=event=>change(event.detail?pointedRating(event):Number(button.dataset.ratingStar));
    button.onkeydown=event=>{
      if(['ArrowLeft','ArrowDown','ArrowRight','ArrowUp','Home','End'].includes(event.key)){
        event.preventDefault();const old=Number(group.querySelector('input').value)||0;
        change(event.key==='Home'?0:event.key==='End'?5:Math.max(0,Math.min(5,old+(['ArrowLeft','ArrowDown'].includes(event.key)?-.5:.5))));
      }
    };
  }
  group.querySelector('[data-rating-clear]').onclick=()=>change('');
}
