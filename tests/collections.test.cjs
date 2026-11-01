const {test}=require('node:test'),assert=require('node:assert/strict');
require('../src/core.cjs');const R=require('../src/collections.cjs');
const collection={id:'snapshot-a',balanceCents:800000,basis:'net',status:'open',requestedCents:500000,confirmedCents:null,referralCents:50000,dueDate:'',lastRequestDate:''};
const job={id:'j',collection},payment={id:'p',jobId:'j',kind:'payment',status:'actual',verified:true,amountCents:200000,date:'2026-10-29'};
test('balances use only linked verified receipts and do not infer debt from production, contracts or old payments',()=>{
 const linked=R.paymentLink(job,[],payment,null);
 const events=[linked,{...payment,id:'old'},{...linked,id:'planned',status:'planned'},{...linked,id:'unverified',verified:false},{...linked,id:'service',kind:'production'},{...linked,id:'other',jobId:'other'}];
 assert.equal(R.balance(job,events),600000);assert.equal(R.balance({id:'other'},events),null);assert.equal(job.collection.referralCents,50000);
});
test('correcting, un-verifying or removing a linked payment reverses its exact balance effect',()=>{
 const linked=R.paymentLink(job,[],payment,null);assert.equal(R.balance(job,[{...linked,collectionAmountCents:100000}]),700000);assert.equal(R.balance(job,[{...linked,verified:false}]),800000);assert.equal(R.balance(job,[]),800000);
 const updated=R.paymentLink(job,[linked],{...payment,amountCents:300000},null);assert.equal(R.balance(job,[updated]),500000);
});
test('rebasing an explicitly updated outstanding balance never subtracts prior receipts twice',()=>{
 const linked=R.paymentLink(job,[],payment,null),current=R.balance(job,[linked]);
 const rebased={...job,collection:{...collection,id:'snapshot-b',balanceCents:current}};
 assert.equal(R.balance(rebased,[linked]),600000);const next=R.paymentLink(rebased,[linked],{...payment,id:'next'},null);assert.equal(R.balance(rebased,[linked,next]),400000);
 assert.throws(()=>R.paymentLink(rebased,[linked],linked,null));
});
test('VAT bases are explicit and gross or unspecified balances require an explicit reduction amount',()=>{
 for(const basis of ['gross','unknown']){const j={...job,collection:{...collection,basis}};assert.throws(()=>R.paymentLink(j,[],payment,null));const event=R.paymentLink(j,[],payment,236000);assert.equal(event.amountCents,200000);assert.equal(R.balance(j,[event]),564000);}
});
test('unverified, planned, wrong-case and excessive deductions are rejected',()=>{
 assert.throws(()=>R.paymentLink(job,[],{...payment,verified:false},null));assert.throws(()=>R.paymentLink(job,[],{...payment,status:'planned'},null));assert.throws(()=>R.paymentLink(job,[],{...payment,jobId:'x'},null));assert.throws(()=>R.paymentLink(job,[],payment,900000));
});
test('collection validation accepts zero closure and rejects malformed money, dates and statuses',()=>{
 assert.equal(R.validate({...collection,balanceCents:0,status:'settled'}).balanceCents,0);for(const patch of [{balanceCents:-1},{basis:'auto'},{status:'settled'},{dueDate:'2026-02-30'},{referralCents:0.5}])assert.throws(()=>R.validate({...collection,...patch}));
});
