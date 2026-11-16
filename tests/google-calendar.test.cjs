const {test}=require('node:test');const assert=require('node:assert/strict');const G=require('../src/google-calendar.cjs');const S=require('../src/scheduler.cjs');
const {readFileSync}=require('node:fs');
const vm=require('node:vm');
const C=require('../src/core.cjs');
const cal={id:'calendar',summary:'Test'};

test('calendar refresh shares one appointment between the weekly row and the case through moves and cancellations',async()=>{
 const event={id:'meeting',summary:'Example consultation',attendees:[{email:'client@example.com'}],
  start:{dateTime:'2026-11-17T09:00:00+02:00'},end:{dateTime:'2026-11-17T10:00:00+02:00'}};
 const unmatched={...event,id:'unknown',summary:'Unmatched event',attendees:[]};
 let events=[event,unmatched],writes=0;
 const context={
  taskMeetingSource:'task-meeting',GC:G,C:{...C,localDate:()=> '2026-11-15'},CFG:{ownerUid:'test'},
  state:{appointments:[],jobs:[{id:'job',contactId:'contact',stage:'progress'}],contacts:[{id:'contact',email:'client@example.com'}]},
  cloud:{auth:{currentUser:{email:'owner@example.com'}}},
  googleCalendar:{token:'test'},googlePages:async()=>events,
  storeAdapter:{saveClientMeetings:async items=>{writes+=items.length;return items.map(({next})=>next);}},
  document:{addEventListener(){},getElementById:()=>null},setInterval(){},
  page:'weekly',modal:{open:false},busy:false,dirty:false,dayPlan:null,render(){},
  jobName:()=> 'Example case',fmtDate:String,e:String,badge:String,btn:()=>''
 };
 vm.createContext(context);
 vm.runInContext(readFileSync(require.resolve('../src/client-meetings.fragment.js'),'utf8'),context);
 vm.runInContext("clientMeetingSync.calendarId='calendar'",context);
 await context.refreshClientMeetings();
 const id=context.state.appointments[0].id;
 assert.match(context.clientMeetingWeekRow(['2026-11-17']),/Example case.*09:00/);
 assert.match(context.caseClientMeetings('job'),/Example consultation/);
 assert.match(context.clientMeetingReview(['2026-11-17']),/Unmatched event/);
 await context.refreshClientMeetings();
 assert.equal(writes,1);

 events=[{...event,start:{dateTime:'2026-11-24T12:00:00+02:00'},end:{dateTime:'2026-11-24T13:00:00+02:00'}}];
 await context.refreshClientMeetings();
 assert.equal(context.state.appointments[0].id,id);
 assert.doesNotMatch(context.clientMeetingWeekRow(['2026-11-17']),/Example case/);
 assert.match(context.clientMeetingWeekRow(['2026-11-24']),/Example case.*12:00/);

 events=[{id:'meeting',status:'cancelled'}];
 await context.refreshClientMeetings();
 assert.equal(context.state.appointments.length,1);
 assert.equal(writes,3);
 assert.doesNotMatch(context.clientMeetingWeekRow(['2026-11-24']),/Example case/);
 assert.match(context.caseClientMeetings('job'),/בוטלה/);
});
test('Jerusalem day bounds follow summer, winter and DST transition lengths',()=>{
 assert.deepEqual(G.bounds('2026-07-01'),{timeMin:'2026-06-30T21:00:00.000Z',timeMax:'2026-07-01T21:00:00.000Z'});
 assert.deepEqual(G.bounds('2026-11-01'),{timeMin:'2026-10-31T22:00:00.000Z',timeMax:'2026-11-01T22:00:00.000Z'});
 for(const [day,hours] of [['2026-03-27',23],['2026-10-25',25]]){const b=G.bounds(day);assert.equal((Date.parse(b.timeMax)-Date.parse(b.timeMin))/3600000,hours);}
});
test('multi-day and exclusive all-day dates are clipped without booking past the final day',()=>{
 const ev={id:'a',start:{date:'2026-10-30'},end:{date:'2026-11-02'}};
 assert.equal(G.normalize(ev,cal,'2026-11-01').allDay,true);assert.equal(G.normalize(ev,cal,'2026-11-02'),null);
 const overnight={id:'b',start:{dateTime:'2026-10-31T23:00:00+02:00'},end:{dateTime:'2026-11-01T10:00:00+02:00'}};
 assert.equal(G.normalize(overnight,cal,'2026-11-01').start,'00:00');assert.equal(G.normalize(overnight,cal,'2026-11-01').end,'10:00');
});
test('cancelled and declined events are omitted, free and work-location events do not block planning',()=>{
 const base={id:'a',start:{dateTime:'2026-11-01T09:00:00+02:00'},end:{dateTime:'2026-11-01T10:00:00+02:00'}};
 assert.equal(G.normalize({...base,status:'cancelled'},cal,'2026-11-01'),null);
 assert.equal(G.normalize({...base,attendees:[{self:true,responseStatus:'declined'}]},cal,'2026-11-01'),null);
 for(const extra of [{transparency:'transparent'},{eventType:'workingLocation'}])assert.equal(G.normalize({...base,...extra},cal,'2026-11-01').busy,false);
 assert.equal(G.normalize({...base,htmlLink:'javascript:alert(1)'},cal,'2026-11-01').url,'');
});
test('busy Google meetings and all-day events prevent overlapping task proposals',()=>{
 const date='2026-11-01',task={id:'t',text:'Task',estimatedMinutes:60};
 const busy=G.normalize({id:'b',start:{dateTime:date+'T09:00:00+02:00'},end:{dateTime:date+'T10:00:00+02:00'}},cal,date);
 assert.equal(S.planDay({date,start:'09:00',end:'12:00',buffer:0,appointments:[busy],tasks:[task]}).scheduled[0].start,'10:00');
 const all=G.normalize({id:'a',start:{date},end:{date:'2026-11-02'}},cal,date);
 assert.equal(S.planDay({date,appointments:[all],tasks:[task]}).scheduled.length,0);
});
test('client meetings only auto-match a single active case using an external attendee email',()=>{
 const contacts=[{id:'c',email:'client@example.com'},{id:'o',email:'owner@example.com'}];
 const jobs=[{id:'j',contactId:'c',stage:'progress'},{id:'owner',contactId:'o',stage:'lead'}];
 const event={attendees:[{email:'owner@example.com'},{email:'CLIENT@example.com'}]};
 assert.equal(G.matchClientMeeting(event,jobs,contacts,'owner@example.com'),'j');
 assert.equal(G.matchClientMeeting(event,[...jobs,{id:'other',contactId:'c',stage:'waiting'}],contacts,'owner@example.com'),'');
 assert.equal(G.matchClientMeeting({...event,visibility:'private'},jobs,contacts,'owner@example.com'),'');
 assert.equal(G.matchClientMeeting({summary:'client@example.com'},jobs,contacts,'owner@example.com'),'');
});
test('a moved or cancelled client meeting retains one event identity without calendar descriptions or money',()=>{
 const event={id:'evt',summary:'Client meeting',description:'Private event description',
  start:{dateTime:'2026-11-22T22:30:00Z'},end:{dateTime:'2026-11-22T23:30:00Z'}};
 const saved=G.clientMeetingRecord(event,'example/calendar','j',null,'email');
 assert.equal(saved.date,'2026-11-23');
 assert.equal(saved.start,'00:30');
 assert.equal(saved.id.includes('/'),false);
 assert.equal(Object.hasOwn(saved,'description'),false);
 assert.equal(Object.hasOwn(saved,'amountCents'),false);
 const moved=G.clientMeetingRecord({...event,start:{dateTime:'2026-11-29T22:30:00Z'},end:{dateTime:'2026-11-29T23:30:00Z'}},'example/calendar','j',saved,'email');
 assert.equal(moved.id,saved.id);
 assert.equal(moved.date,'2026-11-30');
 const cancelled=G.clientMeetingRecord({id:'evt',status:'cancelled'},'example/calendar','',moved,'');
 assert.equal(cancelled.id,saved.id);
 assert.equal(cancelled.status,'cancelled');
 assert.equal(cancelled.jobId,'j');
});
