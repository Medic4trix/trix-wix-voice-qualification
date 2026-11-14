import test from 'node:test';
import assert from 'node:assert/strict';
import {createSyntheticIntegratedWix} from '../qualification/trix-wix-synthetic-integration-fix-001.mjs';
const notice={artifact_id:'P0A-NATIVE-ORDINARY-CONVERSATION-NOTICE',version:'1.0',consent_version:'NATIVE-ORDINARY-CONVERSATION-v1',purpose:'ORDINARY_NATIVE_CONVERSATION',status:'COLLECTION_ENDPOINT_PREPARED',activation:{user_interface_enabled:false,runtime_gate_enabled:false,collection_endpoint_enabled:true},notice:Object.fromEntries(['ai_participation','scope','limits','human_help','withdrawal','material_change'].map(k=>[k,'Synthetic notice']))};
const session={session:{schema_version:'native.session.binding.v1',session_id:'s',session_state:'ACTIVE'},conversation:{schema_version:'native.conversation.binding.v1',session_id:'s',conversation_id:'c',state:'ACTIVE'}};
function harness({accepted=false, auth=true, fail=null, deferred=null, conflict=false, textResponse=null}={}){
 let current={status:accepted?'ACCEPTED':'NOT_ACCEPTED',active:accepted,revision:accepted?1:0};
 const views={}, calls=[];
 const view=(prefix,events)=>({render:m=>{views[prefix]=m},...Object.fromEntries(events.map(k=>[k,fn=>{views[prefix+k]=fn}]))});
 const ports={syntheticOnly:true,authenticate:async()=>auth?{authority:'HUMAN_COGNITO_VERIFIED',subject_ref:'synthetic',bearer:'synthetic-token'}:null,
 dispatch:async req=>{
 calls.push(req);
 if(deferred && req.path==='/v1/native/text-turns')return deferred.promise;
 if(fail && req.path===fail)return {status:403,body:{}};
 if(req.path==='/v1/native/bootstrap')return {status:200,body:session};
 if(req.path==='/v1/native/conversation-consent'&&req.method==='GET')return {status:200,body:{schema_version:'native.conversation.consent.read.v1',notice,current:{...current}}};
 if(req.path==='/v1/native/conversation-consent'&&req.method==='POST'){
  if(conflict || req.body.expected_revision!==current.revision)return {status:409,body:{}};
  current={status:req.body.action==='ACCEPT'?'ACCEPTED':'WITHDRAWN',active:req.body.action==='ACCEPT',revision:current.revision+1};
  return {status:200,body:{schema_version:'native.conversation.consent.v1',consent_version:notice.consent_version,...current}};
 }
 if(req.path==='/v1/native/text-turns')return {status:200,body:textResponse??{schema_version:'native.text.turn.response.v1',response_class:'NONCLINICAL',interaction_id:req.body.interaction_id,status:'processed',text:'Synthetic response'}};
 throw Error('UNEXPECTED_ROUTE');
 }};
 const app=createSyntheticIntegratedWix({ports,conversationView:view('conversation',['onStart','onSend','onClose']),consentView:view('consent',['onStart','onAccept','onDecline','onWithdraw','onClose']),ids:{next:()=>({message_id:'m',interaction_id:'i',idempotency_key:'k'})}});
 return {app,views,calls,current:()=>current};
}
test('absent consent blocks bootstrap; explicit accept then starts conversation',async()=>{
 const h=harness();await h.app.conversation.start();assert.equal(h.views.conversation.consentRequired,true);
 assert.equal(h.calls.some(x=>x.path==='/v1/native/bootstrap'),false);
 await h.app.consent.start();await h.app.consent.accept();assert.equal(h.views.consent.state,'ACCEPTED');
 await h.app.conversation.start();assert.equal(h.views.conversation.state,'READY');
 await h.app.conversation.send('Oi');assert.equal(h.views.conversation.message,'Synthetic response');
 assert.equal(h.calls.find(x=>x.path==='/v1/native/text-turns').headers['Idempotency-Key'],'k');
 h.app.close();
});
test('withdrawal prevents later text delivery',async()=>{
 const h=harness({accepted:true});await h.app.conversation.start();await h.app.consent.start();await h.app.consent.withdraw();
 await h.app.conversation.send('Oi');assert.equal(h.views.conversation.consentRequired,true);
 assert.equal(h.calls.some(x=>x.path==='/v1/native/text-turns'),false);h.app.close();
});
test('authentication failure blocks all HTTP',async()=>{const h=harness({auth:false});await h.app.conversation.start();assert.equal(h.views.conversation.state,'ERROR');assert.equal(h.calls.length,0);h.app.close()});
test('HTTP consent rejection blocks bootstrap',async()=>{const h=harness({fail:'/v1/native/conversation-consent'});await h.app.conversation.start();assert.equal(h.views.conversation.state,'ERROR');assert.equal(h.calls.some(x=>x.path==='/v1/native/bootstrap'),false);h.app.close()});
test('closing pending text discards late response',async()=>{
 let resolve;const deferred={promise:new Promise(r=>resolve=r)};const h=harness({accepted:true,deferred});
 await h.app.conversation.start();const pending=h.app.conversation.send('Oi');h.app.close();
 resolve({status:200,body:{schema_version:'native.text.turn.response.v1',response_class:'NONCLINICAL',interaction_id:'i',status:'processed',text:'late'}});
 await pending;assert.equal(h.views.conversation.state,'CLOSED');assert.equal(h.views.conversation.message,null);
});
test('transport is synthetic only',()=>assert.throws(()=>createSyntheticIntegratedWix({ports:{},conversationView:{},consentView:{}}),/SYNTHETIC_INTEGRATION_REQUIRED/));

test('revision conflict blocks consent and bootstrap',async()=>{
 const h=harness({conflict:true});await h.app.consent.start();await h.app.consent.accept();
 assert.equal(h.views.consent.state,'BLOCKED');
 assert.equal(h.calls.some(x=>x.path==='/v1/native/bootstrap'),false);h.app.close();
});
test('replayed receipt remains a receipt, not displayable clinical text',async()=>{
 const h=harness({accepted:true,textResponse:{schema_version:'native.text.turn.accepted.v1',interaction_id:'i',status:'replayed'}});
 await h.app.conversation.start();await h.app.conversation.send('Oi');
 assert.equal(h.views.conversation.state,'READY');assert.equal(h.views.conversation.message,null);h.app.close();
});
test('incompatible response fails closed',async()=>{
 const h=harness({accepted:true,textResponse:{schema_version:'native.text.turn.response.v1',interaction_id:'i',status:'processed',response_class:'CLINICAL',text:'Forbidden'}});
 await h.app.conversation.start();await h.app.conversation.send('Oi');
 assert.equal(h.views.conversation.state,'ERROR');assert.notEqual(h.views.conversation.message,'Forbidden');h.app.close();
});
