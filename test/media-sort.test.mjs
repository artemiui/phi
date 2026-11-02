import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sortMedia,mediaDate,formatMediaDate,latestMediaEntry} from '../public/media-sort.js';
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
test('media dates display natural language without guessing malformed legacy dates',()=>{
  assert.equal(formatMediaDate('01-06-2022'),'June 1, 2022');
  assert.equal(formatMediaDate('2026-11-03'),'November 3, 2026');
  assert.equal(formatMediaDate('29-02-2024'),'February 29, 2024');
  assert.equal(formatMediaDate('31-02-2026'),'31-02-2026');
  assert.equal(formatMediaDate('2 22- 7-31'),'2 22- 7-31');
  assert.equal(formatMediaDate(''),'');
});
test('latest log uses recorded dates and a verb matching the media type',()=>{
  const entries=[{title:'Film',type:'movie',completed:'01-06-2022'},{title:'Game',type:'game',started:'03-11-2026'},{title:'Legacy',type:'anime',completed:'old date'}];
  assert.equal(latestMediaEntry(entries).title,'Game');assert.equal(latestMediaEntry(entries).verb,'played');
  assert.equal(latestMediaEntry([{title:'Novel',type:'book',completed:'2026-11-03'}]).verb,'read');
  assert.equal(latestMediaEntry([entries[0]]).verb,'watched');
  assert.equal(latestMediaEntry([{title:'Undated',type:'movie'}]),null);
});
