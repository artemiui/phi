import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import katex from 'katex';
import { parseEmbed, embedsInText } from '../public/embeds.js';
import { parseContributions, readVaultGraph } from '../widgets.mjs';

test('only recognized media links produce canonical, non-autoplay embeds',()=>{
  const youtube=parseEmbed('https://youtu.be/M7lc1UVf-VE?t=1m30s&tracking=private');
  assert.equal(youtube.src,'https://www.youtube-nocookie.com/embed/M7lc1UVf-VE?rel=0&start=90');
  assert.equal(parseEmbed('https://www.youtube.com/shorts/M7lc1UVf-VE').url,youtube.url);
  assert.match(parseEmbed('https://open.spotify.com/intl-en/track/0Lr4kGOYn9l83EjuK6cZFQ?si=secret').src,/\/embed\/track\/[a-zA-Z0-9]+\?theme=0$/);
  assert.match(parseEmbed('https://vimeo.com/12345678/a1b2c3d4e5').src,/h=a1b2c3d4e5/);
  assert.match(parseEmbed('https://soundcloud.com/artist/track').src,/auto_play=false/);
  for(const url of ['javascript:alert(1)','https://youtube.com.evil.test/watch?v=M7lc1UVf-VE','https://evil@www.youtube.com/watch?v=M7lc1UVf-VE','https://www.youtube.com:443/watch?v=invalid','https://open.spotify.com/track/%22onload%3Dalert(1)','https://soundcloud.com/search?q=test'])assert.equal(parseEmbed(url),null);
  assert.equal(embedsInText('One: https://youtu.be/M7lc1UVf-VE. Same: https://youtube.com/watch?v=M7lc1UVf-VE').length,1);
  assert.equal(embedsInText('https://example.com').length,0);
});

test('GitHub contribution levels and tooltip counts are paired by cell id',()=>{
  const html=Array.from({length:7},(_,i)=>`<td data-date="2026-01-0${i+1}" id="day-${i}" data-level="${i%5}"></td><tool-tip for="day-${i}">${i===0?'No':i} contributions on January ${i+1}.</tool-tip>`).reverse().join('');
  const result=parseContributions(html);assert.equal(result.days.length,7);assert.equal(result.total,21);assert.equal(result.days[0].date,'2026-01-01');assert.equal(result.days[0].count,0);assert.equal(result.days[6].level,1);
  assert.throws(()=>parseContributions('<p>unavailable</p>'),/not recognized/);
});

test('Obsidian graph resolves local wiki and Markdown links, ignores code and hidden files',async()=>{
  const root=await mkdtemp(path.join(tmpdir(),'phi-vault-'));
  try{
    await mkdir(path.join(root,'folder'));await mkdir(path.join(root,'.obsidian'));
    await writeFile(path.join(root,'A.md'),'[[B|Alias]]\n[[folder/C#Heading]]\n[child](folder/C.md)\n`[[Ignored]]`\n```\n[[Ignored]]\n```');
    await writeFile(path.join(root,'B.md'),'[[A]]\n[[Missing]]');
    await writeFile(path.join(root,'folder','C.md'),'[A](../A.md)');
    await writeFile(path.join(root,'Ignored.md'),'');
    await writeFile(path.join(root,'.obsidian','Private.md'),'[[A]]');
    const graph=await readVaultGraph(root);assert.equal(graph.totalNotes,4);assert.equal(graph.totalLinks,2);assert.equal(graph.nodes.find(n=>n.id==='A.md').degree,2);assert.equal(graph.nodes.find(n=>n.id==='Ignored.md').degree,0);
    const node=graph.nodes.find(n=>n.id==='folder/C.md');assert.equal(new URL(node.uri).searchParams.get('path'),path.join(root,'folder','C.md'));
    await assert.rejects(readVaultGraph(path.join(root,'absent')),/not found/);
    await assert.rejects(readVaultGraph('relative/path'),/absolute local/);
  }finally{await rm(root,{recursive:true,force:true})}
});

test('LaTeX renders accessible math and refuses trusted-resource commands',()=>{
  const html=katex.renderToString(String.raw`\int_0^1 x^2\,dx=\frac{1}{3}`,{trust:false,throwOnError:false,displayMode:true,maxExpand:500});
  assert.match(html,/katex-display/);assert.match(html,/<math/);
  const blocked=katex.renderToString(String.raw`\includegraphics{https://evil.test/image.png}`,{trust:false,throwOnError:false});
  assert.doesNotMatch(blocked,/<img\b/);
  const malformed=katex.renderToString(String.raw`\frac{1`,{trust:false,throwOnError:false});assert.match(malformed,/katex-error/);
});
