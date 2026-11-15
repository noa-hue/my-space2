const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const C=require('../src/core.cjs');
function fixture(mode='both'){
 const events=[
  {id:'planned-order',jobId:'j',kind:'order',status:'planned',date:'2026-10-13',amountCents:80000},
  {id:'actual-order',jobId:'j',kind:'order',status:'actual',date:'2026-10-13',amountCents:60000},
  {id:'unverified-payment',jobId:'j',kind:'payment',status:'actual',date:'2026-10-14',amountCents:45000,verified:false},
  {id:'planned-payment',jobId:'j',kind:'payment',status:'planned',date:'2026-10-14',amountCents:90000}
 ];
 const weeklySummaries=[{id:'actual_2026-10-11',start:'2026-10-11',status:'actual',orderCents:120000,productionCents:0,paymentCents:0,paymentVerified:false,source:'Test fixture'}];
 const ctx={clientMeetingWeekRow:()=>'<tr><th scope="row">פגישות לקוחות</th></tr>',clientMeetingReview:()=>'',C,mode,start:'2026-10-11',state:{events,weeklySummaries,notes:[]},leadRecords:()=>ctx.state.notes.filter(n=>n.recordType==='lead'),e:String,jobName:()=> 'Example case',money:n=>String(n/100),fmtDate:s=>s,pageHead:()=>'',btn:(label,action,id='')=>`<button data-action="${action}" data-id="${id}">${label}</button>`,field:()=>'',area:()=>'',form:(_type,_id,body)=>body,$:()=>null,showDialog:(title,html)=>{ctx.dialog={title,html};},download:(name,data)=>{ctx.output={name,data};}};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync(require.resolve('../src/weekly.fragment.js'),'utf8'),ctx);return ctx;
}
test('combined view keeps daily plans, actuals, source totals and pending payments distinct without mutations',()=>{
 const ctx=fixture(),before=JSON.stringify(ctx.state),html=ctx.weekly();
 assert.equal((html.match(/scope="row"/g)||[]).length,8);
 assert.match(html,/data-id="planned-order"/);assert.match(html,/data-id="actual-order"/);
 assert.match(html,/סיכום שבועי מהמקור · ביצוע/);assert.match(html,/השלמת הפירוט היומי · ביצוע/);
 assert.match(html,/תשלומים שממתינים לאימות/);
 const rows=ctx.weeklySets();assert.equal(rows[0].rows[0].total,80000);assert.equal(rows[1].rows[0].total,120000);
 assert.equal(rows[1].rows[2].total,0);assert.equal(rows[0].rows[2].total,90000);
 assert.equal(JSON.stringify(ctx.state),before);
});
test('single-mode views and exports exclude the other mode; combined CSV never merges totals',()=>{
 const ctx=fixture();ctx.exportWeekly();const csv=ctx.output.data,lines=csv.split('\r\n');
 assert.match(csv,/"800.00".*"תכנון"/);assert.match(csv,/"1200.00".*"ביצוע"/);
 assert.equal(lines.filter(l=>l.startsWith('"פירוט פעולה"')).length,3);
 assert.doesNotMatch(csv,/"450.00"/);
 ctx.mode='actual';let html=ctx.weekly();assert.doesNotMatch(html,/data-id="planned-order"/);assert.match(html,/data-id="actual-order"/);
 ctx.mode='planned';html=ctx.weekly();assert.doesNotMatch(html,/data-id="actual-order"/);assert.doesNotMatch(html,/תשלומים שממתינים לאימות/);
 ctx.exportWeekly();assert.doesNotMatch(ctx.output.data,/"ביצוע"/);
});
test('summary editing in the combined view always targets an explicit valid status',()=>{
 const ctx=fixture();ctx.editWeeklySummary('planned');assert.match(ctx.dialog.html,/name="status" value="planned"/);assert.doesNotMatch(ctx.dialog.html,/name="paymentVerified"/);
 ctx.editWeeklySummary('actual');assert.match(ctx.dialog.html,/name="status" value="actual"/);assert.match(ctx.dialog.html,/name="paymentVerified"/);
 ctx.editWeeklySummary('');assert.match(ctx.dialog.html,/name="status" value="actual"/);assert.doesNotMatch(ctx.dialog.html,/value="both"/);
});
test('weekly leads use the original inquiry date and count closed and converted inquiries once',()=>{
 const ctx=fixture();
 ctx.state.notes=[
  {id:'first',recordType:'lead',date:'2026-10-11',name:'Example lead one',source:' WhatsApp ',referrer:'Example referrer',leadStatus:'new'},
  {id:'converted',recordType:'lead',date:'2026-10-17',name:'Example lead two',source:'whatsapp',referrer:'Example referrer',leadStatus:'converted',jobId:'j'},
  {id:'closed',recordType:'lead',date:'2026-10-17',name:'Example lead three',leadStatus:'closed'},
  {id:'next-week',recordType:'lead',date:'2026-10-18',name:'Next week'},
  {id:'previous-week',recordType:'lead',date:'2026-10-10',name:'Previous week'},
  {id:'other-note',recordType:'media',date:'2026-10-11',name:'Reading list entry'}
 ];
 const html=ctx.weekly();
 assert.match(html,/data-id="first"/);
 assert.match(html,/data-id="converted"/);
 assert.match(html,/data-id="closed"/);
 assert.match(html,/3 פניות/);
 assert.match(html,/<span>WhatsApp<\/span><strong>2<\/strong>/);
 assert.match(html,/<span>Example referrer<\/span><strong>2<\/strong>/);
 assert.match(html,/<span>מקור לא צוין<\/span><strong>1<\/strong>/);
 assert.doesNotMatch(html,/Next week|Previous week|Reading list entry/);
 ctx.exportWeekly();
 assert.match(ctx.output.data,/"סיכום פניות".*"ביצוע","","3"/);
 assert.match(ctx.output.data,/"פירוט פנייה".*"ביצוע","","1","whatsapp","Example referrer"/);
 ctx.mode='actual';
 assert.match(ctx.weekly(),/3 פניות/);
 ctx.mode='planned';
 assert.doesNotMatch(ctx.weekly(),/metric-row-leads|מאיפה הגיעו הפניות השבוע/);
 ctx.exportWeekly();
 assert.doesNotMatch(ctx.output.data,/"סיכום פניות"|"פירוט פנייה"/);
});
