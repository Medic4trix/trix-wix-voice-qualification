/* Synthetic composition of existing Bridges 005, 007 and 008; no fetch or operational authority. */
import {createSyntheticWixPresenter} from './trix-wix-app-bridge-005.mjs';
import {createSyntheticConsentPresenter} from './trix-wix-app-bridge-007-consent.mjs';
import {createSyntheticHttpTransport} from './trix-wix-app-bridge-008-http.mjs';

export function createSyntheticIntegratedWix({ports, conversationView, consentView, ids}) {
  if (ports?.syntheticOnly !== true ||
      !['authenticate','dispatch'].every(k => typeof ports[k] === 'function'))
    throw new Error('SYNTHETIC_INTEGRATION_REQUIRED');
  const http = createSyntheticHttpTransport({ports});
  let closed = false, identity = null, sequence = 0;
  const auth = async () => {
    const seq = ++sequence;
    const result = await ports.authenticate();
    if (closed || seq !== sequence) throw new Error('AUTH_CLOSED');
    if (result?.authority !== 'HUMAN_COGNITO_VERIFIED' ||
        typeof result.subject_ref !== 'string' || !result.subject_ref.trim() ||
        typeof result.bearer !== 'string' || !result.bearer.trim()) throw new Error('AUTH_REJECTED');
    if (identity && identity.subject_ref === result.subject_ref && identity.bearer === result.bearer && identity.authority === result.authority) return identity;
    identity = result;
    return result;
  };
  const bearer = (who) => {
    if (closed || !identity || who !== identity) throw new Error('IDENTITY_UNAVAILABLE');
    return identity.bearer;
  };
  const request = async (kind, who, body, idempotencyKey) => {
    const r = await http.request(kind,{bearer:bearer(who),body,idempotencyKey});
    if (!r.ok) throw new Error('HTTP_REJECTED');
    return r.body;
  };
  const bridgePorts = Object.freeze({
    syntheticOnly:true,
    authenticate:auth,
    readConsent:who=>request('consentRead',who),
    bootstrap:who=>request('bootstrap',who),
    sendText:(body,who)=>request('text',who,body,body.idempotency_key)
  });
  const conversation = createSyntheticWixPresenter({ports:bridgePorts,view:conversationView,ids});
  const consent = createSyntheticConsentPresenter({
    ports:{
      syntheticOnly:true,
      authenticate:async()=>{await auth();return true},
      readConsent:()=>request('consentRead',identity),
      writeConsent:body=>request('consentWrite',identity,body)
    },
    view:consentView
  });
  const close=()=>{if(closed)return;closed=true;++sequence;identity=null;http.close();consent.close();conversation.close()};
  return Object.freeze({conversation,consent,close});
}
