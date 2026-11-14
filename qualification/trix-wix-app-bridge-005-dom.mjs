/* Isolated DOM adapter for synthetic UI qualification only. No network or storage. */
export function createSyntheticDomView(root) {
  if (!root || typeof root.querySelector !== 'function') throw new Error('DOM_ROOT_REQUIRED');
  const required = ['[data-start]','[data-send]','[data-close]','[data-input]','[data-status]','[data-output]'];
  const [start,send,close,input,status,output] = required.map(s => root.querySelector(s));
  if ([start,send,close,input,status,output].some(x => !x)) throw new Error('DOM_CONTROLS_REQUIRED');
  return Object.freeze({
    onStart: handler => start.addEventListener('click', handler),
    onSend: handler => send.addEventListener('click', () => handler(input.value)),
    onClose: handler => close.addEventListener('click', handler),
    render: model => {
      status.textContent = model.consentRequired ? 'CONSENTIMENTO NECESSÁRIO' :
        model.error ? 'OPERAÇÃO INDISPONÍVEL' : model.state;
      output.textContent = model.message ?? (model.receipt ? 'MENSAGEM RECEBIDA — RESPOSTA PENDENTE' : '');
      send.disabled = !model.canSend;
      input.disabled = !model.canSend;
      start.disabled = model.busy || model.state === 'READY' || model.state === 'CLOSED';
      close.disabled = model.state === 'CLOSED';
    }
  });
}
