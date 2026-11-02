import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createMediaStore,validMedia} from '../media.mjs';

test('media entries validate ratings/dates, preserve extra fields, and isolate replacement',()=>{
  const db=new DatabaseSync(':memory:');const store=createMediaStore(db);
  try{
    assert.deepEqual(store.list(),[]);
    const entry=store.save({title:'Example movie',type:'movie',rating:'4.5',completed:'03-11-2026',body:'A review.',format:'Cinema'});
    assert.equal(store.get(entry.id).format,'Cinema');
    assert.equal(store.save({...entry,rating:'5.0'},entry.id).id,entry.id);
    assert.throws(()=>store.save({...entry,completed:'31-02-2026'}),/valid dates/);
    assert.throws(()=>validMedia({...entry,rating:'5.5'}),/rating/);
    assert.throws(()=>validMedia({...entry,cover_link:'javascript:alert(1)'}),/HTTPS/);
    assert.throws(()=>store.replace([{title:'Valid',type:'book'},{title:'Invalid',type:'not a type'}]),/media type/);
    assert.equal(store.list().length,1);
    store.remove(entry.id);assert.equal(store.list().length,0);
  }finally{db.close();}
});
