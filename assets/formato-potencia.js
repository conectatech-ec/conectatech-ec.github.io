/* Convención visible de CONECTATECH: 25W. No modifica los datos de producto. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else{root.CONECTATECH_POTENCIA=api;api.mount(document);}
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const pattern=/(?<![\p{L}\p{N}_])([+-]?\d+(?:[.,]\d+)?)(?:[\s\u00a0\u202f]|&nbsp;|&thinsp;|&#(?:160|8239);|&#x(?:a0|202f);)+(?:watts?|w)(?![\p{L}\p{N}_])/giu;
  const text=value=>String(value??'').replace(pattern,'$1W');
  const attributes=tag=>tag.replace(/\b(title|aria-label|alt)=("[^"]*"|'[^']*')/gi,(whole,key,quoted)=>key+'='+quoted[0]+text(quoted.slice(1,-1))+quoted.at(-1));
  function html(source){
    let skip='';
    return String(source).replace(/<!--[\s\S]*?-->|<[^>]*>|[^<]+|</g,part=>{
      if(part.startsWith('<')){
        if(/^<!--/.test(part))return part;
        const close=part.match(/^<\/\s*([a-z0-9]+)/i),open=part.match(/^<\s*([a-z0-9]+)/i);
        if(close&&close[1].toLowerCase()===skip){skip='';return part;}
        if(!skip&&open&&/^(script|style|textarea|pre|code)$/i.test(open[1]))skip=open[1].toLowerCase();
        return skip?part:attributes(part);
      }
      return skip?part:text(part);
    });
  }
  function mount(doc){
    const excluded=el=>el?.closest('script,style,textarea,pre,code,[contenteditable="true"]');
    function apply(node){
      if(node.nodeType===3){if(!excluded(node.parentElement)){const next=text(node.nodeValue);if(next!==node.nodeValue)node.nodeValue=next;}return;}
      if(node.nodeType!==1||excluded(node))return;
      const attr=el=>{for(const name of ['title','aria-label','alt'])if(el.hasAttribute(name)){const value=el.getAttribute(name),next=text(value);if(value!==next)el.setAttribute(name,next);}};
      attr(node);node.querySelectorAll('[title],[aria-label],[alt]').forEach(el=>{if(!excluded(el))attr(el);});
      const walker=doc.createTreeWalker(node,4);while(walker.nextNode())apply(walker.currentNode);
    }
    const start=()=>{
      if(!doc.body)return;
      doc.title=text(doc.title);apply(doc.body);
      const observer=new MutationObserver(records=>{for(const record of records){if(record.type==='childList')record.addedNodes.forEach(apply);else apply(record.target);}});
      observer.observe(doc.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['title','aria-label','alt']});
    };
    if(doc.body)start();else doc.addEventListener('DOMContentLoaded',start,{once:true});
  }
  return {text,html,mount};
});
