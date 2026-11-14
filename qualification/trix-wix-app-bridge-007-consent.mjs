/* Bridge 007: isolated synthetic consent presenter; never activates a runtime or a Wix page.
 * All authority is injected, and only a canonical Native read result may supply notice text.
 */
const NOTICE_ID = 'P0A-NATIVE-ORDINARY-CONVERSATION-NOTICE';
const NOTICE_VERSION = '1.0';
const CONSENT_VERSION = 'NATIVE-ORDINARY-CONVERSATION-v1';
const PURPOSE = 'ORDINARY_NATIVE_CONVERSATION';
const FIELDS = ['ai_participation','scope','limits','human_help','withdrawal','material_change'];

export function createSyntheticConsentPresenter({ports, view}) {
  if (ports?.syntheticOnly !== true ||
      !['authenticate','readConsent','writeConsent'].every(k => typeof ports[k] === 'function') ||
      !view || !['render','onStart','onAccept','onDecline','onWithdraw','onClose'].every(k => typeof view[k] === 'function'))
    throw new Error('SYNTHETIC_CONSENT_PORTS_REQUIRED');
  let closed = false, generation = 0, current = null, notice = null, verified = false;
  const display = (state, error = null) => {
    if (!closed) view.render(Object.freeze({
      state, notice, current, error, canAccept: verified && !!notice && current?.active !== true,
      canWithdraw: verified && !!notice && current?.status === 'ACCEPTED' && current?.active === true
    }));
  };
  const invalidate = () => { current = null; notice = null; verified = false; };
  const validRead = (data) => {
    const n = data?.notice, c = data?.current;
    return data?.schema_version === 'native.conversation.consent.read.v1' &&
      n?.artifact_id === NOTICE_ID && n?.version === NOTICE_VERSION &&
      n?.consent_version === CONSENT_VERSION && n?.purpose === PURPOSE &&
      n?.status === 'COLLECTION_ENDPOINT_PREPARED' &&
      n?.activation?.user_interface_enabled === false &&
      n?.activation?.runtime_gate_enabled === false &&
      n?.activation?.collection_endpoint_enabled === true &&
      n?.notice && FIELDS.every(k => typeof n.notice[k] === 'string' && !!n.notice[k].trim()) &&
      c && ['NOT_ACCEPTED','WITHDRAWN','NOT_CURRENT','ACCEPTED'].includes(c.status) &&
      Number.isInteger(c.revision) && c.revision >= 0 &&
      typeof c.active === 'boolean' && (c.status !== 'ACCEPTED' || c.active === true) &&
      (c.status === 'ACCEPTED' || c.active === false);
  };
  const start = async () => {
    if (closed) return;
    const seq = ++generation; invalidate(); display('AUTHENTICATING');
    try {
      if (await ports.authenticate() !== true) throw new Error('AUTHORITY_REJECTED');
      if (closed || seq !== generation) return;
      verified = true;
      const read = await ports.readConsent();
      if (closed || seq !== generation) return;
      if (!validRead(read)) throw new Error('CANONICAL_CONSENT_REQUIRED');
      notice = Object.freeze({...read.notice, notice: Object.freeze({...read.notice.notice})});
      current = Object.freeze({...read.current});
      display(current.active ? 'ACCEPTED' : 'CONSENT_REQUIRED');
    } catch {
      if (closed || seq !== generation) return;
      invalidate(); display('BLOCKED','OPERATION_UNAVAILABLE');
    }
  };
  const transition = async (action) => {
    if (closed || !verified || !notice || !current) return;
    if (action === 'ACCEPT' && current.active) return;
    if (action === 'WITHDRAW' && !(current.status === 'ACCEPTED' && current.active && current.revision > 0)) return;
    const seq = ++generation, previousRevision = current.revision;
    display('UPDATING');
    try {
      const result = await ports.writeConsent({action,expected_revision:previousRevision});
      if (closed || seq !== generation) return;
      if (result?.schema_version !== 'native.conversation.consent.v1' ||
          result.consent_version !== CONSENT_VERSION ||
          result.revision !== previousRevision + 1 ||
          result.status !== (action === 'ACCEPT' ? 'ACCEPTED' : 'WITHDRAWN') ||
          result.active !== (action === 'ACCEPT')) throw new Error('INVALID_TRANSITION');
      // Re-read authoritative current state; a write acknowledgement alone never grants UI authority.
      const read = await ports.readConsent();
      if (closed || seq !== generation) return;
      if (!validRead(read) || read.current.status !== result.status ||
          read.current.revision !== result.revision || read.current.active !== result.active)
        throw new Error('CURRENTNESS_UNVERIFIED');
      notice = Object.freeze({...read.notice, notice: Object.freeze({...read.notice.notice})});
      current = Object.freeze({...read.current});
      display(current.active ? 'ACCEPTED' : 'CONSENT_REQUIRED');
    } catch {
      if (closed || seq !== generation) return;
      invalidate(); display('BLOCKED','OPERATION_UNAVAILABLE');
    }
  };
  const decline = () => { if (!closed) { ++generation; invalidate(); display('DECLINED'); } };
  const close = () => {
    if (closed) return;
    closed = true; ++generation; invalidate();
    view.render(Object.freeze({state:'CLOSED',notice:null,current:null,error:null,canAccept:false,canWithdraw:false}));
  };
  view.onStart(start); view.onAccept(() => transition('ACCEPT'));
  view.onDecline(decline); view.onWithdraw(() => transition('WITHDRAW')); view.onClose(close);
  display('IDLE');
  return Object.freeze({start,accept:() => transition('ACCEPT'),decline,withdraw:() => transition('WITHDRAW'),close});
}
