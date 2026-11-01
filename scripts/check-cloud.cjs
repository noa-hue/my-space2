const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..'),context={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'config.js'),'utf8'),context);
const c=context.window.NOA_CONFIG, rules=fs.readFileSync(path.join(root,'firestore.rules'),'utf8');
if(c?.mode!=='firebase'||!c.firebase?.projectId||!c.firebase?.apiKey||!c.firebase?.appId||!c.ownerUid||rules.includes('REPLACE_WITH_OWNER_UID')||!rules.includes(`request.auth.uid == '${c.ownerUid}'`)){console.error('Cloud deployment blocked: complete Firebase web config, owner UID, and matching Firestore rules first.');process.exit(1);}
if(c.firebase.projectId!=='noa-workspace-a4acc'){console.error('Unexpected Firebase project. Confirm the target before changing deployment configuration.');process.exit(1);}
console.log('Cloud configuration matches the designated Firebase project and owner.');
