(function(root){
 'use strict';
 const statuses={open:'פתוח למעקב',expected:'ממתין להעברה',end:'לתשלום בסיום',meeting:'לתשלום במפגש',settled:'נסגר'};
 const bases={net:'לפני מע״מ',gross:'כולל מע״מ',unknown:'מע״מ לא צוין'};
 function validate(c){
  if(!c||!c.id||!Number.isSafeInteger(c.balanceCents)||c.balanceCents<0||c.balanceCents>1e11||!Object.hasOwn(statuses,c.status)||!Object.hasOwn(bases,c.basis))throw Error('יש להזין יתרה, בסיס סכום ומצב גבייה תקינים');
  for(const k of ['requestedCents','confirmedCents','referralCents'])if(c[k]!==null&&c[k]!==undefined&&(!Number.isSafeInteger(c[k])||c[k]<0||c[k]>1e11))throw Error('סכום במעקב הגבייה אינו תקין');
  for(const k of ['dueDate','lastRequestDate'])if(c[k]&&!root.BusinessCore.validDate(c[k]))throw Error('תאריך במעקב הגבייה אינו תקין');
  if(c.status==='settled'&&c.balanceCents!==0)throw Error('אפשר לסגור מעקב רק כשהיתרה היא אפס');
  return c;
 }
 function balance(job,events,excludeId=''){
  const c=job.collection;if(!c)return null;
  const paid=events.filter(x=>x.id!==excludeId&&x.jobId===job.id&&x.collectionId===c.id&&x.kind==='payment'&&x.status==='actual'&&x.verified===true&&Number.isSafeInteger(x.collectionAmountCents)&&x.collectionAmountCents>0).reduce((n,x)=>n+x.collectionAmountCents,0);
  return c.balanceCents-paid;
 }
 function paymentLink(job,events,event,amount){
  const c=job?.collection;
  if(!c||job.id!==event.jobId||event.kind!=='payment'||event.status!=='actual'||event.verified!==true)throw Error('אפשר להפחית יתרה רק מתשלום שהתקבל ואומת, בתיק עם מעקב גבייה');
  if(event.collectionId&&event.collectionId!==c.id)throw Error('התשלום כבר נכלל בעדכון יתרה קודם; אפשר לתקן את היתרה העדכנית במעקב הגבייה');
  const applied=amount===null&&c.basis==='net'?event.amountCents:amount;
  if(!Number.isSafeInteger(applied)||applied<=0)throw Error('יש להזין את הסכום להפחתה מהיתרה, בהתאם לבסיס הסכום במעקב');
  if(applied>balance(job,events,event.id))throw Error('הסכום להפחתה גבוה מהיתרה הפתוחה; יש לבדוק או לעדכן את היתרה תחילה');
  return {...event,collectionId:c.id,collectionAmountCents:applied};
 }
 const api={statuses,bases,validate,balance,paymentLink};root.NoaCollections=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
