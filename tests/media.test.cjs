const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function context(){let counter=0;const ctx={state:{notes:[{id:'legacy',text:'same title',date:'2026-10-29'},{id:'existing',text:'already saved',recordType:'media',mediaStatus:'done'}],tasks:[{id:'task',text:'work'}]},uid:()=>String(++counter),today:'2026-10-29',CFG:{mode:'demo'},modal:{close(){}},render(){},toast(){},busy:false,query:'',saveLabel:'',C:{upsert:(list,item)=>[...list.filter(x=>x.id!==item.id),item]}};ctx.storeAdapter={setMany:async(type,items)=>{assert.equal(type,'notes');ctx.written=items;}};vm.createContext(ctx);vm.runInContext(fs.readFileSync('src/media.fragment.js','utf8'),ctx);return ctx;}
test('media batch import skips duplicate titles including finished items, preserves ordinary notes and tasks, and is repeatable',async()=>{
 const c=context(),f={get:k=>({titles:'same title\nalready saved\nnew\nnew\n',kind:'other',notes:'source'}[k])};
 await c.submitMediaBatch(f);assert.equal(c.written.length,2);assert.equal(c.state.notes.length,4);assert.equal(c.state.tasks.length,1);assert.equal(c.state.notes[0].recordType,undefined);
 await c.submitMediaBatch(f);assert.equal(c.state.notes.length,4);
});
test('media edits preserve provenance and reject active URLs before storage',()=>{
 const c=context(),values={id:'x',text:'a book',kind:'read',mediaStatus:'started',url:'https://example.com',notes:''};
 assert.equal(c.mediaRecord({createdAt:'old'},values).createdAt,'old');
 assert.throws(()=>c.mediaRecord({},{...values,url:'javascript:alert(1)'}));
 assert.throws(()=>c.mediaRecord({},{...values,kind:'invalid'}));
});
