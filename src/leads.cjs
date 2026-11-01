(function(root){'use strict';
const statuses={new:'פנייה חדשה',contacted:'אחרי שיחה ראשונית',waiting:'ממתינה להמשך',meeting:'נקבעה פגישה',closed:'לא ממשיכים',converted:'הפכה לתיק לקוח'};
function isOpen(x){return !['closed','converted'].includes(x.leadStatus);}
function followup(x,day){if(!isOpen(x)||x.reminderEnabled===false)return '';if(!x.nextDate||!x.nextAction)return 'missing';return x.nextDate<day?'overdue':x.nextDate===day?'today':'';}
function whatsapp(phone){let n=String(phone||'').replace(/[\s()-]/g,'');if(/^05\d{8}$/.test(n))n='972'+n.slice(1);else if(/^\+\d{7,15}$/.test(n))n=n.slice(1);else if(!/^972\d{9}$/.test(n))return '';return 'https://wa.me/'+n;}
function validate(x,validDate){if(!x.name?.trim())throw Error('יש להזין שם לפנייה');if(!Object.hasOwn(statuses,x.leadStatus))throw Error('מצב הפנייה אינו תקין');if(!validDate(x.date)||x.nextDate&&!validDate(x.nextDate))throw Error('יש לבדוק את תאריכי הפנייה והחזרה');if(x.leadStatus==='closed'&&!x.closeReason?.trim())throw Error('כדאי לציין מדוע הפנייה נסגרה');return x;}
function conversion(lead,{service,contactId},state,now){
 if(lead.jobId){const found=state.jobs.find(x=>x.id===lead.jobId);if(!found)throw Error('התיק המקושר אינו זמין. יש לבדוק את השיוך.');return {records:[],jobId:found.id};}
 if(lead.leadStatus==='closed')throw Error('יש לפתוח את הפנייה מחדש לפני העברה לתיק');if(!service?.trim())throw Error('יש לציין את השירות בתיק');
 const jobId='lead-job-'+lead.id,newContactId='lead-contact-'+lead.id,records=[];
 if(state.jobs.some(x=>x.id===jobId)||state.contacts.some(x=>x.id===newContactId))throw Error('קיימת רשומה מקושרת שדורשת בדיקה לפני יצירת תיק נוסף');
 if(contactId&&!state.contacts.some(c=>c.id===contactId))throw Error('איש הקשר שנבחר אינו זמין');
 if(!contactId){contactId=newContactId;records.push({type:'contacts',item:{id:contactId,name:lead.name,phone:lead.phone||'',email:'',tags:['לקוחות'],ambassador:false,interest:lead.inquiry||'',lastContact:lead.date,subscription:'unknown',nextAction:'',nextDate:'',notes:'נוצר מהפנייה '+lead.id,createdAt:now,updatedAt:now}});}
 const notes=['מקור הפנייה: '+(lead.source||'לא צוין'),'מי הפנה: '+(lead.referrer||'לא צוין'),lead.inquiry||'',lead.summary||''].filter(Boolean).join('\n');
 records.push({type:'jobs',item:{id:jobId,name:lead.name,contactId,service:service.trim(),stage:'lead',agreedCents:0,nextAction:lead.nextAction||'',nextDate:lead.nextDate||'',notes,sourceLeadId:lead.id,createdAt:now,updatedAt:now}});
 records.push({type:'notes',item:{...lead,leadStatus:'converted',jobId,contactId,convertedAt:now,updatedAt:now,history:[...(lead.history||[]),{at:now,status:'converted',action:'נפתח תיק לקוח',nextDate:''}]}});
 return {records,jobId};
}
const api={statuses,isOpen,followup,whatsapp,validate,conversion};if(typeof module==='object'&&module.exports)module.exports=api;else root.NoaLeads=api;
})(typeof globalThis!=='undefined'?globalThis:this);
