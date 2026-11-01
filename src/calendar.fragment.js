function calendarPage(){
 const fixed=[...state.appointments,...googleDayEvents()].filter(x=>x.date===calendarDay).sort((a,b)=>a.start.localeCompare(b.start));
 const proposal=dayPlan?.date===calendarDay?dayPlan:null;
 const merged=[...fixed.map(x=>({...x,proposal:false})),...(proposal?.scheduled||[]).map(x=>({title:x.task.text,start:x.start,end:x.end,kind:calendarKindForTask(x.task),proposal:true,sourceTaskId:x.task.id}))].sort((a,b)=>a.start.localeCompare(b.start));
 const dayNames=new Intl.DateTimeFormat('he-IL',{weekday:'long'}).format(new Date(calendarDay+'T12:00:00Z'));
 return pageHead('היומן שלי','פגישות, זמן לכתיבה והמשימות שיש להן מקום ביום.',btn('+ פגישה או זמן שמור','appointment-edit','','primary'))+
 `<div class="toolbar"><div class="week-controls">${btn('→','day-prev')}<input id="calendar-date" type="date" aria-label="תאריך היומן" value="${e(calendarDay)}">${btn('←','day-next')}${btn('היום','day-today')}</div><span class="small muted">${dayNames} · ${fixed.length} פריטים שמורים</span></div>`+
 `${googlePanel()}<div class="calendar-legend">${Object.entries(calendarKinds).map(([v,label])=>`<span class="calendar-key cal-${v}">${label}</span>`).join('')}</div>`+
 `<div class="calendar-layout"><section class="panel"><div class="panel-head"><h2>${dayNames}, ${fmtDate(calendarDay)}</h2>${badge(googleCalendar.token?'Google והזמנים שלי':'הזמנים שלי','sand')}</div><div class="schedule-list">${merged.map(x=>`<div class="schedule-row"><div class="schedule-time"><strong>${x.allDay?'כל היום':e(x.start)}</strong><span>${x.allDay?'':e(x.end)}</span></div><div class="schedule-block cal-${e(x.kind)} ${x.proposal?'proposed':''}"><div class="spaced"><strong>${e(x.title)}</strong>${x.proposal?badge('הצעה'):x.google?badge('Google'):btn('עריכה','appointment-edit',x.id,'text')}</div><p>${x.google?e(x.calendarName)+(x.busy?' · עסוק':' · פנוי')+(x.url?' · <a href="'+e(x.url)+'" target="_blank" rel="noopener noreferrer">פתיחה ב־Google</a>':''):e(calendarKinds[x.kind])+' · '+(C.minute(x.end)-C.minute(x.start))+' דקות'+(x.sourceTaskId?' · משימה מקושרת':'')}</p></div></div>`).join('')||empty('היום עדיין פתוח','אפשר להוסיף פגישה או לשמור זמן לכתיבה, לשיווק ולפיתוח עסקי.')}</div></section>`+
 `<section class="panel planner-panel"><h2>לבנות יום שאפשר לעמוד בו</h2><p class="small muted section-space">ההצעה מתעדפת משימות לפי דחיפות ואחריה דדליין. נכללות משימות שנבחרו ליום הזה או שמועדן הגיע, בלי להזיז פגישות וזמנים שמורים.</p><div class="grid2 section-space"><div class="field"><label for="work-start">תחילת יום</label><input type="time" id="work-start" value="${e(workStart)}"></div><div class="field"><label for="work-end">סיום יום</label><input type="time" id="work-end" value="${e(workEnd)}"></div></div><div class="field"><label for="plan-buffer">מרווח מעבר בדקות</label><input type="number" id="plan-buffer" min="0" max="60" value="${planBuffer}"></div><label class="checkline"><input type="checkbox" id="include-undated" ${includeUndated?'checked':''}>לכלול גם משימות פתוחות ללא תאריך</label>${btn('להציע לו״ז ליום הזה','plan-day','','primary')}`+
 `${proposal?`<div class="plan-result"><strong>${proposal.scheduled.length} משימות · ${proposal.totalMinutes} דקות</strong><p class="small muted">הבלוקים המקווקווים הם הצעה. הם נשמרים רק בלחיצה על ״לשמור את ההצעה״.</p>${proposal.scheduled.length?btn('לשמור את ההצעה ביומן','plan-accept','','primary'):''}</div><h3 class="section-title">מה לא שובץ?</h3>${proposal.skipped.filter(x=>!['already','inactive','parent','future'].includes(x.reason)).map(x=>`<div class="activity"><strong>${e(x.task.text)}</strong><p class="small muted">${x.reason==='duration'?'חסרה הערכת זמן':'לא נמצא חלון זמן רציף שמתאים למשימה'}</p>${btn('לעדכן משימה','task-edit',x.task.id,'text')}</div>`).join('')||'<p class="small muted">כל המשימות שנבחרו ושיש להן הערכת זמן שובצו.</p>'}`:''}</section></div>`+
 `<div class="callout">החיבור מציג את יומני Google שבחרת ומתחשב בהם בתכנון היום. עריכת פגישות Google נעשית ב־Google Calendar; זמנים ומשימות שנשמרים כאן נשארים באפליקציה. לאחר סגירת הדף ייתכן שיידרש חיבור מחדש.</div>`;
}
function calendarKindForTask(t){const a=taskAreaName(t);return a==='הקול שלי'?'writing':['עבודה-שיווק','שיווק-הפצה','קשרים'].includes(a)?'marketing':['בית','פרטי'].includes(a)?'personal':a==='עבודה-אחר'?'bizdev':'admin';}
function editAppointment(id){const x=state.appointments.find(a=>a.id===id)||{};showDialog(id?'עריכת זמן ביומן':'פגישה או זמן שמור',form('appointments',id,field('כותרת','title',x.title,'text',true)+select('סוג זמן','kind',x.kind||'meeting',calendarKinds)+field('תאריך','date',x.date||calendarDay,'date',true)+`<div class="grid2">${field('משעה','start',x.start||'09:00','time',true)}${field('עד שעה','end',x.end||'10:00','time',true)}</div>`+area('הערות','notes',x.notes||'')+`<p class="small muted">זהו רישום ביומן האפליקציה בלבד. לא נשלחת הזמנה למשתתפים.</p>`));}
async function proposeDay(){
 if(busy)return;
 if(CFG.mode!=='demo')await ensureGoogleForPlanning();
 const tasks=state.tasks.map(t=>NoaRecurrence.project(t,calendarDay)).filter(t=>includeUndated||t.plannedDate===calendarDay||t.due&&t.due<=calendarDay);
 dayPlan={date:calendarDay,...C.planDay({date:calendarDay,start:workStart,end:workEnd,buffer:planBuffer,appointments:planningAppointments(),tasks})};render();
}
async function acceptDayPlan(){
 if(!dayPlan||dayPlan.date!==calendarDay||busy)return;
 // Recompute against the latest records to avoid booking over newly added blocks.
 const priorPlan=dayPlan;
 if(CFG.mode!=='demo')await ensureGoogleForPlanning();
 dayPlan=priorPlan;
 const wanted=new Set(dayPlan.scheduled.map(x=>x.task.id));
 const fresh=C.planDay({date:calendarDay,start:workStart,end:workEnd,buffer:planBuffer,appointments:planningAppointments(),tasks:state.tasks.map(t=>NoaRecurrence.project(t,calendarDay)).filter(t=>wanted.has(t.id))});
 if(JSON.stringify(fresh.scheduled.map(x=>[x.task.id,x.start,x.end]))!==JSON.stringify(dayPlan.scheduled.map(x=>[x.task.id,x.start,x.end]))){dayPlan={date:calendarDay,...fresh};render();toast('הנתונים השתנו. ההצעה עודכנה; כדאי לבדוק אותה שוב.');return;}
 if(fresh.scheduled.length>400)throw Error('יש לבחור פחות משימות ליום אחד');
 const records=fresh.scheduled.map(x=>({id:'task-'+x.task.id+'-'+calendarDay,title:x.task.text,date:calendarDay,start:x.start,end:x.end,kind:calendarKindForTask(x.task),sourceTaskId:x.task.id,notes:'נוסף מתוך הצעת הלו״ז שאושרה',createdAt:new Date().toISOString()}));
 if(!records.length)return;
 await persistBatch('appointments',records);dayPlan=null;render();toast('ההצעה נשמרה ביומן האפליקציה.');
}
async function persistBatch(type,items){
 if(busy)throw Error('יש שמירה שמתבצעת כרגע');busy=true;
 try{await storeAdapter.setMany(type,items);for(const item of items)state[type]=C.upsert(state[type],item);saveLabel=CFG.mode==='demo'?'נשמר בדפדפן הזה':'נשמר בענן';}finally{busy=false;}
}
