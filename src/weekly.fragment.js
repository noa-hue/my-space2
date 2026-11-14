const ledgerLabels={planned:'תכנון',actual:'ביצוע'};
function weeklySets(){return (mode==='both'?['planned','actual']:[mode]).map(status=>({status,rows:C.weekly(state.events,start,status,state.weeklySummaries)}));}
function weeklyLeads(days){
 const byDate=new Map(days.map(date=>[date,[]]));
 for(const lead of leadRecords())byDate.get(lead.date)?.push(lead);
 const cells=[...byDate.values()];
 return {cells,leads:cells.flat()};
}
function leadCounts(leads,field,fallback){
 const groups=new Map();
 for(const lead of leads){
  const label=lead[field]?.trim();
  if(!label&&!fallback)continue;
  const key=label?.toLocaleLowerCase('he')||'';
  const group=groups.get(key)||{label:label||fallback,count:0};
  group.count++;
  groups.set(key,group);
 }
 return [...groups.values()].sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label,'he'));
}
function weeklyLeadRow({cells,leads}){
 const dailyCells=cells.map(cell=>`<td><strong>${cell.length}</strong>${cell.map(lead=>{
  const attribution=[lead.source?.trim(),lead.referrer?.trim()].filter(Boolean).join(' · ');
  return `<button class="event-item" data-action="lead-edit" data-id="${e(lead.id)}">${e(lead.name)}<span class="weekly-lead-source">${e(attribution||'מקור לא צוין')}</span></button>`;
 }).join('')}</td>`).join('');
 return `<tr class="metric-row-leads"><th scope="row">פניות חדשות (לידים)<span class="ledger-status ledger-status-actual">ביצוע · כמות</span></th>${dailyCells}<td class="total">${leads.length} פניות</td></tr>`;
}
function weeklyLeadBreakdown(leads){
 const sources=leadCounts(leads,'source','מקור לא צוין');
 const referrers=leadCounts(leads,'referrer');
 const items=groups=>`<ul>${groups.map(({label,count})=>`<li><span>${e(label)}</span><strong>${count}</strong></li>`).join('')}</ul>`;
 return `<section class="panel section-space weekly-lead-breakdown">
  <h2>מאיפה הגיעו הפניות השבוע</h2>
  ${leads.length?`<div class="grid2">
   <div><h3>מקור הפנייה</h3>${items(sources)}</div>
   <div><h3>מי הפנה</h3>${referrers.length?items(referrers):'<p class="small muted">לא צוין מפנה בפניות השבוע.</p>'}</div>
  </div>`:'<p class="small muted">לא נרשמו פניות בשבוע הזה.</p>'}
 </section>`;
}
function weekly(){
 const sets=weeklySets(),days=Array.from({length:7},(_,i)=>C.shiftDate(start,i));
 const leadReport=mode==='planned'?null:weeklyLeads(days);
 const waiting=mode==='planned'?[]:state.events.filter(ev=>ev.kind==='payment'&&ev.status==='actual'&&!ev.verified&&ev.date>=start&&ev.date<=days[6]);
 const summaryButtons=mode==='both'?btn('סיכום תכנון','weekly-summary-edit','planned')+btn('סיכום ביצוע','weekly-summary-edit','actual'):btn('סיכום לשבוע','weekly-summary-edit',mode);
 const tableRows=Object.keys(C.kinds).flatMap(kind=>sets.map(set=>({status:set.status,...set.rows.find(r=>r.kind===kind)})));
 return pageHead('הטבלה השבועית','פניות חדשות לפי תאריך קבלתן, והזמנות, שירות וגבייה לפי מועד הפעולה.',`<div class="toolbar">${leadReport?btn('+ פנייה חדשה','weekly-lead-new'):''}${summaryButtons}${btn('+ פעולה לטבלה','event-edit','','primary')}</div>`)+
 `<div class="toolbar"><div class="week-controls">${btn('→','week-prev')}<span class="week-label">${fmtDate(start)}–${fmtDate(days[6])} · ${start.slice(0,4)}</span>${btn('←','week-next')}</div><label class="small" for="week-picker">מעבר לשבוע</label><input id="week-picker" type="date" aria-label="בחירת תאריך בתוך השבוע" value="${start}">${Object.entries({both:'תכנון וביצוע',actual:'ביצוע',planned:'תכנון'}).map(([value,label])=>`<button class="chip ${mode===value?'active':''}" data-action="ledger-mode" data-id="${value}" aria-pressed="${mode===value}">${label}</button>`).join('')}${btn('ייצוא לאקסל (CSV)','weekly-export')}${btn('הדפסה','print')}</div>`+
 (mode==='both'?'<p class="ledger-help">הזמנות, שירות וגבייה מוצגים בתכנון ובביצוע. פניות נספרות לפי תאריך קבלתן.</p>':'')+
 sets.map(({status,rows})=>{const summary=rows[0].summary;return summary?`<section class="weekly-source"><div class="spaced"><div><strong>סיכום שבועי מהמקור · ${ledgerLabels[status]}</strong><p>${e(summary.source||'סיכום שהוזן ידנית')}${summary.sourceUrl?` · <a href="${e(summary.sourceUrl)}" target="_blank" rel="noopener noreferrer">פתיחת המקור</a>`:''}</p></div>${btn('עריכת סיכום '+ledgerLabels[status],'weekly-summary-edit',status)}</div><p>הסכומים בעמודת ״סה״כ שבועי״ הם הסיכומים שנקלטו ואושרו. הפעולות היומיות מוצגות כפירוט שלהם, בלי להוסיף אותן שוב לסכום השבועי.</p>${summary.note?`<p class="small muted">${e(summary.note)}</p>`:''}</section>`:'';}).join('')+
 `<div class="table-wrap"><table class="weekly-table"><caption class="sr-only">${mode==='both'?'השוואת תכנון וביצוע':ledgerLabels[mode]} לשבוע ${fmtDate(start)}–${fmtDate(days[6])}</caption><thead><tr><th scope="col">מדד / יום</th>${days.map((d,i)=>`<th scope="col">${['א׳','ב׳','ג׳','ד׳','ה׳','ו׳','ש׳'][i]}<div class="small muted">${fmtDate(d)}</div></th>`).join('')}<th scope="col">סה״כ שבועי</th></tr></thead><tbody>${leadReport?weeklyLeadRow(leadReport):''}${tableRows.map(r=>`<tr class="metric-row-${r.kind} ledger-row-${r.status}"><th scope="row">${e(C.kinds[r.kind])}<span class="ledger-status ledger-status-${r.status}">${ledgerLabels[r.status]}</span></th>${r.cells.map(cell=>`<td>${cell.map(ev=>`<button class="event-item" data-action="event-edit" data-id="${e(ev.id)}" aria-label="${e(ledgerLabels[r.status]+' · '+jobName(ev.jobId)+' · '+money(ev.amountCents))}">${e(jobName(ev.jobId))}<strong>${money(ev.amountCents)}</strong></button>`).join('')||'<span class="muted">—</span>'}</td>`).join('')}<td class="total">${money(r.total)}${r.summary?'<div class="small summary-total-label">סיכום שאושר</div>':''}</td></tr>`).join('')}</tbody></table></div>`+
 (leadReport?weeklyLeadBreakdown(leadReport.leads):'')+
 sets.map(({status,rows})=>rows[0].summary?`<section class="panel section-space"><h2>השלמת הפירוט היומי · ${ledgerLabels[status]}</h2><p class="small muted">סיכום שבועי אינו משייך הכנסה ללקוח או ליום מסוים. אפשר להוסיף פעולות לפי התאריכים והשמות במקור ולהיעזר בהשוואה כאן.</p>${rows.map(r=>`<div class="summary-detail ${r.difference<0?'summary-conflict':''}"><strong>${e(C.kinds[r.kind])}</strong><span>פורטו ${money(r.dailyTotal)} מתוך ${money(r.sourceTotal)}</span><span>${r.difference===0?'הפירוט תואם לסיכום':r.difference>0?'נותרו לפירוט '+money(r.difference):'הפירוט גבוה מהסיכום ב־'+money(-r.difference)+' · יש לבדוק'}</span></div>`).join('')}</section>`:'').join('')+
 `<div class="callout">כל הסכומים לפני מע״מ. הזמנות, שירות וגבייה מוצגים כמדדים נפרדים בתכנון ובביצוע. ערך השירות מוזן ידנית.</div>${waiting.length?`<section class="panel section-space"><h2>תשלומים שממתינים לאימות</h2>${waiting.map(ev=>`<div class="activity spaced"><span>${e(jobName(ev.jobId))} · ${money(ev.amountCents)} · ${fmtDate(ev.date)}</span>${btn('בדיקה ועדכון','event-edit',ev.id)}</div>`).join('')}</section>`:''}`;
}
function editWeeklySummary(requestedStatus){
 const status=['actual','planned'].includes(requestedStatus)?requestedStatus:mode==='planned'?'planned':'actual';
 const id=C.summaryId(start,status),s=state.weeklySummaries.find(x=>x.id===id)||{};
 const amount=(label,name,value)=>`<div class="field"><label for="summary-${name}">${label}</label><input id="summary-${name}" name="${name}" type="number" min="0" step="0.01" required value="${value===undefined?'':value/100}"></div>`;
 showDialog((s.id?'עריכת סיכום שבועי':'סיכום לשבוע קודם')+' · '+ledgerLabels[status],form('weeklySummaries',id,`<p class="form-description">השבוע ${fmtDate(start)}–${fmtDate(C.shiftDate(start,6))} · ${start.slice(0,4)} · ${ledgerLabels[status]}. הסכומים הם לשבוע כולו, לפני מע״מ; הם לא יירשמו כפעולות ביום מסוים.</p><input type="hidden" name="start" value="${start}"><input type="hidden" name="status" value="${status}"><div class="grid3">${amount('הזמנות שנסגרו','orderAmount',s.orderCents)}${amount('שירות שניתן','productionAmount',s.productionCents)}${amount('גבייה','paymentAmount',s.paymentCents)}</div>${status==='actual'?`<label class="checkline"><input type="checkbox" name="paymentVerified" ${s.paymentVerified?'checked':''}>מאשרת שסכום הגבייה התקבל בפועל</label>`:''}${field('מקור הסיכום','source',s.source||'','text',true)}${field('קישור למקור, אם יש','sourceUrl',s.sourceUrl||'','url')}${area('הערה לסיכום','note',s.note||'')}<p class="small muted">אפשר להוסיף ולערוך פירוט יומי בהמשך. הסיכום והפעולות לא ייספרו פעמיים.</p>`));
 // A new summary already has a canonical id, but is not an existing record to delete.
 if(!s.id)$('#record-form [data-action="delete"]')?.remove();
}
function exportWeekly(){
 const end=C.shiftDate(start,6);
 const output=[['סוג רשומה','תחילת שבוע','סיום שבוע','תאריך פעולה','תיק','מדד','סכום פעולה לפני מע״מ','סכום שבועי לפני מע״מ','הפרש להשלמת פירוט','מצב','הערה','מספר פניות','מקור הפנייה','מי הפנה'],
 ...weeklySets().flatMap(({status,rows})=>[
 ...rows.map(r=>[r.summary?'סיכום שבועי מאושר':'סיכום מחושב מהפעולות',start,end,'','',C.kinds[r.kind],'',(r.total/100).toFixed(2),r.difference===null?'':(r.difference/100).toFixed(2),ledgerLabels[status],r.summary?.source||'','','','']),
 ...rows.flatMap(r=>r.cells.flat()).map(ev=>['פירוט פעולה',start,end,ev.date,jobName(ev.jobId),C.kinds[ev.kind],(ev.amountCents/100).toFixed(2),'','',ledgerLabels[status],ev.note||'','','',''])])];
 if(mode!=='planned'){
  const days=Array.from({length:7},(_,i)=>C.shiftDate(start,i));
  const {leads}=weeklyLeads(days);
  const label='פניות חדשות (לידים)';
  output.push(['סיכום פניות',start,end,'','',label,'','','',ledgerLabels.actual,'',leads.length,'','']);
  output.push(...leads.map(lead=>['פירוט פנייה',start,end,lead.date,lead.name,label,'','','',ledgerLabels.actual,'',1,lead.source||'מקור לא צוין',lead.referrer||'']));
 }
 download(`noa-week-${start}-${mode}.csv`,C.csv(output),'text/csv;charset=utf-8');
}
