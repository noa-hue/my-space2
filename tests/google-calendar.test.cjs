const {test}=require('node:test');const assert=require('node:assert/strict');const G=require('../src/google-calendar.cjs');const S=require('../src/scheduler.cjs');
const cal={id:'calendar',summary:'Test'};
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
