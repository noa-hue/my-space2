const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const {readFileSync}=require('node:fs');

function fixture(){
 const tasks=[{id:'a',area:'עבודה-לקוחות',status:'done',relatedId:'j1',notes:'Retained'},{id:'b',area:'בית',repeatRule:'weekly'}];
 const context={state:{tasks},CFG:{mode:'firebase'},busy:false,dayPlan:{},saveLabel:'',modal:{close(){}},render(){},toast(){}};
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
 assert.match(c.taskCategoryNavigation(),/data-id="contact-book" aria-pressed="false">הכרטסת/);
 assert.equal(c.taskAreaName({area:'contact-book'}),'שיווק › קשרים והפניות › הכרטסת');
 assert.equal(c.taskMatchesArea({area:'contact-book'},'referrals'),true);
 c.taskArea='previous-task-areas';
 assert.match(c.taskCategoryNavigation(),/סינון לפי שיוך קודם/);
 assert.equal(c.taskMatchesArea({area:'בית'},c.taskArea),true);
 assert.equal(c.taskMatchesArea({area:'personal'},c.taskArea),false);
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
