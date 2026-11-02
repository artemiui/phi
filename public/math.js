import renderMathInElement from './vendor/katex/contrib/auto-render.mjs';

export const hasMath = text => /\$\$[\s\S]+?\$\$|\$(?!\s)[^$\n]+?\$|\\\([\s\S]+?\\\)|\\\[[\s\S]+?\\\]/.test(text);
export function renderMath(root) {
  renderMathInElement(root,{
    delimiters:[{left:'$$',right:'$$',display:true},{left:'\\[',right:'\\]',display:true},{left:'\\(',right:'\\)',display:false},{left:'$',right:'$',display:false}],
    throwOnError:false,trust:false,maxExpand:500,maxSize:15,strict:'ignore',
    ignoredTags:['script','noscript','style','textarea','pre','code','option','a'],
    errorColor:'#d7a5a5',errorCallback:()=>{}
  });
}
