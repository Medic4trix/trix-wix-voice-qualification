import test from 'node:test';
import assert from 'node:assert/strict';
import {createSyntheticDomView} from '../qualification/trix-wix-app-bridge-005-dom.mjs';
function setup(){
 const elements={};
 for(const key of ['start','send','close','input','status','output']){
  elements[key]={disabled:false,textContent:'',value:'Oi',listeners:{},addEventListener(type,cb){this.listeners[type]=cb;},click(){this.listeners.click?.();}};
 }
 const root={querySelector:selector=>elements[selector.slice(6,-1)]};
 return {elements,view:createSyntheticDomView(root)};
}
test('requires all synthetic controls',()=>assert.throws(()=>createSyntheticDomView({querySelector:()=>null}),/DOM_CONTROLS_REQUIRED/));
test('wires start send close as local events',()=>{
 const {elements,view}=setup();let started=0,closed=0,sent='';
 view.onStart(()=>started++);view.onClose(()=>closed++);view.onSend(text=>sent=text);
 elements.start.click();elements.send.click();elements.close.click();
 assert.equal(started,1);assert.equal(closed,1);assert.equal(sent,'Oi');
});
test('renders nonclinical output as inert text, not HTML',()=>{
 const {elements,view}=setup();
 view.render({state:'READY',canSend:true,busy:false,consentRequired:false,message:'<img src=x onerror=alert(1)>',receipt:false,error:null});
 assert.equal(elements.output.textContent,'<img src=x onerror=alert(1)>');
 assert.equal(elements.send.disabled,false);
});
test('consent, receipt, error and close states disable unsafe controls',()=>{
 const {elements,view}=setup();
 for(const model of [
 {state:'CONSENT_REQUIRED',consentRequired:true},
 {state:'SENDING',busy:true,receipt:true},
 {state:'ERROR',error:'OPERATION_UNAVAILABLE'},
 {state:'CLOSED'}
 ]) {
 view.render({canSend:false,busy:false,consentRequired:false,message:null,receipt:false,error:null,...model});
 assert.equal(elements.send.disabled,true);
 assert.equal(elements.input.disabled,true);
 }
 assert.equal(elements.close.disabled,true);
});
