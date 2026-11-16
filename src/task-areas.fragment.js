const taskGroups={
 marketing:{name:'שיווק',kind:'marketing'},
 voice:{name:'הקול שלי',parent:'marketing',kind:'writing'},
 newsletter:{name:'ניוזלטר',parent:'voice'},
 networks:{name:'רשתות חברתיות',parent:'voice'},
 podcast:{name:'פודקאסט',parent:'voice'},
 book:{name:'הספר',parent:'voice'},
 referrals:{name:'קשרים והפניות',parent:'marketing'},
 development:{name:'פיתוח ולמידה',kind:'bizdev'},
 agreements:{name:'הסכמות בארגונים',parent:'development'},
 apps:{name:'פיתוח אפליקציות',parent:'development'},
 clients:{name:'לקוחות',kind:'admin'},
 operations:{name:'ניהול שוטף',kind:'admin'},
 personal:{name:'אישי',kind:'personal'}
};

function taskAreaKey(task){return task.area==='עבודה'?'עבודה-לקוחות':task.area||'עבודה-אחר';}
function getTaskAreaPath(key){
 const path=[];
 while(Object.hasOwn(taskGroups,key)){
  path.unshift(key);
  key=taskGroups[key].parent;
 }
 return path;
}
function taskAreaLabel(key){const path=getTaskAreaPath(key);return path.length?path.map(area=>taskGroups[area].name).join(' › '):key;}
function taskAreaName(task){return taskAreaLabel(taskAreaKey(task));}
function taskMatchesArea(task,key){const area=taskAreaKey(task);return !key||area===key||getTaskAreaPath(area).includes(key);}
function taskAreaOptions(existing=[]){
 const options=Object.entries(taskGroups).map(([key,group])=>[key,group.parent?taskGroups[group.parent].name+' › '+group.name:group.name]);
 return Object.fromEntries([...options,...existing.filter(key=>key&&!Object.hasOwn(taskGroups,key)).map(key=>[key,key])]);
}
function calendarKindForTask(task){
 const area=taskAreaKey(task);
 const group=getTaskAreaPath(area).reverse().find(key=>taskGroups[key].kind);
 if(group)return taskGroups[group].kind;
 if(area==='הקול שלי')return 'writing';
 if(['עבודה-שיווק','שיווק-הפצה','קשרים'].includes(area))return 'marketing';
 if(['בית','פרטי'].includes(area))return 'personal';
 return area==='עבודה-אחר'?'bizdev':'admin';
}

function openTaskAreaBulk(){
 const tasks=visibleTasks();
 if(!tasks.length){toast('אין משימות לסימון בתצוגה הנוכחית.');return;}
 showDialog('שיוך קבוצתי',form('task-area-bulk','',
  select('קטגוריה או פרויקט','area','',{'':'בחרי שיוך',...taskAreaOptions()})+
  `<fieldset class="task-area-checklist"><legend>משימות לשיוך</legend>${tasks.map(task=>
  `<label class="checkline"><input type="checkbox" name="taskId" value="${e(task.id)}"><span>${e(task.text)}<br><small class="muted">${e(taskAreaName(task))}</small></span></label>`
  ).join('')}</fieldset>`));
}

async function submitTaskAreaBulk(data){
 const area=data.get('area');
 const ids=new Set(data.getAll('taskId'));
 if(!Object.hasOwn(taskGroups,area)||!ids.size)throw Error('בחרי קטגוריה או פרויקט וסמני לפחות משימה אחת.');
 const tasks=state.tasks.filter(task=>ids.has(task.id));
 if(tasks.length!==ids.size)throw Error('רשימת המשימות השתנתה. פתחי שוב את השיוך הקבוצתי.');
 const changed=tasks.filter(task=>task.area!==area);
 if(changed.length>400)throw Error('אפשר לשייך עד 400 משימות בכל שמירה.');
 busy=true;
 const adapter=storeAdapter;
 try{
  if(changed.length)await adapter.assignTaskArea(changed,area);
  if(adapter!==storeAdapter)return;
  const selectedIds=new Set(changed.map(task=>task.id));
  state.tasks=state.tasks.map(task=>selectedIds.has(task.id)?{...task,area}:task);
  saveLabel=CFG.mode==='demo'?'נשמר בדפדפן הזה':'נשמר בענן';
  dayPlan=null;
  modal.close();render();
  toast(changed.length?`השיוך עודכן ל־${changed.length} משימות.`:'המשימות כבר משויכות לשם.');
 }finally{busy=false;}
}

async function assignCloudTaskArea(api,db,uid,tasks,area){
 await api.runTransaction(db,async transaction=>{
  const refs=tasks.map(task=>api.doc(db,'users',uid,'tasks',task.id));
  const stored=await Promise.all(refs.map(ref=>transaction.get(ref)));
  if(stored.some((snapshot,i)=>!snapshot.exists()||snapshot.data().area!==tasks[i].area))
   throw Error('אחד השיוכים השתנה. פתחי שוב את השיוך הקבוצתי.');
  for(const ref of refs)transaction.update(ref,{area});
 });
}
