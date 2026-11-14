'use strict';
/**
 * TRIX-WIX-VOICE-ETAPA2-QUALIFICATION-001
 * Offline Node.js tests of the EXACT detector functions embedded in v004-c9.html.
 * No browser, network, microphone, AWS, provider, or real identity.
 * Run locally: node --test tests/trix-wix-voice-etapa2.test.mjs
 * Scope limitation: runtime WebRTC/microphone races need a separate browser harness.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../v004-c9.html', import.meta.url), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script, 'expected inline script in v004-c9.html');
const functions = script.slice(script.indexOf('function initialDetector('), script.indexOf('const $='));
assert.ok(functions.includes('function detect(') && functions.includes('function sampleWindow('));
const ctx = vm.createContext({});
vm.runInContext(functions + '\nthis.api={initialDetector,detect,initialWindow,sampleWindow};', ctx);
const {initialDetector,detect,initialWindow,sampleWindow} = ctx.api;
const start = (s,at=0) => detect(s,{type:'START',at,explicit:true,admitted:true,releaseReady:true});
const event = (s,type,at,extra={}) => detect(s,{type,at,generation:s.generation,...extra});

test('explicit start requires admission and released resources',()=>{
 const s=initialDetector();
 for(const field of ['explicit','admitted','releaseReady']){
  const request={type:'START',at:0,explicit:true,admitted:true,releaseReady:true};
  request[field]=false;
  assert.equal(detect(s,request).state,'IDLE');
 }
 assert.equal(start(s).state,'ACTIVE');
});
test('start increments generation and records monotonic activity',()=>{
 const s=start(initialDetector(),12);
 assert.equal(s.generation,1); assert.equal(s.lastActivityAt,12);
});
test('three consecutive RMS frames count as activity',()=>{
 let s=start(initialDetector({threshold:0.02}));
 s=event(s,'ENERGY',1,{rms:0.03});
 s=event(s,'ENERGY',2,{rms:0.03});
 assert.equal(s.lastActivityAt,0);
 s=event(s,'ENERGY',3,{rms:0.03});
 assert.equal(s.lastActivityAt,3);
});
test('low energy breaks consecutive sequence',()=>{
 let s=start(initialDetector({threshold:0.02}));
 for(const [at,rms] of [[1,0.03],[2,0.01],[3,0.03],[4,0.03]])s=event(s,'ENERGY',at,{rms});
 assert.equal(s.lastActivityAt,0);
});
test('120s warning and 180s termination',()=>{
 let s=start(initialDetector());
 s=event(s,'TICK',119);assert.equal(s.state,'ACTIVE');
 s=event(s,'TICK',120);assert.equal(s.state,'WARNING');
 s=event(s,'TICK',179);assert.equal(s.state,'WARNING');
 s=event(s,'TICK',180);assert.equal(s.state,'ENDED');
});
test('new acoustic activity clears warning',()=>{
 let s=start(initialDetector());
 s=event(s,'TICK',120);
 for(let i=0;i<3;i++)s=event(s,'ENERGY',121+i,{rms:0.05});
 assert.equal(s.state,'ACTIVE');assert.equal(s.lastActivityAt,123);
});
test('background pauses and requires explicit restart',()=>{
 let s=start(initialDetector());
 s=event(s,'BACKGROUND',10);assert.equal(s.state,'PAUSED');
 assert.equal(event(s,'TICK',11).state,'PAUSED');
 s=start(s,12);assert.equal(s.state,'ACTIVE');assert.equal(s.generation,2);
});
test('explicit stop terminates and requires explicit restart',()=>{
 let s=start(initialDetector());
 s=event(s,'STOP',10);assert.equal(s.state,'ENDED');
 assert.equal(event(s,'ENERGY',11,{rms:0.9}).state,'ENDED');
 assert.equal(start(s,12).state,'ACTIVE');
});
test('stale generation cannot change current session',()=>{
 let s=start(initialDetector());
 s=event(s,'BACKGROUND',1);
 s=start(s,2);
 assert.equal(detect(s,{type:'STOP',at:3,generation:1}).state,'ACTIVE');
 assert.equal(detect(s,{type:'ENERGY',at:4,generation:1,rms:0.5}).lastActivityAt,2);
});
test('out-of-order, invalid RMS and duplicate old events ignored',()=>{
 let s=start(initialDetector());
 s=event(s,'TICK',5);
 assert.equal(event(s,'TICK',4),s);
 assert.equal(event(s,'ENERGY',6,{rms:2}),s);
 assert.equal(event(s,'ENERGY',6,{rms:-1}),s);
});
test('failure terminates active detector',()=>{
 const s=start(initialDetector());
 assert.equal(event(s,'FAILURE',2).state,'ENDED');
});
test('window comparator requires two hits at distinct times',()=>{
 let s=initialWindow({threshold:0.01,seconds:1.5,hitsNeeded:2});
 let r=sampleWindow(s,0,0.02);assert.equal(r.activity,false);
 r=sampleWindow(r.state,0,0.02);assert.equal(r.activity,false);
 r=sampleWindow(r.state,1,0.02);assert.equal(r.activity,true);
});
test('source enforces visible page and no automatic foreground resume',()=>{
 assert.match(script,/document\.visibilityState!=='visible'/);
 assert.match(script,/FOREGROUND_NO_AUTO_RESUME/);
 assert.match(script,/pagehide/);
});
test('source releases microphone tracks and closes peers',()=>{
 assert.match(script,/tracks\.forEach\(t=>\{try\{t\.stop\(\)/);
 assert.match(script,/p\?\.close\(\)/);
 assert.match(script,/LATE_MICROPHONE_RELEASED/);
});
test('source invalidates old asynchronous operations using token',()=>{
 assert.match(script,/token\+\+;if\(timer\)/);
 assert.match(script,/if\(id!==token/);
});
test('source blocks restart while releaseReady is false',()=>{
 assert.match(script,/!releaseReady\|\|!\$\('admit'\)\.checked/);
});

test('concurrent release calls share one pending close and cannot unlock restart early', async()=>{
 const releaseCode=script.slice(script.indexOf('let releaseInFlight=null;'),script.indexOf('async function connect('));
 assert.ok(releaseCode.includes('function release(reason)'));
 let resolveClose;
 const closePending=new Promise(resolve=>{resolveClose=resolve;});
 let closeCount=0,stopCount=0;
 const track={kind:'audio',readyState:'live',stop(){stopCount++;this.readyState='ended';}};
 const context={
  token:0,timer:null,releaseReady:true,stream:{getTracks:()=>[track]},
  peerA:{close(){}},peerB:{close(){}},
  source:{disconnect(){}},analyser:{disconnect(){}},
  ctx:{state:'running',close(){closeCount++;return closePending;}},
  buf:null,
  $:id=>id==='audio'?{pause(){},srcObject:null}:{textContent:''},
  log(){},render(){},clearInterval(){},
 };
 const sandbox=vm.createContext(context);
 vm.runInContext(releaseCode+'\nthis.runRelease=release;this.ready=()=>releaseReady;this.currentToken=()=>token;',sandbox);
 const first=sandbox.runRelease('MANUAL_STOP');
 const second=sandbox.runRelease('BACKGROUND_HIDDEN');
 assert.equal(first,second);
 assert.equal(sandbox.ready(),false);
 assert.equal(sandbox.currentToken(),1);
 assert.equal(closeCount,1);
 assert.equal(stopCount,1);
 resolveClose();
 await Promise.all([first,second]);
 assert.equal(sandbox.ready(),true);
 assert.equal(closeCount,1);
});
