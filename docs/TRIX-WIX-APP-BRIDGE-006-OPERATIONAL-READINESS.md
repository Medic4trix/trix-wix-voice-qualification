# TRIX-WIX-APP-BRIDGE-006 — preparação operacional (somente leitura)

Estado: **preparação técnica; NÃO integrado, NÃO publicado, NÃO aprovado para produção**.

## Proveniência

- Base exata: Bridge 005 HEAD `d8a61bf71ab507c708eaa5b10900d6c2fbf9b750`; PR #4 Draft sobre PR #3 Draft.
- Contratos consultados diretamente em `Medic4trix/trix-v1` / `main`: `apps/api/native_bootstrap_http.py`, `apps/api/native_conversation_consent_read_http.py`, `apps/api/native_text_turn_http.py`.
- Interfaces históricas V003/V004, especialmente `v004-c9.html`, não são alteradas.

## Matriz mínima de fronteiras

| Operação | Autoridade existente | Contrato confirmado | Requisito antes de integração real |
|---|---|---|---|
| Identidade humana | Native Cognito, validado no servidor | `Authorization: Bearer …` para bootstrap/consentimento | Origem segura do token humano; nunca usar token de instalação Wix como identidade |
| Consentimento | `execute_native_conversation_consent_read_http` | `native.conversation.consent.read.v1`; `current.status=ACCEPTED` e `active=true` | Tratar `NOT_ACCEPTED`, `WITHDRAWN`, `NOT_CURRENT` como bloqueio; não confundir permissão de microfone com consentimento |
| Sessão | `execute_native_bootstrap_http` | Sessão/conversa vinculadas à identidade canônica no servidor | Rejeitar identificadores inventados pelo navegador e divergência entre sessão e conversa |
| Envio de texto | `execute_native_text_turn_http` | `native.text.turn.v1` + `Authorization` + `Idempotency-Key` igual à chave do payload | Garantir identidade, sessão, conversa, consentimento, replay e idempotência governados no backend |
| Resposta | `execute_native_text_turn_http` | `native.text.turn.response.v1` ou `native.text.turn.accepted.v1` | Exibir apenas `NONCLINICAL` autorizado; recibo não é resposta; conteúdo clínico requer liberação distinta |
| Falhas | `ApiError` nos handlers Native | 401, 403, 404, 409, 422, 503 conforme caso | Não exibir detalhes internos; recuperar sessão somente mediante nova autoridade |

**Importante:** nomes exatos das rotas HTTP públicas, configuração CORS, transporte do bearer no ambiente Wix, proteção CSRF e implantação não foram qualificados por esta análise. Não inferir endpoints nem acrescentar URLs presumidas.

## Diferença entre demonstração e operação

- `qualification/trix-wix-app-bridge-005-demo.html` simula autenticação, consentimento, bootstrap e envio; não realiza chamadas de rede.
- `qualification/trix-wix-app-bridge-005-dom.mjs` apenas apresenta estados e texto inerte.
- `qualification/trix-wix-app-bridge-004.mjs` exige portas sintéticas; não implementa `Authorization` nem cabeçalho HTTP `Idempotency-Key`.
- Nenhum dos componentes anteriores deve ser considerado um cliente Cognito/Native real.

## Critérios de aceitação para futura autorização operacional

1. Validar endpoints e métodos HTTP diretamente no roteador real; não presumir caminhos.
2. Confirmar contexto de origem, CSP, CORS, proteção de tokens e política de armazenamento para Wix publicado.
3. Testar identidade humana real somente em ambiente autorizado e sem dados clínicos reais; proibir token Wix como autoridade humana.
4. Qualificar leitura/revogação de consentimento, bootstrap canônico, idempotência HTTP e resposta `NONCLINICAL`.
5. Bloquear exposição clínica, falhas de autorização, replay incompatível, sessão expirada e resposta tardia após encerramento.
6. Qualificar comportamento em navegador/dispositivo e interrupção de rede antes de qualquer lançamento.
7. Exigir autorização separada para merge, deploy, AWS, provedores e produção.

## Decisão

**GO** para revisão documental e testes sintéticos isolados. **NO-GO** para integração real, merge, publicação ou produção. Preservar PRs #3/#4 e versões históricas.
