const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const {readFileSync}=require('node:fs');
const {webcrypto}=require('node:crypto');
const C={...require('../src/core.cjs'),...require('../src/scheduler.cjs')};
const GC=require('../src/google-calendar.cjs');

const task={id:'t',text:'Arrange a meeting',relatedType:'job',relatedId:'j',status:'todo'};
const date='2026-11-29';
function values(extra=[]){return new Map([['meetingDate',date],['meetingStart','12:00'],['meetingEnd','13:00'],...extra]);}
function fixture(){
 const writes=[];
 const context={C,GC,crypto:webcrypto,TextEncoder,CFG:{mode:'firebase'},googleWriteToken:'token',busy:false,
  state:{tasks:[task],notes:[],appointments:[],jobs:[{id:'j',name:'Example case'}]},
  storeAdapter:{writeRecords:async records=>{writes.push(records);},saveClientMeetings:async items=>items.map(x=>x.next)},
  taskStatus:t=>t.status||'todo',saveLabel:'',dayPlan:{},$:()=>null,googleDayEvents:()=>[],calendarDay:date,
  document:{addEventListener(){}},setInterval(){},jobName:()=> 'Example case',fmtDate:String,e:String,badge:String};
 vm.createContext(context);
 for(const file of ['task-completion','client-meetings','task-meeting'])vm.runInContext(readFileSync(`src/${file}.fragment.js`,'utf8'),context);
 return {context,writes};
}

test('saving from a task commits its completion, case note and one shared scheduled appointment',async()=>{
 const {context:c,writes}=fixture();
 await assert.rejects(c.saveTaskMeeting(task,task,values([['meetingEnd','11:30']])),/שעת סיום/);
 assert.equal(writes.length,0);
 const meeting=await c.saveTaskMeeting({...task,notes:'Meeting arranged'},task,values());
 assert.equal(c.state.tasks[0].meetingId,meeting.id);
 assert.equal(c.state.tasks[0].status,'done');
 assert.equal(c.state.tasks[0].notes,'Meeting arranged');
 assert.equal(c.state.notes[0].jobId,'j');
 assert.equal(writes[0].length,3);
 assert.equal(c.savedDayAppointments([])[0].id,meeting.id);
 assert.match(c.caseClientMeetings('j'),/Example case.*12:00–13:00/);
 assert.match(c.clientMeetingWeekRow([date]),/Example case.*12:00/);
 const done=c.state.tasks[0];
 await c.saveTaskMeeting(done,done,values([['meetingStart','12:30']]));
 assert.equal(c.state.appointments.length,1);
 assert.equal(c.state.appointments[0].id,meeting.id);
 assert.equal(c.state.appointments[0].start,'12:30');
});

test('Google export is private, keeps local data on failure, and reuses the same event after a lost response',async()=>{
 const {context:c}=fixture();
 let remote,attempts=0;
 c.googleGet=async (path,params,options)=>{
  if(path==='users/me/calendarList/primary')return {id:'calendar@example.com',accessRole:'owner'};
  if(!options.body)return remote;
  const {body}=options;
  assert.equal(params.sendUpdates,'none');
  assert.equal(body.visibility,'private');
  assert.equal(body.summary,'פגישה');
  assert.equal(Object.hasOwn(body,'attendees'),false);
  assert.match(body.id,/^[0-9a-v]{5,1024}$/);
  if(attempts++){
   assert.equal(body.id,remote.id);
   throw Object.assign(Error('already exists'),{httpStatus:409});
  }
  remote={...body,start:{dateTime:date+'T12:00:00+02:00'},end:{dateTime:date+'T13:00:00+02:00'}};
  throw Error('network response lost');
 };
 const withGoogle=values([['meetingGoogle','on']]);
 await assert.rejects(c.saveTaskMeeting(task,task,withGoogle),/הפגישה נשמרה במרחב/);
 assert.equal(c.state.tasks[0].done,true);
 assert.equal(c.state.appointments.length,1);
 const done=c.state.tasks[0];
 await c.saveTaskMeeting(done,done,withGoogle);
 const linked=c.state.appointments[0];
 assert.equal(linked.id,done.meetingId);
 assert.equal(linked.googleEventId,remote.id);
 assert.equal(c.savedDayAppointments([]).length,0);
 assert.equal(c.displayedGoogleMeetings().length,1);
 const moved=c.clientMeetingItem({...remote,start:{dateTime:date+'T14:00:00+02:00'},end:{dateTime:date+'T15:00:00+02:00'}},linked.calendarId,linked);
 assert.equal(moved.id,linked.id);
 assert.equal(moved.sourceTaskId,task.id);
 assert.equal(moved.title,'פגישה עם Example case');
 assert.equal(moved.start,'14:00');
});
