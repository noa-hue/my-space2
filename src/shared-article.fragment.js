function openSharedArticle(){
 if(!storeAdapter||modal.open||dirty||busy)return;
 const share=NoaSharedArticle.readSharedArticle(window.location.hash);
 if(!share)return;
 window.history.replaceState(window.history.state,'',window.location.pathname+window.location.search);
 if(!share.article){toast('לא התקבל קישור לכתבה. שתפי קישור מתוך הדפדפן או האפליקציה שבה הכתבה פתוחה.');return;}

 const {url,title}=share.article;
 const saved=state.notes.find(item=>item.recordType==='media'&&item.url===url);
 page='media';
 query=saved?.text||'';
 mediaKind=saved?.kind||'read';
 mediaView=saved?.mediaStatus==='done'?'done':'open';
 render();
 if(saved){toast('הקישור הזה כבר שמור ברשימה.');return;}
 editMedia('',{url,text:title,kind:'read',mediaStatus:'saved'});
}

window.addEventListener('hashchange',openSharedArticle);
modal.addEventListener('close',openSharedArticle);
if('serviceWorker' in navigator){
 navigator.serviceWorker.register('/service-worker.js').catch(error=>console.warn('Article sharing setup failed',error.name));
}
