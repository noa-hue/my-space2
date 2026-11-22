const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const {readFileSync}=require('node:fs');

function fixture(){
 const tasks=[{id:'a',area:'עבודה-לקוחות',status:'done',relatedId:'j1',notes:'Retained'},{id:'b',area:'בית',repeatRule:'weekly'}];
 const context={state:{tasks},CFG:{mode:'firebase'},busy:false,dayPlan:{},saveLabel:'',modal:{close(){}},render(){},toast(){},taskStatus:task=>task.status||'todo'};
 vm.createContext(context);
 vm.runInContext(readFileSync('src/task-areas.fragment.js','utf8'),context);
 return context;
}

test('a project matches its parent categories while older assignments remain accessible',()=>{
 const c=fixture(),newsletter={area:'newsletter'};
 assert.equal(c.taskAreaName(newsletter),'שיווק › הקול שלי › ניוזלטר');
 assert.equal(c.taskMatchesArea(newsletter,'voice'),true);
 assert.equal(c.taskMatchesArea(newsletter,'marketing'),true);
 assert.equal(c.taskMatchesArea(newsletter,'networks'),false);
 assert.equal(c.taskMatchesArea({area:'clients'},'marketing'),false);
 assert.equal(c.taskMatchesArea({area:'עבודה'},'עבודה-לקוחות'),true);
 assert.equal(c.taskAreaOptions(['legacy value'])['legacy value'],'legacy value');
 assert.equal(c.calendarKindForTask(newsletter),'writing');
 assert.equal(c.calendarKindForTask({area:'בית'}),'personal');
});

test('bulk assignment keeps other fields and leaves local state intact when saving fails',async()=>{
 const c=fixture();
 const values={get:()=> 'clients',getAll:()=>['a','a']};
 const before=JSON.stringify(c.state);
 c.storeAdapter={assignTaskArea:async()=>{throw Error('offline');}};
 await assert.rejects(c.submitTaskAreaBulk(values),/offline/);
 assert.equal(JSON.stringify(c.state),before);
 assert.equal(c.busy,false);
 c.storeAdapter.assignTaskArea=async(tasks,area)=>{assert.equal(tasks.length,1);assert.equal(area,'clients');};
 await c.submitTaskAreaBulk(values);
 assert.deepEqual({...c.state.tasks[0]},{id:'a',area:'clients',status:'done',relatedId:'j1',notes:'Retained'});
 assert.equal(c.state.tasks[1].repeatRule,'weekly');
 assert.equal(c.state.tasks[1].area,'בית');
});

test('the cloud transaction patches only the area and rejects a concurrent reassignment',async()=>{
 const c=fixture(),task=c.state.tasks[0],writes=[];
 let current=task;
 const transaction={get:async()=>({exists:()=>true,data:()=>current}),update:(...args)=>writes.push(args)};
 const api={doc:(_db,...path)=>path.join('/'),runTransaction:async(_db,action)=>action(transaction)};
 await c.assignCloudTaskArea(api,{},'user',[task],'clients');
 assert.equal(writes.length,1);
 assert.equal(writes[0][0],'users/user/tasks/a');
 assert.deepEqual({...writes[0][1]},{area:'clients'});
 current={...task,area:'operations'};
 await assert.rejects(c.assignCloudTaskArea(api,{},'user',[task],'clients'),/השתנה/);
 assert.equal(writes.length,1);
});

test('categories are visible first and projects appear for the selected family',()=>{
 const c=fixture();
 Object.assign(c,{e:String,taskArea:'',taskView:'open',query:'',taskPriority:''});
 const overview=c.taskCategoryNavigation();
 assert.match(overview,/הקול שלי|לקוחות/);
 assert.match(overview,/שיוכים קודמים/);
 assert.doesNotMatch(overview,/ניוזלטר|עבודה-לקוחות/);
 c.taskArea='newsletter';
 assert.match(c.taskCategoryNavigation(),/data-id="newsletter" aria-pressed="true"/);
 assert.doesNotMatch(c.taskCategoryNavigation(),/הסכמות בארגונים/);
 c.taskArea='referrals';
 const referralsNavigation=c.taskCategoryNavigation();
 assert.match(referralsNavigation,/data-id="contact-book" aria-pressed="false">הכרטסת/);
 assert.match(referralsNavigation,/data-id="collaborations" aria-pressed="false">שיתופי פעולה/);
 assert.doesNotMatch(referralsNavigation,/כל משימות השיווק/);
 c.taskArea='operations';
 assert.match(c.taskCategoryNavigation(),/data-id="paid-marketing" aria-pressed="false">שיווק ממומן/);
 assert.equal(c.taskAreaOptions()['paid-marketing'],'ניהול שוטף › שיווק ממומן');
 assert.equal(c.taskMatchesArea({area:'paid-marketing'},'operations'),true);
 c.taskArea='previous-task-areas';
 c.state.tasks.push({id:'another-legacy',area:'עבודה-למידה',status:'todo'});
 assert.match(c.taskCategoryNavigation(),/סינון לפי שיוך קודם/);
 assert.equal(c.taskMatchesArea({area:'בית'},c.taskArea),true);
 assert.equal(c.taskMatchesArea({area:'personal'},c.taskArea),false);
});

test('completed legacy tasks stay accessible without keeping retired categories in navigation',()=>{
 const c=fixture();
 Object.assign(c,{e:String,taskArea:'',taskView:'open',query:'',taskPriority:'',tasksHtml:tasks=>tasks.map(task=>task.id).join(',')});
 c.state.tasks=[{id:'completed',area:'עבודה-שיווק',status:'done'}];
 const before=JSON.stringify(c.state.tasks);
 for(const view of ['open','done','all']){
  c.taskView=view;
  assert.doesNotMatch(c.taskCategoryNavigation(),/שיוכים קודמים/);
 }
 assert.equal(c.taskMatchesArea(c.state.tasks[0],''),true);
 assert.match(c.taskListByCategory(c.state.tasks),/completed/);
 assert.equal(JSON.stringify(c.state.tasks),before);
 c.state.tasks[0].status='todo';
 assert.match(c.taskCategoryNavigation(),/שיוכים קודמים/);
});

test('referrals is independent of marketing and contains the contact book and collaborations',()=>{
 const c=fixture(),options=c.taskAreaOptions();
 assert.equal(options.referrals,'קשרים והפניות');
 assert.equal(options['contact-book'],'קשרים והפניות › הכרטסת');
 assert.equal(options.collaborations,'קשרים והפניות › שיתופי פעולה');
 for(const area of ['referrals','contact-book','collaborations']){
  assert.equal(c.taskAreaName({area}),options[area]);
  assert.equal(c.taskMatchesArea({area},'referrals'),true);
  assert.equal(c.taskMatchesArea({area},'marketing'),false);
  assert.equal(c.calendarKindForTask({area}),'marketing');
 }
 assert.equal(c.taskMatchesArea({area:'contact-book'},'collaborations'),false);
});

test('open tasks are grouped once and previous assignments stay in a separate expandable section',()=>{
 const c=fixture();
 Object.assign(c,{e:String,taskArea:'',taskView:'open',query:'',taskPriority:'',tasksHtml:tasks=>tasks.map(task=>`<p>${task.id}</p>`).join('')});
 const tasks=[{id:'writing',area:'newsletter'},{id:'general-marketing',area:'marketing'},{id:'legacy',area:'עבודה-שיווק'},{id:'client',area:'clients'}];
 const markup=c.taskListByCategory(tasks);
 assert.equal((markup.match(/<p>writing<\/p>/g)||[]).length,1);
 assert.match(markup,/<h2>הקול שלי<\/h2><p>writing<\/p>/);
 assert.match(markup,/<details[^>]*><summary>שיוכים קודמים.*?<p>legacy<\/p><\/details>/);
 assert.equal(c.taskRowAreaName(tasks[0]),'ניוזלטר');
 c.taskView='today';
 assert.match(c.taskListByCategory(tasks),/^<section class="panel">/);
 assert.doesNotMatch(c.taskListByCategory(tasks),/<details/);
});

test('task editing and creation render the selected category alongside the notes field',()=>{
 const c=fixture();
 const app=readFileSync('src/app.js','utf8');
 let dialog;
 Object.assign(c,{page:'tasks',taskArea:'contact-book',today:'2026-11-16',e:String,taskStatuses:{},priorities:{},NoaRecurrence:{rules:{}},
  taskStatus:()=> 'todo',taskPlannedDate:()=>'',relationOptions:()=>({}),field:()=>'',
  select:(_label,key,value)=>key==='area'?`<select data-area="${value}"></select>`:'',
  area:(_label,key,value)=>`<textarea name="${key}">${value}</textarea>`,
  form:(_type,_id,body)=>body,showDialog:(_title,html)=>{dialog=html;}});
 vm.runInContext(app.slice(app.indexOf('function editTask('),app.indexOf('function capture(')),c);
 c.editTask('a');
 assert.match(dialog,/data-area="עבודה-לקוחות"/);
 assert.match(dialog,/<textarea name="notes">Retained<\/textarea>/);
 c.editTask('');
 assert.match(dialog,/data-area="contact-book"/);
 assert.match(dialog,/<textarea name="notes"><\/textarea>/);
});
