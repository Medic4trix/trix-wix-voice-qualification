/* TRIX-WIX-APP-BRIDGE-004 — synthetic contract adapter only.
 * No network, token storage, identity issuance, provider or production activation.
 * Ports are supplied by a synthetic test harness. This file is NOT a live client.
 */
export const STATES = Object.freeze({
  IDLE: 'IDLE', AUTHENTICATING: 'AUTHENTICATING',
  CONSENT_REQUIRED: 'CONSENT_REQUIRED', READY: 'READY',
  SENDING: 'SENDING', ERROR: 'ERROR', CLOSED: 'CLOSED'
});
const fail = (code) => { throw new Error(code); };
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
export function createSyntheticBridge(ports) {
  if (!ports || ports.syntheticOnly !== true ||
      !['authenticate', 'readConsent', 'bootstrap', 'sendText'].every(k => typeof ports[k] === 'function'))
    fail('SYNTHETIC_PORTS_REQUIRED');
  let state = STATES.IDLE, context = null, epoch = 0, last = null;
  const snapshot = () => Object.freeze({state, ready: state === STATES.READY, last});
  const close = () => { ++epoch; context = null; last = null; state = STATES.CLOSED; return snapshot(); };
  async function start() {
    if (![STATES.IDLE, STATES.ERROR, STATES.CONSENT_REQUIRED, STATES.CLOSED].includes(state))
      fail('INVALID_START_STATE');
    const generation = ++epoch;
    context = null; last = null; state = STATES.AUTHENTICATING;
    try {
      // The port simulates a preexisting human authority; never use a Wix instance token here.
      const identity = await ports.authenticate();
      if (generation !== epoch) return snapshot();
      if (!identity || identity.authority !== 'HUMAN_COGNITO_VERIFIED' || !nonempty(identity.subject_ref))
        fail('HUMAN_AUTHORITY_REQUIRED');
      const consent = await ports.readConsent(identity);
      if (generation !== epoch) return snapshot();
      if (!consent || consent.schema_version !== 'native.conversation.consent.read.v1' ||
          consent.current?.status !== 'ACCEPTED' || consent.current.active !== true) {
        state = STATES.CONSENT_REQUIRED; return snapshot();
      }
      const session = await ports.bootstrap(identity);
      if (generation !== epoch) return snapshot();
      if (!session || session.session?.schema_version !== 'native.session.binding.v1' || session.conversation?.schema_version !== 'native.conversation.binding.v1' || !nonempty(session.session.session_id) || !nonempty(session.conversation.conversation_id) || session.conversation.session_id !== session.session.session_id || session.session.session_state !== 'ACTIVE' || session.conversation.state !== 'ACTIVE')
        fail('SERVER_SESSION_REQUIRED');
      context = {identity, session}; state = STATES.READY; return snapshot();
    } catch (e) {
      if (generation === epoch) {context = null; state = STATES.ERROR; last = String(e.message || 'UNKNOWN');}
      return snapshot();
    }
  }
  async function send(text, message_id, interaction_id, idempotency_key) {
    if (state !== STATES.READY || !context) fail('SESSION_NOT_READY');
    if (![text, message_id, interaction_id, idempotency_key].every(nonempty) || message_id === interaction_id) fail('INVALID_TEXT_TURN');
    const generation = epoch, current = context;
    state = STATES.SENDING;
    try {
      // Recheck consent at send time; server remains the final authority.
      const consent = await ports.readConsent(current.identity);
      if (generation !== epoch) return snapshot();
      if (consent?.current?.status !== 'ACCEPTED' || consent.current.active !== true) {
        context = null; state = STATES.CONSENT_REQUIRED; return snapshot();
      }
      const response = await ports.sendText({
        schema_version: 'native.text.turn.v1', conversation_id: current.session.conversation.conversation_id,
        session_id: current.session.session.session_id, message_id, text,
        interaction_id, idempotency_key
      }, current.identity, current.session);
      if (generation !== epoch) return snapshot();
      if (response?.schema_version === 'native.text.turn.response.v1' &&
          response.response_class === 'NONCLINICAL' &&
          nonempty(response.text) && response.interaction_id === interaction_id) {
        last = {kind: 'NONCLINICAL', text: response.text};
      } else if (response?.schema_version === 'native.text.turn.accepted.v1' &&
                 ['processed', 'replayed'].includes(response.status) && response.interaction_id === interaction_id) {
        last = {kind: 'RECEIPT', text: null};
      } else {
        fail('RESPONSE_NOT_AUTHORIZED_FOR_DISPLAY');
      }
      state = STATES.READY; return snapshot();
    } catch (e) {
      if (generation === epoch) {last = String(e.message || 'UNKNOWN'); state = STATES.ERROR; context = null;}
      return snapshot();
    }
  }
  return Object.freeze({snapshot, start, send, close});
}
