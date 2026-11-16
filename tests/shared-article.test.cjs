const test=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const vm=require('node:vm');
const share=require('../src/shared-article.cjs');

const site='https://workspace.example';
const url='https://example.com/article?q=a+b#reading';
const title='כתבה לדוגמה';
const source='src/shared-article.cjs';

test('shared links and titles survive the fragment including query strings and anchors',()=>{
 const hash=share.sharedArticleFragment(new URLSearchParams({url,title}));
 assert.deepEqual(share.readSharedArticle(hash),{article:{url,title}});
 const fromText=share.sharedArticleFragment(new URLSearchParams({text:'לקריאה '+url}));
 assert.deepEqual(share.readSharedArticle(fromText),{article:{url,title:'example.com'}});
 assert.equal(share.readSharedArticle('#another-section'),null);
});

test('shared input accepts web URLs and excludes credentials and non-links',()=>{
 for(const url of ['javascript:alert(1)','https://alice:secret@example.com/','file:///tmp/article','https:example.com']){
  assert.deepEqual(share.readSharedArticle(share.sharedArticleFragment(new URLSearchParams({url}))),{article:null});
 }
});

test('the worker handles the manifest share POST locally and leaves regular routes alone',async()=>{
 const callbacks={};
 const context={URL,URLSearchParams,Response,self:{location:new URL(site),addEventListener:(name,cb)=>{callbacks[name]=cb;}}};
 vm.runInNewContext(readFileSync(source,'utf8')+'\n'+readFileSync('src/pwa/share-worker.js','utf8'),context);
 const manifest=JSON.parse(readFileSync('src/pwa/manifest.webmanifest','utf8'));
 const {action,method}=manifest.share_target;
 let response;
 const body=new URLSearchParams({[manifest.share_target.params.title]:title,[manifest.share_target.params.url]:url});
 callbacks.fetch({request:new Request(site+action,{method,body}),respondWith:p=>{response=p;}});
 const redirect=await response;
 assert.equal(redirect.status,303);
 const landing=new URL(redirect.headers.get('location'));
 assert.equal(landing.origin,site);
 assert.equal(landing.search,'');
 assert.deepEqual(share.readSharedArticle(landing.hash),{article:{url,title}});

 for(const request of [new Request(site+action),new Request(site+'/api',{method:'POST',body}),new Request('https://elsewhere.example'+action,{method,body})]){
  callbacks.fetch({request,respondWith:()=>assert.fail('The share worker handled an unrelated request')});
 }
});

test('the review form waits for app data, and an existing article can be shown without a new draft',()=>{
 const fragment=readFileSync('src/shared-article.fragment.js','utf8');
 const hash=share.sharedArticleFragment(new URLSearchParams({title,url}));
 let consumed=0,viewed=0,preset;
 const context={NoaSharedArticle:share,window:{addEventListener(){},location:{hash,pathname:'/',search:''},history:{replaceState(){consumed++;}}},
  modal:{open:false,addEventListener(){}},navigator:{},storeAdapter:null,dirty:false,busy:false,state:{notes:[]},page:'home',query:'',mediaKind:'',mediaView:'',
  toast(){},render(){viewed++;},editMedia:(_id,values)=>{preset=values;}};
 vm.createContext(context);
 vm.runInContext(fragment,context);
 context.openSharedArticle();
 assert.equal(consumed,0);
 context.storeAdapter={};
 context.openSharedArticle();
 assert.equal(context.page,'media');
 assert.deepEqual({...preset},{url,text:title,kind:'read',mediaStatus:'saved'});
 assert.equal(consumed,1);

 preset=undefined;
 context.state.notes=[{recordType:'media',url,text:'Existing title',kind:'read',mediaStatus:'done'}];
 context.openSharedArticle();
 assert.equal(context.mediaView,'done');
 assert.equal(context.query,'Existing title');
 assert.equal(viewed,2);
 assert.equal(preset,undefined);
});
