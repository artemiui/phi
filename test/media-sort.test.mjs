import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sortMedia,mediaDate} from '../public/media-sort.js';
test('media sorting handles half ratings, missing values, dates and stable titles',()=>{
  const entries=[{title:'B',rating:'4.5',completed:'03-11-2026'},{title:'A',rating:'5.0',completed:'01-10-2026'},{title:'C'}];
  assert.deepEqual(sortMedia(entries).map(e=>e.title),['A','B','C']);
  assert.deepEqual(sortMedia(entries,'rating-desc').map(e=>e.title),['A','B','C']);
  assert.deepEqual(sortMedia(entries,'rating-asc').map(e=>e.title),['B','A','C']);
  assert.deepEqual(sortMedia(entries,'completed-desc').map(e=>e.title),['B','A','C']);
  assert.equal(mediaDate('03-11-2026'),mediaDate('2026-11-03'));
  assert.equal(mediaDate('old date'),0);
  assert.equal(entries[0].title,'B');
});
