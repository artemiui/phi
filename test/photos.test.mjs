import {test} from 'node:test';
import assert from 'node:assert/strict';
import {photoGrid,MAX_POST_IMAGES} from '../public/photos.js';
test('photo grids cap visible tiles at four while retaining total count and overflow access',()=>{
  for(const count of [1,2,3,4,5,MAX_POST_IMAGES]){
    const html=photoGrid({id:'example',images:Array(count).fill('data:image/png;base64,AAAA'),alt:'A "photo"'});
    assert.equal((html.match(/<button /g)||[]).length,Math.min(count,4));
    assert(html.includes(`data-photo-count="${Math.min(count,4)}"`));
    assert(html.includes('alt="A &quot;photo&quot;"'));
    assert(html.includes(`of ${count}`));
    if(count>4)assert(html.includes(`+${count-4}</span>`));
    else assert(!html.includes('class="photo-overflow"'));
  }
  assert.equal(photoGrid({images:[]}), '');
});
