import test from 'node:test';
import assert from 'node:assert/strict';
import {createSyntheticHttpTransport} from '../qualification/trix-wix-app-bridge-008-http.mjs';
const body={schema_version:'native.text.turn.v1',message_id:'m1',interaction_id:'i1',conversation_id:'c1',session_id:'s1',idempotency_key:'k1',text:'Oi'};
const reply={schema_version:'native.text.turn.response.v1',status:'processed',response_class:'NONCLINICAL',interaction_id:'i1',text:'Olá'};
const make=(dispatch=async()=>({status:200,body:reply}))=>createSyntheticHttpTransport({ports:{syntheticOnly:true,dispatch}});
const textArgs={bearer:'synthetic-token',body,idempotencyKey:'k1'};
test('route and exact authorization and idempotency headers',async()=>{
 let request;const t=make(async r=>{request=r;return {status:200,body:reply}});
 assert.equal((await t.request('text',textArgs)).ok,true);
 assert.equal(request.path,'/v1/native/text-turns');assert.equal(request.method,'POST');
 assert.equal(request.headers.Authorization,'Bearer synthetic-token');
 assert.equal(request.headers['Idempotency-Key'],'k1');
});
test('no missing human bearer',async()=>{await assert.rejects(make().request('text',{...textArgs,bearer:''}))});
test('no idempotency mismatch',async()=>{await assert.rejects(make().request('text',{...textArgs,idempotencyKey:'other'}))});
test('reject malformed text and reused message id',async()=>{await assert.rejects(make().request('text',{...textArgs,body:{...body,message_id:'i1'}}))});
test('consent GET route',async()=>{
 let r;const t=make(async x=>{r=x;return {status:200,body:{schema_version:'native.conversation.consent.read.v1',current:{status:'NOT_ACCEPTED'}}}});
 assert.equal((await t.request('consentRead',{bearer:'x'})).ok,true);
 assert.equal(r.method,'GET');assert.equal(r.path,'/v1/native/conversation-consent');
});
test('consent write revision and action',async()=>{
 const t=make(async()=>({status:200,body:{schema_version:'native.conversation.consent.v1',status:'WITHDRAWN',revision:2}}));
 assert.equal((await t.request('consentWrite',{bearer:'x',body:{action:'WITHDRAW',expected_revision:1}})).ok,true);
 await assert.rejects(t.request('consentWrite',{bearer:'x',body:{action:'WITHDRAW',expected_revision:0}}));
});
test('bootstrap response binding',async()=>{
 const t=make(async()=>({status:200,body:{session:{schema_version:'native.session.binding.v1',session_id:'s'},conversation:{schema_version:'native.conversation.binding.v1',session_id:'s'}}}));
 assert.equal((await t.request('bootstrap',{bearer:'x'})).ok,true);
});
test('HTTP conflict and rejected authority do not grant response',async()=>{
 for(const status of [401,403,409,422,503]){
 const r=await make(async()=>({status})).request('text',textArgs);
 assert.equal(r.ok,false);assert.equal(r.status,status);
 }
});
test('network failure fails closed',async()=>{
 await assert.rejects(make(async()=>{throw Error('offline')}).request('text',textArgs),/UNAVAILABLE/);
});
test('invalid response and clinical output blocked',async()=>{
 await assert.rejects(make(async()=>({status:200,body:{...reply,response_class:'CLINICAL_RELEASED'}})).request('text',textArgs));
});
test('replay receipt allowed without redelivery text',async()=>{
 const t=make(async()=>({status:200,body:{schema_version:'native.text.turn.accepted.v1',status:'replayed',interaction_id:'i1'}}));
 assert.equal((await t.request('text',textArgs)).body.status,'replayed');
});
test('close blocks late response',async()=>{
 let release;const t=make(()=>new Promise(resolve=>{release=resolve}));
 const pending=t.request('text',textArgs);t.close();release({status:200,body:reply});
 await assert.rejects(pending,/CLOSED/);
});
test('no live dispatch without explicit synthetic port',()=>{
 assert.throws(()=>createSyntheticHttpTransport({ports:{dispatch:async()=>{}}}));
});
