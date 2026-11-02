const types={
  movie:['Movie','M3 4h18v16H3ZM3 9h18M8 4l4 5M15 4l4 5'],
  anime:['Anime','M3 7h18v14H3ZM8 2l4 5 4-5M7 11h10v6H7Z'],
  game:['Game','M7 8h10c3 0 4 3 5 8 .4 3-2 4-4 1l-2-2H8l-2 2c-2 3-4.4 2-4-1 1-5 2-8 5-8ZM5 11v4M3 13h4M16 12h.01M19 14h.01'],
  manga:['Manga','M4 3h16v18H4ZM4 10h16M12 3v7M4 16h16M10 10v6M15 16v5'],
  'light novel':['Light novel','M4 3h13v18H4ZM8 7h5M8 11h5M19 4l2 2-6 6-2 1 1-2Z'],
  book:['Book','M12 5C9 3 5 3 2 4v16c3-1 7-1 10 1 3-2 7-2 10-1V4c-3-1-7-1-10 1ZM12 5v16'],
  other:['Other','M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM7 12h.01M12 12h.01M17 12h.01']
};
export function mediaTypeIcon(type){
  const [label,path]=types[type]||types.other;
  return `<span class="media-type-icon" role="img" aria-label="${label}" title="${label}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${path}"/></svg></span>`;
}
