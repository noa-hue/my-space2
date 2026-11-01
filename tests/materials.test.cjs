const {test}=require('node:test'),assert=require('node:assert/strict'),M=require('../src/materials.cjs');
test('links are bidirectional and suggestions exclude existing, archived and self',()=>{
 const a={id:'a',title:'רעיון ראשון',topic:'מורכבות',relatedIds:['b']},b={id:'b',topic:'מורכבות'},c={id:'c',topic:'מורכבות'},d={id:'d',topic:'מורכבות',archived:true};
 assert(M.linked(a,b));assert(M.linked(b,a));assert.deepEqual(M.suggestions(a,[a,b,c,d]).map(x=>x.id),['c']);assert(M.linked({id:'e',sourceId:'a'},a));
});
test('matching offers a stated reason and requires two shared content words',()=>{
 const a={id:'a',body:'שיחה קטנה מאפשרת להקשיב',tags:['אמון']},b={id:'b',body:'להקשיב לשיחה אחרת',tags:['אמון']},c={id:'c',body:'שיחה קטנה פותחת מחשבה'},d={id:'d',body:'שיחה חדשה'};
 const found=M.suggestions(a,[b,c,d]);assert(found.some(x=>x.id==='b'&&x.reason.includes('תגיות')));assert(found.some(x=>x.id==='c'&&x.reason.includes('מילים משותפות')));assert(!found.some(x=>x.id==='d'));
});
test('organized archive keeps every item including duplicate titles and preserves input',()=>{
 const all=[{id:'1',title:'../מחשבה: חדשה',topic:'../קשרים',body:'מקור',materialType:'idea'},{id:'2',title:'../מחשבה: חדשה',topic:'../קשרים',body:'שנייה',materialType:'idea'},{id:'3',title:'אחרת',archived:true,body:'ארכיון'}],before=JSON.stringify(all),entries=M.archiveEntries(all);
 assert.equal(entries.length,4);assert.equal(new Set(entries.map(x=>x.name)).size,4);assert(entries.some(x=>x.name.includes('ארכיון/')));assert(entries.every(x=>!x.name.split('/').includes('..')));assert.equal(JSON.stringify(all),before);
});
test('Word output escapes markup and includes captured text separately from edited text',()=>{
 const d={id:'a',title:'רעיון',body:'טקסט חדש <שלי> & פתוח',capturedBody:'מקור\nנשמר',pause:'כאן עצרתי'},bytes=M.materialDocx(d,[d]),raw=new TextDecoder().decode(bytes);
 assert(raw.includes('&lt;שלי&gt; &amp;'));assert(raw.includes('הטקסט כפי שנקלט'));assert(raw.includes('מקור'));assert(raw.includes('כאן עצרתי'));assert(raw.includes('<w:rtlGutter/>'));assert(raw.includes('he-IL'));
});
test('ZIP rejects traversal and duplicate entry names',()=>{assert.throws(()=>M.zip([{name:'../oops',data:''}]));assert.throws(()=>M.zip([{name:'x',data:''},{name:'x',data:''}]));});
