'use strict';
// Run only through firebase emulators:exec with project demo-noa-workspace.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
if(process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8089')throw Error('Tests require the isolated local Firestore emulator');
const scope={window:{}};vm.runInNewContext(fs.readFileSync('config.js','utf8'),scope);const uid=scope.window.NOA_CONFIG.ownerUid;
const project='demo-noa-workspace',base='http://127.0.0.1:8089/v1/projects/'+project+'/databases/(default)/documents/';
function token(who,verified=true,provider='google.com'){
 const now=Math.floor(Date.now()/1000),b=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
 return b({alg:'none',typ:'JWT'})+'.'+b({iss:'https://securetoken.google.com/'+project,aud:project,sub:who,user_id:who,iat:now,exp:now+3600,auth_time:now,email:'test@example.invalid',email_verified:verified,firebase:{identities:{},sign_in_provider:provider}})+'.';
}
async function request(path,{auth,method='GET',id='qa'}={}){const headers={};if(auth)headers.Authorization='Bearer '+auth;const init={method,headers};if(method==='PATCH'){headers['Content-Type']='application/json';init.body=JSON.stringify({fields:{id:{stringValue:id},text:{stringValue:'Emulator test only'}}});}return fetch(base+path,init);}
(async()=>{
 const owner=token(uid),other=token('different-user'),path='users/'+uid+'/tasks/qa';
 assert.equal((await request(path,{auth:owner,method:'PATCH'})).status,200,'owner write');
 assert.equal((await request(path,{auth:owner})).status,200,'owner read');
 for(const [label,auth] of [['anonymous',null],['different user',other],['unverified owner',token(uid,false)],['password provider',token(uid,true,'password')]]){
  assert.equal((await request(path,{auth})).status,403,label+' read denied');
  assert.equal((await request(path,{auth,method:'PATCH'})).status,403,label+' write denied');
 }
 assert.equal((await request('users/different-user/tasks/qa',{auth:owner,method:'PATCH'})).status,403,'other namespace denied');
 assert.equal((await request('users/'+uid+'/unknown/qa',{auth:owner,method:'PATCH'})).status,403,'unknown collection denied');
 assert.equal((await request(path,{auth:owner,method:'PATCH',id:'mismatch'})).status,403,'record id mismatch denied');
 assert.equal((await request(path,{auth:owner,method:'DELETE'})).status,200,'owner delete');
 const summaryPath='users/'+uid+'/weeklySummaries/actual_2026-10-11';
 assert.equal((await request(summaryPath,{auth:owner,method:'PATCH',id:'actual_2026-10-11'})).status,200,'owner summary write');
 assert.equal((await request(summaryPath,{auth:owner})).status,200,'owner summary read');
 for(const auth of [null,other,token(uid,false),token(uid,true,'password')]){
  assert.equal((await request(summaryPath,{auth})).status,403,'summary read denied');
  assert.equal((await request(summaryPath,{auth,method:'PATCH',id:'actual_2026-10-11'})).status,403,'summary write denied');
 }
 assert.equal((await request('users/different-user/weeklySummaries/actual_2026-10-11',{auth:owner,method:'PATCH',id:'actual_2026-10-11'})).status,403,'other summary namespace denied');
 assert.equal((await request(summaryPath,{auth:owner,method:'PATCH',id:'different'})).status,403,'summary id mismatch denied');
 assert.equal((await request(summaryPath,{auth:owner,method:'DELETE'})).status,200,'owner summary delete');
 console.log('PASS: owner access and 21 denied access attempts; emulator only');
})().catch(err=>{console.error(err);process.exitCode=1;});
