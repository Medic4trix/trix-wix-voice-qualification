/* TRIX-WIX-APP-BRIDGE-005 — synthetic-only UI presenter.
 * No browser networking, storage, tokens, Wix instance identity or live providers.
 * DOM-like view is injected by the harness; V004-C9 remains untouched.
 */
import {createSyntheticBridge, STATES} from './trix-wix-app-bridge-004.mjs';

export function createSyntheticWixPresenter({ports, view, ids}) {
  if (!ports || ports.syntheticOnly !== true || !view ||
      !['render', 'onStart', 'onSend', 'onClose'].every(k => typeof view[k] === 'function') ||
      !ids || typeof ids.next !== 'function') throw new Error('SYNTHETIC_UI_REQUIRED');
  const bridge = createSyntheticBridge(ports);
  let closed = false, operation = 0;
  const render = (snapshot) => {
    if (closed) return;
    const last = snapshot.last;
    view.render(Object.freeze({
      state: snapshot.state,
      canSend: snapshot.ready,
      busy: [STATES.AUTHENTICATING, STATES.SENDING].includes(snapshot.state),
      consentRequired: snapshot.state === STATES.CONSENT_REQUIRED,
      message: last && typeof last === 'object' && last.kind === 'NONCLINICAL' ? last.text : null,
      receipt: last && typeof last === 'object' && last.kind === 'RECEIPT',
      error: snapshot.state === STATES.ERROR ? 'OPERATION_UNAVAILABLE' : null
    }));
  };
  const start = async () => {
    if (closed) return;
    const current = ++operation;
    render({state: STATES.AUTHENTICATING, ready:false, last:null});
    const result = await bridge.start();
    if (!closed && current === operation) render(result);
  };
  const send = async (text) => {
    if (closed || !bridge.snapshot().ready) return;
    if (typeof text !== 'string' || !text.trim()) return;
    const id = ids.next();
    if (!id || !['message_id','interaction_id','idempotency_key'].every(k => typeof id[k] === 'string' && id[k].trim()))
      throw new Error('SYNTHETIC_IDS_REQUIRED');
    const current = ++operation;
    render({state: STATES.SENDING, ready:false, last:null});
    const result = await bridge.send(text, id.message_id, id.interaction_id, id.idempotency_key);
    if (!closed && current === operation) render(result);
  };
  const close = () => {
    if (closed) return;
    closed = true; ++operation; bridge.close();
    view.render(Object.freeze({state:STATES.CLOSED,canSend:false,busy:false,consentRequired:false,message:null,receipt:false,error:null}));
  };
  view.onStart(start); view.onSend(send); view.onClose(close);
  render(bridge.snapshot());
  return Object.freeze({start,send,close,snapshot:bridge.snapshot});
}
