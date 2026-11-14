import test from 'node:test';
import assert from 'node:assert/strict';
import {createSyntheticConsentPresenter} from '../qualification/trix-wix-app-bridge-007-consent.mjs';

const canonical = () => ({
  schema_version:'native.conversation.consent.read.v1',
  notice:{artifact_id:'P0A-NATIVE-ORDINARY-CONVERSATION-NOTICE',version:'1.0',
    consent_version:'NATIVE-ORDINARY-CONVERSATION-v1',purpose:'ORDINARY_NATIVE_CONVERSATION',
    status:'COLLECTION_ENDPOINT_PREPARED',
    activation:{runtime_gate_enabled:false,collection_endpoint_enabled:true,user_interface_enabled:false},
    notice:Object.fromEntries(['ai_participation','scope','limits','human_help','withdrawal','material_change'].map(k=>[k,'Canonical '+k]))},
  current:{status:'NOT_ACCEPTED',revision:0,active:false,context_reference:null}
});
function setup(overrides={}) {
  let data=canonical(), last, calls=[], callbacks={};
  const ports={syntheticOnly:true,authenticate:async()=>true,readConsent:async()=>structuredClone(data),
    writeConsent:async({action,expected_revision})=>{
      calls.push({action,expected_revision});
      data.current={status:action==='ACCEPT'?'ACCEPTED':'WITHDRAWN',revision:expected_revision+1,active:action==='ACCEPT',context_reference:'synthetic'};
      return {schema_version:'native.conversation.consent.v1',consent_version:'NATIVE-ORDINARY-CONVERSATION-v1',...data.current};
    },...overrides};
  const view={render:x=>last=x,onStart:f=>callbacks.start=f,onAccept:f=>callbacks.accept=f,
    onDecline:f=>callbacks.decline=f,onWithdraw:f=>callbacks.withdraw=f,onClose:f=>callbacks.close=f};
  return {presenter:createSyntheticConsentPresenter({ports,view}),callbacks,get last(){return last},calls,setData:x=>data=x};
}
test('absence requires explicit acceptance; no automatic write',async()=>{
  const s=setup(); await s.presenter.start();
  assert.equal(s.last.state,'CONSENT_REQUIRED');assert.equal(s.calls.length,0);
  assert.equal(s.last.canAccept,true);assert.equal(s.last.canWithdraw,false);
});
test('accept sends revision and re-reads canonical state',async()=>{
  const s=setup();await s.presenter.start();await s.presenter.accept();
  assert.deepEqual(s.calls,[{action:'ACCEPT',expected_revision:0}]);
  assert.equal(s.last.state,'ACCEPTED');assert.equal(s.last.canWithdraw,true);
});
test('withdraw requires existing acceptance and re-reads',async()=>{
  const s=setup();await s.presenter.start();await s.presenter.withdraw();
  assert.equal(s.calls.length,0);await s.presenter.accept();await s.presenter.withdraw();
  assert.deepEqual(s.calls[1],{action:'WITHDRAW',expected_revision:1});
  assert.equal(s.last.state,'CONSENT_REQUIRED');assert.equal(s.last.current.status,'WITHDRAWN');
});
test('decline is local and never records acceptance',async()=>{
  const s=setup();await s.presenter.start();s.presenter.decline();
  assert.equal(s.last.state,'DECLINED');assert.equal(s.calls.length,0);
  await s.presenter.accept();assert.equal(s.calls.length,0);
});
test('authentication rejection blocks notice and writes',async()=>{
  const s=setup({authenticate:async()=>false});await s.presenter.start();
  assert.equal(s.last.state,'BLOCKED');assert.equal(s.last.notice,null);
  await s.presenter.accept();assert.equal(s.calls.length,0);
});
test('revision conflict fails closed',async()=>{
  const s=setup({writeConsent:async()=>{throw new Error('409')}});
  await s.presenter.start();await s.presenter.accept();
  assert.equal(s.last.state,'BLOCKED');assert.equal(s.last.canAccept,false);
});
test('canonical activation gate cannot be silently enabled',async()=>{
  const s=setup();const x=canonical();x.notice.activation.user_interface_enabled=true;s.setData(x);
  await s.presenter.start();assert.equal(s.last.state,'BLOCKED');
});
test('missing canonical notice fields fail closed',async()=>{
  const s=setup();const x=canonical();delete x.notice.notice.withdrawal;s.setData(x);
  await s.presenter.start();assert.equal(s.last.state,'BLOCKED');
});
test('close prevents late authentication result from updating UI',async()=>{
  let release;const s=setup({authenticate:()=>new Promise(resolve=>{release=resolve})});
  const pending=s.presenter.start();s.presenter.close();release(true);await pending;
  assert.equal(s.last.state,'CLOSED');assert.equal(s.calls.length,0);
});
test('closing prevents late consent write from granting UI state',async()=>{
  let release;const s=setup({writeConsent:()=>new Promise(resolve=>{release=resolve})});
  await s.presenter.start();const pending=s.presenter.accept();s.presenter.close();
  release({schema_version:'native.conversation.consent.v1'});await pending;
  assert.equal(s.last.state,'CLOSED');
});
test('silence, microphone permission, app use cannot trigger consent',async()=>{
  const s=setup();await s.presenter.start();
  assert.equal(s.calls.length,0);assert.equal(s.last.state,'CONSENT_REQUIRED');
});
test('inconsistent post-write read fails closed',async()=>{
  const s=setup({writeConsent:async()=>({schema_version:'native.conversation.consent.v1',consent_version:'NATIVE-ORDINARY-CONVERSATION-v1',revision:1,status:'ACCEPTED',active:true})});
  await s.presenter.start();await s.presenter.accept();assert.equal(s.last.state,'BLOCKED');
});
