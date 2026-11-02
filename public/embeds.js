// Parse links locally. Never fetch metadata, thumbnails, or arbitrary embed HTML.
export function parseEmbed(value) {
  let url;
  try { url = new URL(value); } catch { return null; }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port) return null;
  const host = url.hostname.toLowerCase();
  const parts = url.pathname.split('/').filter(Boolean);
  const videoId = /^[\w-]{11}$/;
  if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com', 'youtu.be'].includes(host)) {
    const id = host === 'youtu.be' ? parts[0] : parts[0] === 'watch' ? url.searchParams.get('v') : ['embed','shorts','live'].includes(parts[0]) ? parts[1] : null;
    if (!videoId.test(id || '')) return null;
    const src = new URL(`https://www.youtube-nocookie.com/embed/${id}`);
    src.searchParams.set('rel', '0');
    const rawTime = url.searchParams.get('start') || url.searchParams.get('t') || '';
    const duration = rawTime.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
    const start = /^\d+$/.test(rawTime) ? Number(rawTime) : duration ? Number(duration[1]||0)*3600+Number(duration[2]||0)*60+Number(duration[3]||0) : 0;
    if (start > 0 && start <= 604800) src.searchParams.set('start', String(start));
    return { provider:'YouTube', kind:'video', url:`https://www.youtube.com/watch?v=${id}`, src:src.href, label:'YouTube video' };
  }
  if (host === 'open.spotify.com') {
    if (parts[0]?.startsWith('intl-')) parts.shift();
    if (parts[0] === 'embed') parts.shift();
    const [kind,id] = parts;
    if (parts.length !== 2 || !['track','album','playlist','artist','episode','show'].includes(kind) || !/^[a-zA-Z0-9]{22}$/.test(id)) return null;
    return { provider:'Spotify', kind:'audio', url:`https://open.spotify.com/${kind}/${id}`, src:`https://open.spotify.com/embed/${kind}/${id}?theme=0`, label:`Spotify ${kind}` };
  }
  if (['vimeo.com','www.vimeo.com','player.vimeo.com'].includes(host)) {
    if (host === 'player.vimeo.com' && parts[0] === 'video') parts.shift();
    const [id,privateHash] = parts;
    if (!/^\d{1,12}$/.test(id || '') || parts.length > 2) return null;
    const hash = privateHash || url.searchParams.get('h');
    if (hash && !/^[a-zA-Z0-9]{6,32}$/.test(hash)) return null;
    const src = new URL(`https://player.vimeo.com/video/${id}`);
    src.searchParams.set('dnt','1');
    if (hash) src.searchParams.set('h',hash);
    return { provider:'Vimeo', kind:'video', url:`https://vimeo.com/${id}${hash?'/'+hash:''}`, src:src.href, label:'Vimeo video' };
  }
  if (['soundcloud.com','www.soundcloud.com'].includes(host)) {
    if (parts.length < 2 || parts.length > 3 || !parts.every(p=>/^[\w-]+$/.test(p)) || ['discover','stream','you','search','settings'].includes(parts[0])) return null;
    if (parts.length === 3 && parts[1] !== 'sets') return null;
    const canonical = `https://soundcloud.com/${parts.join('/')}`;
    return { provider:'SoundCloud', kind:'audio', url:canonical, src:`https://w.soundcloud.com/player/?url=${encodeURIComponent(canonical)}&auto_play=false&color=%23888888`, label:'SoundCloud player' };
  }
  return null;
}

export function linksInText(text) {
  return [...String(text).matchAll(/https?:\/\/[^\s<>"']+/gi)].map(match=>({
    url:match[0].replace(/[.,!?;:)\]}]+$/g,''), index:match.index
  }));
}

export function embedsInText(text) {
  const unique = new Map();
  for (const {url} of linksInText(text)) {
    const embed = parseEmbed(url);
    if (embed && !unique.has(embed.url)) unique.set(embed.url, embed);
    if (unique.size === 3) break;
  }
  return [...unique.values()];
}
