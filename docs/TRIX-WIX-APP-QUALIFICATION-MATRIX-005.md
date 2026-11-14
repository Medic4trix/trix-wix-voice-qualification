# Dr. TRIX / Wix — Matriz de qualificação e pendências de lançamento

**Checkpoint:** 2026-11-14  
**Plano:** Etapa 5 de 5 — consolidação documental  
**Repositório:** `Medic4trix/trix-wix-voice-qualification`  
**PR de referência:** #3, Draft; **sem merge ou publicação**  
**Baseline main:** `b96a5cff6b9163fb31e3aa3a8aef2acc94ffdb21`  
**HEAD sintético qualificado:** `6f1f8297f1908c7058469490dc45fd4ae7235513`

## Escopo do plano de cinco etapas

| Etapa | Objetivo | Evidência e situação |
| --- | --- | --- |
| 1 | Consolidar referência de interface de voz e preservar versões | `v004-c9.html` identificada como referência local mais recente; versões V003/V004 preservadas; sem escolha de versão publicada final |
| 2 | Qualificar estados de microfone, silêncio, interrupção, ocultação/retorno e encerramento | Implementações locais inspecionadas em V004-C9; não equivale a teste físico completo de dispositivos/Wix |
| 3 | Preparar estados de mensagem, resposta, carregamento, erro e reconexão | Estados sintéticos preparados no adaptador isolado; **sem integração visual funcional com V004-C9** |
| 4 | Revisar ponte Wix → TRIX e qualificar contratos | Adaptador exclusivamente sintético em PR #3; 7/7 testes Node PASS no HEAD acima |
| 5 | Consolidar matriz de evidências, pendências e critérios de lançamento | Este documento; **não certifica lançamento** |

## Evidências confirmadas

- `v004-c9.html`: página local de qualificação de microfone, estados acústicos, pausa/encerramento; sem autenticação humana, chamadas de backend ou conversa real.
- `qualification/trix-wix-app-bridge-004.mjs`: portas sintéticas injetadas, autenticação humana simulada, leitura/rechecagem de consentimento, bootstrap de sessão e envio de texto sintético.
- `tests/trix-wix-app-bridge-004.test.mjs`: sete testes sintéticos de segurança e ciclo de vida.
- Workflow `trix-wix-app-bridge-004.yml`: GitHub Actions [run 43615626817](https://github.com/Medic4trix/trix-wix-voice-qualification/actions/runs/43615626817), SUCCESS, **7 PASS, 0 FAIL, 0 SKIP**.
- Contratos do repositório `Medic4trix/trix-v1` consultados: `apps/api/native_bootstrap.py`, `native_bootstrap_http.py`, `native_conversation_consent_read_http.py`, `native_text_turn_contract.py`, `native_text_turn_http.py`.
- Bootstrap real fornece `session.session_id` e `conversation.conversation_id`; o contrato de texto requer `schema_version`, `message_id`, `interaction_id`, `conversation_id`, `session_id`, `idempotency_key`, `text`, além do header `Idempotency-Key` idêntico.
- Consentimento canônico exige `current.status=ACCEPTED` e `current.active=true`. O backend permanece a autoridade final.
- Resposta não clínica `native.text.turn.response.v1` pode ser exibida após validação; recibo `native.text.turn.accepted.v1` não contém resposta conversacional. Liberação clínica requer fluxo de autorização próprio.

## Limites importantes da implementação sintética

1. O adaptador **não** está conectado à página V004-C9, Cognito, PostgreSQL, Wix Live ou API GPT.
2. O adaptador usa uma porta de autenticação **simulada** e não emite tokens, sessões ou identidades reais.
3. Os testes **não** validam roteamento HTTP real, cabeçalhos, revogação concorrente no servidor, erros de rede, compatibilidade do navegador ou implantação.
4. A porta sintética `sendText` recebe o objeto do corpo e não demonstra envio efetivo do header HTTP `Idempotency-Key`; isso é requisito explícito de integração futura.
5. `close()` invalida resultados assíncronos no adaptador; não comprova cancelamento de uma operação já admitida pelo servidor.
6. `V004-C9` não realiza conversação por voz nem recebe resposta falada do TRIX.
7. A PR #3 permanece Draft; a API GitHub retornou `mergeable_state=clean` em 2026-11-14, mas isso não autoriza merge.

## Matriz de bloqueadores antes do lançamento

| Critério | Estado atual | Evidência exigida para liberar |
| --- | --- | --- |
| Identidade humana Cognito | Não integrada à interface Wix | Login real seguro e vínculo de pessoa/sessão governado, sem usar Wix instance token como identidade humana |
| Consentimento canônico | Somente porta sintética | Leitura e aceite/revogação reais com tratamento de 401/403/503 |
| Bootstrap Native | Somente porta sintética | Sessão ativa e conversa vinculada, derivadas do servidor |
| Turno de texto | Somente porta sintética | Payload exato, header de idempotência, replay, erro e reconexão qualificados |
| Resposta clínica | Bloqueada na simulação | Prova de liberação governada antes de qualquer exibição ou áudio |
| UI Wix | V004-C9 isolada | Integração controlada e teste físico de permissões, background, interrupção e retomada |
| Voz / GPT API | Fora do escopo desta PR | Qualificação separada, sem pressupor integração |
| Segurança e privacidade | Apenas testes sintéticos | Revisão de origem/CSP, tratamento de credenciais, isolamento e dados reais somente com autorização própria |
| Publicação e operação | Não autorizadas | Infraestrutura disponível, observabilidade, rollback, aprovação e autorização explícita de implantação |

## Decisão recomendada

**Manter PR #3 em Draft e sem merge.** A Etapa 4 atingiu a qualificação sintética de 7/7 testes, mas a integração funcional Wix ↔ TRIX e o lançamento permanecem **NÃO QUALIFICADOS**.

A próxima fase, se autorizada separadamente, deve ser limitada à ligação da UI aos contratos já existentes, com testes de fronteira e sem novas autoridades. Nenhum trabalho de API GPT de voz/memória deve ser incorporado a esta PR.

**Sem AWS, produção, dados pessoais reais, merge ou publicação nesta etapa.**
