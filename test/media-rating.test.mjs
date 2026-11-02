import {test} from 'node:test';
import assert from 'node:assert/strict';
import {bindRating} from '../public/media-rating.js';

test('hover previews half stars without committing, restores selection, and click matches preview',()=>{
  const input={value:'2.0'},output={},clear={},actions={},changes=[];
  const buttons=[1,2,3,4,5].map(n=>({dataset:{ratingStar:String(n)},fill:{style:{}},querySelector(){return this.fill;},setAttribute(){},getBoundingClientRect(){return {x:(n-1)*30,width:30};}}));
  const group={dataset:{ratingControl:'minimumRating'},querySelector(selector){return {'input':input,'[data-rating-output]':output,'[data-rating-clear]':clear,'.rating-actions':actions}[selector];},querySelectorAll(){return buttons;}};
  bindRating(group,value=>changes.push(value));
  const third=buttons[2];
  third.onpointermove({pointerType:'mouse',clientX:65});
  assert.equal(output.textContent,'2.5+');assert.equal(third.fill.style.clipPath,'inset(0 50% 0 0)');
  assert.equal(input.value,'2.0');assert.deepEqual(changes,[]);
  third.onpointermove({pointerType:'mouse',clientX:85});assert.equal(output.textContent,'3+');
  actions.onpointerleave();assert.equal(output.textContent,'2+');assert.equal(third.fill.style.clipPath,'inset(0 100% 0 0)');
  third.onclick({detail:1,clientX:65});assert.equal(input.value,'2.5');assert.deepEqual(changes,['2.5']);
  third.onpointermove({pointerType:'touch',clientX:85});assert.equal(output.textContent,'2.5+');
  actions.onpointerleave();assert.equal(output.textContent,'2.5+');
  third.onkeydown({key:'ArrowRight',preventDefault(){}});assert.equal(input.value,'3.0');
});
