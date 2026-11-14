/* Bridge 008: offline HTTP contract simulator, NOT a fetch client.
 * No network, browser credentials, provider, persistence, or operational activation.
 */
const routes=Object.freeze({
  bootstrap:['POST','/v1/native/bootstrap'],
  consentRead:['GET','/v1/native/conversation-consent'],
  consentWrite:['POST','/v1/native/conversation-consent'],
  text:['POST','/v1/native/text-turns']
});
const nonempty=x=>typeof x==='string'&&!!x.trim();
const fail=()=>{throw new Error('SYNTHETIC_TRANSPORT_REJECTED')};
export function createSyntheticHttpTransport({ports}) {
  if(ports?.syntheticOnly!==true||typeof ports.dispatch!=='function')fail();
  let closed=false, generation=0;
  const close=()=>{closed=true;generation++};
  const request=async(kind,{bearer,body,idempotencyKey}={})=>{
    if(closed||!Object.hasOwn(routes,kind)||!nonempty(bearer)||!/^[^\s]+$/.test(bearer))fail();
    const [method,path]=routes[kind];
    if(kind==='text'){
      if(!body||body.schema_version!=='native.text.turn.v1'||!nonempty(idempotencyKey)||
         body.idempotency_key!==idempotencyKey||!nonempty(body.text)||
         !['message_id','interaction_id','conversation_id','session_id'].every(k=>nonempty(body[k]))||
         body.message_id===body.interaction_id)fail();
    }
    if(kind==='consentWrite' && (!body||!['ACCEPT','WITHDRAW'].includes(body.action)||
       !Number.isInteger(body.expected_revision)||body.expected_revision<0||
       (body.action==='WITHDRAW'&&body.expected_revision===0)))fail();
    const seq=generation;
    const headers={'Authorization':`Bearer ${bearer}`};
    if(kind==='text')headers['Idempotency-Key']=idempotencyKey;
    const req=Object.freeze({method,path,headers:Object.freeze(headers),
      body:kind==='consentRead'?undefined:body===undefined?undefined:structuredClone(body)});
    try{
      const response=await ports.dispatch(req);
      if(closed||seq!==generation)fail();
      if(!response||!Number.isInteger(response.status))fail();
      if(response.status!==200){
        if([400,401,403,404,405,409,422,429,500,503].includes(response.status))
          return Object.freeze({ok:false,status:response.status,code:'HTTP_REJECTED'});
        fail();
      }
      const data=response.body;
      if(!data||typeof data!=='object')fail();
      if(kind==='consentRead' && (data.schema_version!=='native.conversation.consent.read.v1'||
        !data.current||!['ACCEPTED','WITHDRAWN','NOT_ACCEPTED','NOT_CURRENT'].includes(data.current.status)))fail();
      if(kind==='consentWrite' && (data.schema_version!=='native.conversation.consent.v1'||
        data.status!==(body.action==='ACCEPT'?'ACCEPTED':'WITHDRAWN')||
        data.revision!==body.expected_revision+1))fail();
      if(kind==='bootstrap' && (data.session?.schema_version!=='native.session.binding.v1'||
        data.conversation?.schema_version!=='native.conversation.binding.v1'||
        data.session.session_id!==data.conversation.session_id))fail();
      if(kind==='text' && (!['native.text.turn.response.v1','native.text.turn.accepted.v1'].includes(data.schema_version)||
        data.interaction_id!==body.interaction_id||
        !['processed','replayed'].includes(data.status)||
        (data.schema_version==='native.text.turn.response.v1'&&
         (data.response_class!=='NONCLINICAL'||!nonempty(data.text)))))fail();
      return Object.freeze({ok:true,status:200,body:structuredClone(data)});
    }catch{
      if(closed||seq!==generation)throw new Error('SYNTHETIC_TRANSPORT_CLOSED');
      throw new Error('SYNTHETIC_TRANSPORT_UNAVAILABLE');
    }
  };
  return Object.freeze({request,close});
}
