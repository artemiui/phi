// Keep keyboard navigation immediate while pointer interactions show continuity.
document.addEventListener('keydown',event=>{
  if(['Tab','Enter',' ','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Escape'].includes(event.key))document.documentElement.classList.add('keyboard-navigation');
},true);
document.addEventListener('pointerdown',()=>document.documentElement.classList.remove('keyboard-navigation'),true);
