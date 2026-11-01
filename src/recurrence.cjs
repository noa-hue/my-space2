(function(root){
'use strict';
const rules={daily:'כל יום',weekly:'כל שבוע',monthly:'כל חודש'};
function shift(day,n){const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
function monthDate(start,offset){const [y,m,d]=start.split('-').map(Number),first=new Date(Date.UTC(y,m-1+offset,1,12)),last=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0,12)).getUTCDate();return new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth(),Math.min(d,last),12)).toISOString().slice(0,10);}
function occurrence(t,day){const start=t.repeatStart;if(!rules[t.repeatRule]||!/^\d{4}-\d{2}-\d{2}$/.test(start||''))return '';if(day<start)return start;if(t.repeatRule==='daily')return day;if(t.repeatRule==='weekly'){const n=Math.floor((Date.parse(day+'T12:00:00Z')-Date.parse(start+'T12:00:00Z'))/604800000);return shift(start,n*7);}const [y,m]=day.split('-').map(Number),[sy,sm]=start.split('-').map(Number);let n=(y-sy)*12+m-sm;let key=monthDate(start,n);if(key>day)key=monthDate(start,--n);return key;}
function status(t,day){const key=occurrence(t,day);if(!key)return t.status||(t.done?'done':'todo');if(t.repeatCompletions?.[key])return 'done';return ['waiting','review'].includes(t.status)?t.status:'todo';}
function planned(t,day){return occurrence(t,day)||t.plannedDate||'';}
function project(t,day){if(!rules[t.repeatRule])return t;const s=status(t,day);return {...t,status:s,done:s==='done',plannedDate:planned(t,day),due:''};}
function complete(t,desired,day,now){const key=occurrence(t,day);if(!key||(key>day&&desired==='done'))throw Error('אפשר לסמן ביצוע רק מהמועד הראשון של המשימה החוזרת.');const map={...t.repeatCompletions};if(desired==='done')map[key]=map[key]||now;else delete map[key];return {...t,status:desired,done:desired==='done',repeatCompletions:map};}
const api={rules,occurrence,status,planned,project,complete};if(typeof module==='object'&&module.exports)module.exports=api;else root.NoaRecurrence=api;
})(typeof globalThis!=='undefined'?globalThis:this);
