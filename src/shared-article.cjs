(function(root){
'use strict';

const sharePrefix='#shared-article?';

function articleUrl(value){
 if(typeof value!=='string'||!/^https?:\/\//i.test(value)||value.length>4096||/\s/.test(value))return '';
 try{
  const url=new URL(value);
  return ['https:','http:'].includes(url.protocol)&&!url.username&&!url.password?url.href:'';
 }catch{return '';}
}

function sharedArticle(fields){
 const text=fields.get('text');
 const candidate=typeof text==='string'?text.slice(0,16000).match(/https?:\/\/[^\s<>"“”׳״]+/i)?.[0]:'';
 const url=articleUrl(String(fields.get('url')||'').trim())||articleUrl(candidate||'');
 if(!url)return null;
 const title=String(fields.get('title')||'').replace(/\s+/g,' ').trim().slice(0,300);
 return {url,title:title||new URL(url).hostname};
}

function sharedArticleFragment(fields){
 const article=sharedArticle(fields);
 return sharePrefix+(article?new URLSearchParams(article).toString():'');
}

function readSharedArticle(hash){
 if(!hash.startsWith(sharePrefix))return null;
 return {article:sharedArticle(new URLSearchParams(hash.slice(sharePrefix.length)))};
}

const api={sharedArticleFragment,readSharedArticle};
if(typeof module==='object'&&module.exports)module.exports=api;else root.NoaSharedArticle=api;
})(typeof globalThis!=='undefined'?globalThis:this);
