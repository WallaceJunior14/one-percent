# Code Review — MVP completo (pipeline + app)

- **Data**: 2026-11-16
- **Escopo**: `pipeline/src/one_percent/**`, `app/src/**`, `.github/workflows/daily-content.yml` (commit `f6872d7`)
- **Spec relacionada**: specs/001-mvp-feed-diario/spec.md
- **Veredito**: Aprovado com ressalvas

## Rodada de correções — 2026-11-16

| Resultado | Qtd |
|---|---|
| Corrigidos | 4 (CR-001 a CR-004) |
| Não procede | 0 |
| Adiados | 0 |
| Respondido (sem mudança de código) | 1 (CR-005) |

Não há Crítico nem Alto abertos; o ciclo está encerrado pelo critério de parada. Um re-review do diff das correções do CR-001 é opcional.

## Resumo

O código está bem estruturado: domínio puro e testado (ranking, deduplicação, composição do feed, sequência), portas injetáveis (`ContentSource`, `Summarizer`, `KeyValueStore`, `NotificationScheduler`) e falhas de rede tratadas como estado. A regra de segurança do LLM (URL, autores e datas sempre da fonte) é respeitada. O achado mais relevante está na coleta do bioRxiv, que lê só a página mais antiga da API e, na prática, não traz artigos das categorias grandes. Os demais são de robustez operacional.

| Severidade | Qtd |
|---|---|
| Crítico | 0 |
| Alto | 1 |
| Médio | 1 |
| Baixo | 2 |
| Pergunta | 1 |

## Achados

### CR-001 · [Alto] bioRxiv/medRxiv: só a página mais antiga é lida
- **Local**: `pipeline/src/one_percent/sources/biorxiv.py:31-40`
- **Problema**: a API `details/{server}/{inicio}/{fim}/{cursor}` devolve 30 itens por página, em ordem crescente de data. O adapter pede só `cursor=0`.
- **Cenário**: verificado em 16/11. `biorxiv` + `neuroscience` tem `total=349` na janela de 7 dias. A primeira página traz 30 artigos, todos de 09/11. Como `published_at` é meia-noite UTC dessa data, a idade passa de 7 dias e `is_within_window` descarta todos. Microbiologia, genômica e neurociência praticamente não chegam ao feed de Biologia; `psychiatry` (35 itens) perde os 5 mais novos.
- **Sugestão**: ler o `total` em `messages[0]` da primeira página e buscar as últimas páginas (as mais recentes), até um teto por categoria (ex.: 60 itens = 2 páginas).
- **Teste sugerido**: `test_fetches_the_newest_pages_when_results_are_paginated`, com uma resposta fake de `total=95`, que espera requisições aos cursores 35 e 65 e itens das datas mais novas.
- **Status**: Corrigido
- **Correção**: lê o `total` da primeira página e busca as páginas mais recentes, até 60 itens por categoria; a resposta "no posts found" vira lista vazia. Contra a API real em 16/11, o bioRxiv passou a ter 229 artigos na janela · testes: `tests/integration/test_biorxiv_source.py::test_fetches_the_newest_pages_when_results_are_paginated`, `::test_single_page_needs_a_single_request`, `::test_no_posts_found_is_an_empty_result`

### CR-002 · [Médio] A segunda tentativa pode ser morta pelo timeout do job
- **Local**: `pipeline/src/one_percent/summarizer/anthropic.py:27`, `.github/workflows/daily-content.yml:33,91`
- **Problema**: o batch espera até 50 min (`TIMEOUT_SECONDS`), o workflow repete após 5 min e o job tem `timeout-minutes: 75`.
- **Cenário**: num dia em que a Batch API demora, a tentativa 1 cancela o batch aos ~52 min. A tentativa 2 começa aos ~57 min e é morta aos 75 min, no meio do batch. Esse batch não é cancelado e é cobrado, e o dia não é publicado por essa execução.
- **Sugestão**: `TIMEOUT_SECONDS = 30 * 60`. Cada tentativa fica em ≤ ~32 min: 2 × 32 + 5 = 69 < 75.
- **Teste sugerido**: `test_two_attempts_fit_in_the_job_timeout`, que lê o `timeout-minutes` do workflow e verifica `2 × (TIMEOUT + margem de coleta) + espera < timeout do job`.
- **Status**: Corrigido
- **Correção**: `TIMEOUT_SECONDS` = 25 min, para que 2 × (25 + 5) + 5 = 65 min caiba nos 75 min do job · teste: `tests/unit/test_workflow_timeouts.py::test_two_attempts_fit_in_the_job_timeout`

### CR-003 · [Baixo] Erros não previstos saem com traceback e código 1
- **Local**: `pipeline/src/one_percent/cli.py:89-107`
- **Problema**: `SummarizerError` (batch esgotado) e `ContractViolationError` não são tratados. Eles saem com o código 1 por acaso (traceback do Python), não por decisão.
- **Cenário**: a violação de contrato é um bug determinístico; repetir após 5 min gasta outro batch (~US$ 0,02) para falhar igual.
- **Sugestão**: tratar `SummarizerError` como `EXIT_NOT_PUBLISHED` e `ContractViolationError` como `EXIT_PERMANENT_ERROR`, com log claro.
- **Teste sugerido**: `test_contract_violation_is_permanent` e `test_batch_timeout_is_retried` em `test_cli.py`.
- **Status**: Corrigido
- **Correção**: `SummarizerError` → código 1 (repete); `ContractViolationError` → código 2 (não repete), com log claro · testes: `tests/integration/test_cli.py::test_batch_timeout_exits_1_to_be_retried`, `::test_contract_violation_exits_2_without_retry`

### CR-004 · [Baixo] Onboarding pode travar na tela de lembrete com o lembrete desligado
- **Local**: `app/src/app/reminder.tsx:20-27`
- **Problema**: o fluxo só avança com `status === 'saved'`. Ao escolher "desligado", o serviço ainda chama `cancelAll()`. Se o módulo nativo rejeitar, o status é `unavailable` e "Começar" não leva ao feed.
- **Cenário**: aparelho em que as notificações não funcionam + usuário que não quer lembrete → fica parado na tela, mesmo sem ter pedido nada que dependa de notificação.
- **Sugestão**: avançar sempre que o pedido foi "desligado", ou seja, quando `!settings.enabled || status === 'saved'`.
- **Teste sugerido**: no serviço, `turning_off_is_saved_even_if_cancelling_fails`, que espera `status: 'saved'`.
- **Status**: Corrigido
- **Correção**: no serviço, desligar o lembrete devolve `saved` mesmo se `cancelAll` falhar, e a rota avança · teste: `reminderScheduler.test.ts::turning_off_is_saved_even_if_cancelling_fails`

### CR-005 · [Pergunta] Conteúdo de um dia anterior conta para a sequência de hoje
- **Local**: `app/src/features/feed/DailyFeed.tsx:96-101`, `app/src/features/streak/progress.ts:55-60`
- **Problema**: quando o pipeline falha, o feed mostra o dia anterior (H1-4), e "Concluir o dia" registra hoje.
- **Cenário**: pipeline falha num dia → quem já leu aqueles cards ontem os relê e mantém a sequência.
- **Leitura**: parece intencional e justo (a falha é do sistema, não do usuário). Se for, vale registrar na spec (H4).
- **Status**: Não procede
- **Decisão**: em 2026-11-16 o autor confirmou o comportamento atual; registrado na spec como H4-6

## Observações para o futuro

- 2% dos resumos ainda são descartados por `quiz.distractors` com tamanho diferente de 3, e alguns por `summary` acima de 600 caracteres. Isso não afeta o feed hoje: sobram mais de 90 cards para 15 vagas.
- As rotas em `app/src/app/*.tsx` são cola sem teste. A lógica fica nos componentes testados, mas um teste de navegação (Maestro, T103) cobriria o fluxo inteiro.
