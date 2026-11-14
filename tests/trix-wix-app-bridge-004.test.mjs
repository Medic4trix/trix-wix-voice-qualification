import test from 'node:test';
import assert from 'node:assert/strict';
import {createSyntheticBridge, STATES} from '../qualification/trix-wix-app-bridge-004.mjs';

const identity = {authority:'HUMAN_COGNITO_VERIFIED', subject_ref:'synthetic-subject'};
const consent = {schema_version:'native.conversation.consent.read.v1',current:{status:'ACCEPTED',active:true}};
function ports(overrides={}) {
 return {syntheticOnly:true,authenticate:async()=>identity,readConsent:async()=>consent,
  bootstrap:async()=>({conversation_id:'synthetic-conversation',session_ref:'synthetic-session'}),
  sendText:async p=>({schema_version:'native.text.turn.response.v1',response_class:'NONCLINICAL',
    interaction_id:p.interaction_id,text:'Resposta sintética'}),...overrides};
}
test('requires synthetic ports and human authority',async()=>{
 assert.throws(()=>createSyntheticBridge({}),/SYNTHETIC_PORTS_REQUIRED/);
 const b=createSyntheticBridge(ports({authenticate:async()=>({authority:'WIX_INSTANCE',subject_ref:'x'})}));
 assert.equal((await b.start()).state,STATES.ERROR);
});
test('requires active canonical consent before bootstrap',async()=>{
 let called=false;
 const b=createSyntheticBridge(ports({readConsent:async()=>({...consent,current:{status:'WITHDRAWN',active:false}}),
 bootstrap:async()=>{called=true;return {};}}));
 assert.equal((await b.start()).state,STATES.CONSENT_REQUIRED);
 assert.equal(called,false);
});
test('binds synthetic session, rechecks consent and renders only nonclinical',async()=>{
 let turn;
 const b=createSyntheticBridge(ports({sendText:async p=>{turn=p;return {schema_version:'native.text.turn.response.v1',response_class:'NONCLINICAL',interaction_id:p.interaction_id,text:'OK'};}}));
 assert.equal((await b.start()).state,STATES.READY);
 const out=await b.send('Oi','interaction-1','idempotency-1');
 assert.equal(out.last.text,'OK');
 assert.equal(turn.conversation_id,'synthetic-conversation');
 assert.equal(turn.idempotency_key,'idempotency-1');
});
test('clinical content cannot be displayed without separate release',async()=>{
 const b=createSyntheticBridge(ports({sendText:async()=>({schema_version:'native.text.turn.response.v1',response_class:'CLINICAL_RELEASED',text:'não exibir'})}));
 await b.start();const out=await b.send('Oi','i','k');
 assert.equal(out.state,STATES.ERROR);assert.equal(typeof out.last,'string');
});
test('receipt is not mistaken for response',async()=>{
 const b=createSyntheticBridge(ports({sendText:async()=>({schema_version:'native.text.turn.accepted.v1',status:'accepted'})}));
 await b.start();const out=await b.send('Oi','i','k');
 assert.deepEqual(out.last,{kind:'RECEIPT',text:null});
});
test('consent withdrawal before send prevents dispatch',async()=>{
 let reads=0, sent=false;
 const b=createSyntheticBridge(ports({readConsent:async()=>++reads===1?consent:{...consent,current:{status:'WITHDRAWN',active:false}},sendText:async()=>{sent=true;}}));
 await b.start();assert.equal((await b.send('Oi','i','k')).state,STATES.CONSENT_REQUIRED);
 assert.equal(sent,false);
});
test('close invalidates pending asynchronous bootstrap',async()=>{
 let resolve;
 const b=createSyntheticBridge(ports({authenticate:()=>new Promise(r=>{resolve=r;})}));
 const pending=b.start();b.close();resolve(identity);await pending;
 assert.equal(b.snapshot().state,STATES.CLOSED);
});
