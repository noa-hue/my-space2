const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const C=require('../src/core.cjs');
function fixture(){const ctx={state:{tasks:[],jobs:[{id:'j'}],notes:[]},C,taskStatus:t=>t.status||(t.done?'done':'todo'),busy:false,saveLabel:'',CFG:{mode:'demo'},$:()=>null};vm.createContext(ctx);vm.runInContext(fs.readFileSync('src/task-completion.fragment.js','utf8'),ctx);return ctx;}
const task={id:'t',text:'Prepare summary',relatedType:'job',relatedId:'j',status:'todo'},now='2026-10-30T22:30:00.000Z';
function apply(c,records){for(const {type,item} of records)c.state[type]=C.upsert(c.state[type],item);}
test('completion writes task and dated case note together, including a status change through task editing',()=>{
 const c=fixture(),records=c.taskWritePlan(task,{...task,status:'done'},now);assert.equal(records.length,2);assert.equal(records[1].item.jobId,'j');assert.equal(records[1].item.date,'2026-10-31');assert.equal(records[0].item.completedAt,now);assert.equal(records[1].item.taskText,task.text);
});
test('reopening and completing again replaces one note, and editing a completed task preserves its completion date',()=>{
 const c=fixture();apply(c,c.taskWritePlan(task,{...task,status:'done'},now));
 const done=c.state.tasks[0];apply(c,c.taskWritePlan(done,{...done,text:'Revised summary'},'2026-11-01T10:00:00Z'));assert.equal(c.state.notes.length,1);assert.equal(c.state.notes[0].completedAt,now);
 apply(c,c.taskWritePlan(c.state.tasks[0],{...c.state.tasks[0],status:'todo'},'2026-11-02T10:00:00Z'));assert.equal(c.state.notes[0].status,'revoked');assert.equal(c.state.tasks[0].completedAt,'');
 apply(c,c.taskWritePlan(c.state.tasks[0],{...c.state.tasks[0],status:'done'},'2026-11-03T10:00:00Z'));assert.equal(c.state.notes.length,1);assert.equal(c.state.notes[0].status,'completed');assert.equal(c.state.notes[0].completedAt,'2026-11-03T10:00:00Z');
});
test('unlinked tasks and legacy completions never fabricate a case note or historical completion date',()=>{
 const c=fixture();assert.equal(c.taskWritePlan(task,{...task,relatedType:'',relatedId:'',status:'done'},now).length,1);
 const done={...task,status:'done'};assert.equal(c.taskWritePlan(done,{...done,text:'Rename only'},now).length,1);
 assert.throws(()=>c.taskWritePlan(task,{...task,status:'done',relatedId:'missing'},now));
});
test('changing a completed task association moves its single note without changing the completion date',()=>{
 const c=fixture();c.state.jobs.push({id:'j2'});apply(c,c.taskWritePlan(task,{...task,status:'done'},now));
 apply(c,c.taskWritePlan(c.state.tasks[0],{...c.state.tasks[0],relatedId:'j2'},'2026-11-01T10:00:00Z'));assert.equal(c.state.notes.length,1);assert.equal(c.state.notes[0].jobId,'j2');assert.equal(c.state.notes[0].completedAt,now);
});
test('failed atomic save leaves both local records untouched and allows retry',async()=>{
 const c=fixture();c.state.tasks=[task];const before=JSON.stringify(c.state);let writes;
 c.storeAdapter={writeRecords:async records=>{writes=records;throw Error('offline');}};
 await assert.rejects(c.persistTask({...task,status:'done'}),/offline/);assert.equal(writes.length,2);assert.equal(JSON.stringify(c.state),before);assert.equal(c.busy,false);
 c.storeAdapter.writeRecords=async()=>{};await c.persistTask({...task,status:'done'});assert.equal(c.state.tasks[0].status,'done');assert.equal(c.state.notes[0].status,'completed');
});
