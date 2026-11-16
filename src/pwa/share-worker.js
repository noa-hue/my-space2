self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));

self.addEventListener('fetch',event=>{
 const request=event.request;
 const destination=new URL(request.url);
 if(request.method!=='POST'||destination.origin!==self.location.origin||destination.pathname!=='/share')return;
 event.respondWith((async()=>{
  let fields;
  try{fields=await request.formData();}catch{fields=new URLSearchParams();}
  // Keep the article out of the Hosting request and let the signed-in user review it.
  const page=new URL('/',destination.origin);
  page.hash=NoaSharedArticle.sharedArticleFragment(fields);
  return Response.redirect(page.href,303);
 })());
});
