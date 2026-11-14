import test from 'node:test';
import assert from 'node:assert/strict';
import {createSyntheticWixPresenter} from '../qualification/trix-wix-app-bridge-005.mjs';
const binding=()=>({session:{schema_version:'native.session.binding.v1',session_id:'s',session_state:'ACTIVE'},conversation:{schema_version:'native.conversation.binding.v1',conversation_id:'c',session_id:'s',state:'ACTIVE'}});
function harness(overrides={}) {
 const renders=[],handlers={};let sent=0;
 const view={render:x=>renders.push(x),onStart:f=>handlers.start=f,onSend:f=>handlers.send=f,onClose:f=>handlers.close=f};
 const ports={syntheticOnly:true,authenticate:async()=>({authority:'HUMAN_COGNITO_VERIFIED',subject_ref:'person'}),readConsent:async()=>({schema_version:'native.conversation.consent.read.v1',current:{status:'ACCEPTED',active:true}}),bootstrap:async()=>binding(),sendText:async p=>{sent++;return {schema_version:'native.text.turn.response.v1',response_class:'NONCLINICAL',interaction_id:p.interaction_id,text:'Olá'};},...overrides};
 const presenter=createSyntheticWixPresenter({ports,view,ids:{next:()=>({message_id:'m',interaction_id:'i',idempotency_key:'k'})}});
 return {presenter,renders,handlers,get sent(){return sent}};
}
test('rejects non-synthetic UI authority',()=>assert.throws(()=>createSyntheticWixPresenter({ports:{},view:{},ids:{}}),/SYNTHETIC_UI_REQUIRED/));
test('initial idle and authenticated ready state',async()=>{const h=harness();assert.equal(h.renders.at(-1).state,'IDLE');await h.handlers.start();assert.equal(h.renders.at(-1).state,'READY');assert.equal(h.renders.at(-1).canSend,true);});
test('consent denial blocks send',async()=>{const h=harness({readConsent:async()=>({schema_version:'native.conversation.consent.read.v1',current:{status:'WITHDRAWN',active:false}})});await h.handlers.start();assert.equal(h.renders.at(-1).consentRequired,true);await h.handlers.send('Oi');assert.equal(h.sent,0);});
test('nonclinical text is rendered',async()=>{const h=harness();await h.handlers.start();await h.handlers.send('Oi');assert.equal(h.renders.at(-1).message,'Olá');assert.equal(h.sent,1);});
test('clinical response never renders',async()=>{const h=harness({sendText:async()=>({schema_version:'native.text.turn.response.v1',response_class:'CLINICAL_RELEASED',interaction_id:'i',text:'sensitive'})});await h.handlers.start();await h.handlers.send('Oi');assert.equal(h.renders.at(-1).state,'ERROR');assert.equal(h.renders.at(-1).message,null);});
test('receipt is not rendered as conversational text',async()=>{const h=harness({sendText:async()=>({schema_version:'native.text.turn.accepted.v1',status:'replayed',interaction_id:'i'})});await h.handlers.start();await h.handlers.send('Oi');assert.equal(h.renders.at(-1).receipt,true);assert.equal(h.renders.at(-1).message,null);});
test('close disables UI and further dispatch',async()=>{const h=harness();await h.handlers.start();h.handlers.close();await h.handlers.send('Oi');assert.equal(h.sent,0);assert.equal(h.renders.at(-1).state,'CLOSED');});
test('authentication error does not expose internal error',async()=>{const h=harness({authenticate:async()=>{throw Error('secret');}});await h.handlers.start();assert.equal(h.renders.at(-1).error,'OPERATION_UNAVAILABLE');assert.equal(JSON.stringify(h.renders).includes('secret'),false);});
