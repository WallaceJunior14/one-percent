# Plan 003 — Histórico das publicações capturadas

Spec: [spec.md](./spec.md)

## Stack

| Camada | Escolha | Motivo |
|---|---|---|
| Armazenamento | **Repositório GitHub privado** `one-percent-history`, com arquivos JSON e JSONL compactados (gzip), só acrescentados | Custo zero, sem fornecedor novo, formato aberto (RF-214), versionado e com cópia completa a cada `git clone`. Decisão registrada no **ADR 0008** |
| Escrita | Pacote da execução (pasta `history-out/`) gerado pelo pipeline, criptografado e entregue a um job `record` que só aplica e faz o push | Mantém a separação que o workflow já tem: quem processa conteúdo externo não tem permissão de escrita (padrão do job `publish`) |
| Leitura no pipeline | Clone parcial e esparso (sem blobs, só as pastas necessárias) antes do passo que gera o conteúdo, com chave somente leitura | Lê poucos KB por execução; a chave de leitura nunca fica no mesmo passo que a chave do LLM |
| Consultas do mantenedor | Índice **SQLite local** (`sqlite3` da biblioteca padrão, com FTS5 para busca), montado a partir de um clone do histórico | Nenhum serviço para manter; o índice é descartável e pode ser refeito a partir dos arquivos |
| Modelos dos registros | pydantic, como o resto do pipeline | Validação na leitura e na escrita; versão de formato explícita (RNF-209) |
| Criptografia do pacote | `openssl enc -aes-256-cbc -pbkdf2`, já instalado no runner | Os artefatos de um repositório público podem ser baixados por qualquer conta do GitHub; o pacote criptografado mantém o histórico privado (RNF-206) |

Nenhuma dependência Python nova. O app não muda.

### Alternativas de armazenamento (resumo do ADR 0008)

| Opção | Prós | Contras |
|---|---|---|
| Repositório privado com arquivos (escolhida) | US$ 0; sem conta nova; formato aberto; backup = clone; histórico do git audita cada escrita | Retenção só limpa a versão atual (o git guarda o passado); consultas precisam do índice local; tamanho do repositório tem limite recomendado |
| SQLite hospedado (Cloudflare D1, Turso) | SQL e busca prontos; apagar de verdade | Conta e fornecedor novos; regras de cota gratuita mudam; escrita por API HTTP a partir do Actions; exportação depende de ferramenta |
| Postgres gratuito (Supabase, Neon) | Banco completo | Cotas gratuitas de ~0,5 GB não comportam 3 anos (RNF-203); projeto parado pode ser pausado; fornecedor novo |
| Armazenamento de objetos (R2, B2) + arquivos | Apagar de verdade; cotas grandes | Fornecedor e credencial novos; ainda precisa do índice local |
| Branch `gh-pages` ou repositório público | Já existe | Público: viola a decisão 1 da spec (RNF-206) |
| Artefatos do Actions | Já existe | Expiram em no máximo 90 dias |

As cotas e recomendações citadas (tamanho de repositório, cotas gratuitas) devem ser conferidas na documentação oficial na hora de implementar; o ADR registra a data da consulta.

## Ordem de entrega

A implementação começa **depois** que as tasks de pipeline da spec 002 estiverem no `main`. As duas mexem em `pipeline.py`, no `Summarizer` e no `RunReport`.

1. **Gravar** (H1): registros, pacote, job `record`, repositório privado e chaves. O pipeline ainda não lê o histórico.
2. **Importar** os dias ainda publicados (H2-3), logo que a gravação funcionar, antes que saiam do `gh-pages`.
3. **Ler** no pipeline: comparação com dias anteriores (H4) e custo acumulado do mês (H3-2).
4. **Consultar** localmente: índice e comandos (H2, H3, H7).
5. **Reprocessar** (H5).
6. **Avaliar** a qualidade (H6) e migrar a tabela da medição.

## Arquitetura

```
                    ┌──────────── job generate (repositório público, sem escrita) ───────────┐
 one-percent-history │ 1. history patterns (sem segredo)  → lista de pastas a ler             │
 (privado)  ──clone──┼▶2. fetch (chave SOMENTE LEITURA)   → history-in/  (falha = segue sem)  │
   ▲                 │ 3. run (chave do LLM)  ── lê history-in, grava site/ e history-out/    │
   │                 │ 4. encrypt history-out (senha do pacote) → artefato "history" (1 dia)  │
   │                 └─────────────────────────────────────────────────────────────────────────┘
   │                          │ site/                                 │ history.enc
   │                 ┌────────▼─────── job publish ───────┐           │
   │                 │ copia para gh-pages; saída: pushed │           │
   │                 └────────┬───────────────────────────┘           │
   │                 ┌────────▼────────── job record (if: always) ────▼─────────────────────┐
   └──────push───────┤ decrypt → apply.py (só stdlib): valida, copia, marca publicação,     │
     (chave ESCRITA) │ aplica retenção, soma o uso → commit → push (rebase e 1 nova tentativa)│
                     └───────────────────────────────────────────────────────────────────────┘

 mantenedor: git clone one-percent-history → python -m one_percent history <consulta> --repo <clone>
             (índice SQLite local em <clone>/.index/, fora do git)
```

### Passagens de dados no pipeline

```
collect ─► window ─► dedupe ─► dedupe_against(dias anteriores) ─► select_top ─► summarize ─► build_card ─► build_day ─► publish
   │          │         │                 │                           │              │             │            │
   └──────────┴─────────┴─────────────────┴───── RunRecorder: decisão de cada item, tentativas de resumo, relatório ┘
                                                              │
                                                  bundle.write(history-out/)  (sempre, inclusive em falha: try/finally)
```

- `run_pipeline` é dividido em `collect_stage` (fontes → itens) e `process_stage(items, now, …)` (janela → publicação). O reprocessamento chama só o `process_stage`, com os itens lidos do histórico (H5-1).
- O `Summarizer` passa a devolver `SummarizeOutcome(summaries, attempts, usage)`, em vez de só o dicionário de resumos. `attempts` traz, por item, o tipo do resultado, o `stop_reason`, o texto bruto, os erros de validação e os encurtamentos (RF-204). Hoje esses dados só vão para o log.

## Estrutura de pastas

```
pipeline/src/one_percent/
├── history/
│   ├── __init__.py
│   ├── records.py       # formato v1: RunRecord, ItemRecord, SummaryAttempt, DayRecord, Rating; Decision; migrações
│   ├── recorder.py      # RunRecorder: acumula decisões e tentativas durante a execução
│   ├── bundle.py        # grava history-out/ (pacote de uma ou mais execuções)
│   ├── reader.py        # HistoryReader: itens publicados na janela, custo do mês, itens de uma execução
│   ├── site_import.py   # importa daily/*.json do gh-pages como dias "importados"
│   ├── apply.py         # SÓ BIBLIOTECA PADRÃO: valida o pacote e aplica no clone; retenção; uso
│   ├── index.py         # índice SQLite (FTS5) a partir do clone
│   ├── queries.py       # day, cost, sources, ops, versions, search, sample
│   └── ratings.py       # avaliações de qualidade
├── domain/
│   ├── dedupe.py        # + dedupe_against(items, previous)
│   └── budget.py        # custo acumulado + projeção do mês
├── pipeline.py          # collect_stage / process_stage + RunRecorder
└── cli.py               # run --history-in/--history-out/--run-id; reprocess; history <sub>
pipeline/tests/history/  # fixtures: árvore de histórico mínima em tmp_path
docs/adr/0008-historico-em-repositorio-privado.md
docs/ops/historico.md    # criar o repositório, as deploy keys e a senha; consultas; compactação
```

## Modelo de dados e contratos

### Repositório `one-percent-history`

```
FORMAT.md                                   # descrição do formato e das versões (gerado do records.py)
runs/AAAA/MM/DD/<runId>/
    run.json                                # metadados da execução (sem prazo)
    report.json                             # relatório (sem prazo)
    items.jsonl.gz                          # itens coletados + decisão (retenção: 180 dias)
    summaries.jsonl.gz                      # tentativas de resumo (retenção: 180 dias)
    publication.json                        # escrito pelo job record: o conteúdo chegou ao app?
days/AAAA-MM-DD/<runId | imported>/
    content.json                            # bytes idênticos ao daily/AAAA-MM-DD.json publicado (H2-1)
    provenance.jsonl.gz                     # por card: item de origem + resumo (sem prazo)
    content-v<N>.json                       # só durante uma transição de versão principal (ADR 0007): o outro formato publicado
    meta.json                               # runId, schemaVersion, contractHash, imported
    published.json                          # escrito pelo job record quando chegou ao app
ratings/AAAA-Www.jsonl                      # avaliações de qualidade (sem prazo)
stats/usage.json                            # bytes acumulados escritos (estimativa do tamanho, RNF-202)
```

A data de `runs/` é a do conteúdo (`local_date`), para que retenção e consultas por dia usem a mesma data que o app vê.

### `run.json` (formato 1)

```jsonc
{
  "formatVersion": 1,
  "runId": "gh-12345678-1-a2",          // GITHUB_RUN_ID-RUN_ATTEMPT-tentativa do passo; local: "local-<UTC>-<aleatório>"
  "trigger": "schedule",                 // schedule | dispatch | reprocess | import | local
  "status": "generated",                 // generated | not_published | skipped | failed
  "reason": null,                        // ex.: "below_min_cards", "summarizer_timeout", "already_published_today"
  "contentDate": "2026-11-23",
  "startedAt": "2026-11-23T06:17:04Z", "endedAt": "2026-11-23T06:41:10Z",
  "pipelineVersion": "<sha do commit>",
  "schemaVersion": 1,                    // versão principal do contrato (ADR 0007)
  "contractHash": "<sha256 do schema, 12 hex>", // distingue mudanças aditivas dentro da mesma versão principal
  "sourceRunId": null,                   // reprocessamento: execução de onde vieram os itens
  "history": { "readAvailable": true },  // false: rodou sem ler o histórico (H4-4)
  "parameters": { /* pipeline.yaml + areas.yaml efetivos, já validados (RF-207) */ }
}
```

O estado "publicada" não é escrito pelo `generate`: ele vem do `publication.json` (H1-7). Um `runId` gravado de novo, com o mesmo conteúdo, não muda nada (H1-6). Com conteúdo diferente, o `apply.py` recusa.

### `items.jsonl.gz` (uma linha por item coletado)

```jsonc
{ "id": "c_1a2b3c4d5e6f", "sourceId": "arxiv-cs", "kind": "paper", "areaId": "tech", "subareaId": "ai",
  "title": "...", "url": "https://...", "publishedAt": "...", "summary": "...", "authors": ["..."],
  "venue": null, "isPreprint": true, "pdfUrl": "...", "popularity": 12, "sourceWeight": 1.0, "coverage": 2,
  "decision": "duplicate",               // card | out_of_window | duplicate | already_published | below_rank
                                         // | over_item_limit | no_summary | invalid_summary | invalid_card
  "duplicateOf": "c_9f8e...",            // duplicate / already_published
  "alreadyPublishedOn": null,            // already_published: data do card anterior
  "rank": null, "score": null }
```

`id` é o `card_id(item)` de hoje (hash da URL canônica), então o mesmo item em dias diferentes tem o mesmo `id` (RF-203).

### `summaries.jsonl.gz` (uma linha por item enviado ao LLM)

```jsonc
{ "itemId": "c_...", "model": "claude-haiku-5-5", "promptVersion": "<sha256 do prompt montado, 12 hex>",
  "resultType": "succeeded",             // succeeded | errored | expired | canceled
  "stopReason": "end_turn", "rawText": "{...}",
  "validation": "ok",                    // ok | invalid
  "errors": [], "shortened": [{ "field": "summary", "from": 640, "to": 598 }],
  "final": { /* Summary */ }, "usage": { "input": 812, "output": 403 } }
```

### `report.json`

O `RunReport` da spec 002 (contagens, custo estimado, encurtamentos, alertas), mais:

```jsonc
{ "discards": { "out_of_window": 120, "duplicate": 31, "already_published": 9, "below_rank": 210, "no_summary": 2 },
  "failedSources": [{ "id": "rss-x", "reason": "HTTP 503", "attempts": 3 }],
  "tokens": { "input": 70211, "output": 35102 }, "estimatedCostUsd": 0.0123,
  "crossDayDedupe": { "applied": true, "windowDays": 7, "removed": 9 },
  "budget": { "monthToDateUsd": 0.31, "projectedMonthUsd": 0.44, "basis": "history" } }  // basis: history | single_run
```

### `publication.json` / `published.json` (escritos pelo job `record`)

```jsonc
{ "published": true, "publishJob": "success", "ghPagesCommit": "<sha>", "recordedAt": "..." }
```

`published` é `true` só se o job `publish` terminou com sucesso **e** fez push (`pushed=true`). Um reprocessamento sem republicação grava `published: false`.

### Configuração (`config/pipeline.yaml`, da spec 002)

```yaml
history:
  enabled: true                 # false: não lê nem grava (o pipeline volta ao comportamento da 002)
  repeat_window_days: 7         # 0 desliga a comparação com dias anteriores (RF-209)
  retention:
    raw_days: 180               # items.jsonl.gz e summaries.jsonl.gz (RNF-208)
  quota_bytes: 1000000000       # limite de referência do repositório (RNF-202)
  quota_alert_ratio: 0.8
budget:
  projection_min_days: 3        # abaixo disso, a projeção usa a regra da 002 (custo × dias do mês)
```

Validado na partida como o resto do `pipeline.yaml` (spec 002, H7-2). Esses valores entram no `parameters` do `run.json`.

### Portas e funções

```python
class HistoryReader(Protocol):
    def published_items(self, since: date, until: date) -> Sequence[PublishedItem]: ...
    # itens de origem dos cards publicados (provenance); dias importados: só url, id e originalTitle
    def month_runs(self, month: str) -> Sequence[RunCost]: ...
    def run_items(self, run_id: str) -> Sequence[ContentItem]: ...

class HistoryUnavailable(Exception): ...     # pasta ausente ou ilegível → pipeline segue sem ler

def dedupe_against(items, previous: Sequence[PublishedItem]) -> tuple[list[ContentItem], list[Discard]]
# mesmas regras do dedupe (URL canônica e semelhança de título na mesma subárea), usando o
# título ORIGINAL do item anterior (provenance), e não o título do card em português

def month_projection(runs, today, days_in_month, min_days) -> BudgetProjection
```

- Os itens lidos do histórico passam pela validação do `records.py` antes de entrar no `process_stage`, e o LLM os recebe com o mesmo enquadramento de conteúdo não confiável da coleta (H5-5).
- `apply.py` não importa nada do pacote `one_percent` (roda sem `pip install` no job `record`). Valida cada caminho contra uma lista de padrões permitidos (`runs/AAAA/MM/DD/<runId>/<arquivo conhecido>`, `days/...`), recusa `..`, links e arquivos acima de um tamanho máximo, e nunca apaga fora da retenção (RNF-210).
- Retenção: o `apply.py` lista `runs/` com `git ls-tree` (passado pelo workflow como lista de caminhos) e remove só `items.jsonl.gz` e `summaries.jsonl.gz` com data anterior ao corte. `run.json`, `report.json` e tudo em `days/` ficam. Os cards publicados não perdem a origem, porque ela está em `provenance.jsonl.gz` (RNF-208).

### Linha de comando

| Comando | Onde roda | Para quê |
|---|---|---|
| `run --history-in DIR --history-out DIR --run-id ID` | `generate` | Execução diária com leitura e gravação |
| `history patterns --now T` | `generate`, sem segredo | Imprime as pastas do clone esparso: `days/` da janela de repetição e `runs/AAAA/MM/` do mês, ou a execução a reprocessar |
| `reprocess --from-run ID [--republish]` | `generate` (via `workflow_dispatch`) | H5. Usa os parâmetros do commit em que o workflow roda: para testar outros, rodar o workflow num branch (`gh workflow run --ref`) |
| `history import-site DIR` | `generate` (via `workflow_dispatch`) | H2-3 / RF-211, idempotente |
| `history index --repo CLONE` | local | Monta ou atualiza o índice (incremental, por caminho e hash) |
| `history day DATE [--version ID]` | local | H2-1: imprime o `content.json` |
| `history cost MONTH` | local | H3-1 |
| `history sources [--since DATE]` | local | H3-3: falhas e sequência de falhas por fonte |
| `history ops --from D --to D` | local | H3-4 |
| `history versions DATE` | local | H5-2: cards e custo de cada versão lado a lado |
| `history search TERM [--area --subarea --source --kind --status --from --to]` | local | H7 |
| `history sample --week AAAA-Www` | local | H6-3: 10 cards variados ainda não avaliados |
| `history rate CARD --precise/--imprecise --note TEXT` | local | H6-1: acrescenta em `ratings/`; o mantenedor faz commit e push |

### Workflow `daily-content.yml`

- Novos `workflow_dispatch.inputs`: `reprocess_run_id` (texto), `republish` (booleano), `import_site` (booleano).
- `generate`: passos 1–4 da arquitetura. O passo de leitura usa `continue-on-error: true`: sem `history-in/`, o pipeline grava `readAvailable: false` e segue (H4-4, RNF-207). O artefato `history` sobe com `if: always()` para registrar também as falhas (H1-2), com `retention-days: 1`.
- `publish`: ganha a saída `pushed` (`true` se houve commit no `gh-pages`) e o sha do commit.
- `record` (novo): `needs: [generate, publish]`, `if: always()` e o artefato existir. `permissions: {}` neste repositório; escreve no histórico só com a deploy key de escrita. Um erro aqui gera `::warning::`, mas não falha a execução do dia (RNF-207).
- Segredos novos: `HISTORY_READ_KEY` (deploy key somente leitura), `HISTORY_WRITE_KEY` (deploy key com escrita, só no job `record`), `HISTORY_BUNDLE_PASSPHRASE`. Cada chave vale só para o `one-percent-history`. A configuração fica em `docs/ops/historico.md`.

### Volume estimado (confirmar na primeira semana pelo `report.json`)

Premissas: ~500 itens coletados por execução (~1,2 KB cada), ~150 resumos (~2,5 KB), dia publicado ~150 KB, uma execução completa por dia (as puladas têm ~1 KB).

| Arquivo | Por dia (compactado) | 1 ano |
|---|---|---|
| `items` + `summaries` | ~250 KB | ~90 MB (na versão atual, no máximo 180 dias: ~45 MB) |
| `days/` + `run`/`report` | ~150 KB | ~55 MB |
| **Repositório (com o passado no git)** | ~400 KB | **~145 MB → ~450 MB em 3 anos** |

Fica abaixo de 1 GB em 3 anos (RNF-203). O `stats/usage.json` acompanha o total, e o alerta dispara ao passar de 80% do `quota_bytes`. Se o crescimento for maior que o estimado, `docs/ops/historico.md` descreve a compactação: novo commit raiz com a versão atual e push forçado, depois de um `git clone --mirror` como backup.

### Custo

| Item | Custo |
|---|---|
| Repositório privado no plano gratuito do GitHub | US$ 0 (sem cobrança por armazenamento de git; nada de LFS) |
| Minutos do Actions | US$ 0: o workflow continua no repositório público |
| Artefatos | US$ 0 (repositório público; 1 dia) |
| LLM | Só nos reprocessamentos pedidos, contados no mês (H5-4) |

Não há forma de pagamento ligada ao histórico, então chegar ao limite não gera cobrança (RNF-202).

## Estratégia de testes

| Tipo | O que cobre | Ferramenta |
|---|---|---|
| Unitário | `records` (ida e volta, versão desconhecida, migração), `RunRecorder` (decisão certa em cada etapa), `dedupe_against` (URL, título original, janela 0, dia importado), `month_projection`, `reader` (pasta ausente → `HistoryUnavailable`), padrões do `history patterns` | pytest |
| Unitário (`apply.py`) | caminhos permitidos e recusados (`..`, link, desconhecido, grande demais), idempotência, recusa de conteúdo diferente no mesmo `runId`, retenção (só arquivos brutos, só antes do corte), `publication.json`, `usage.json` | pytest, sem importar o pacote |
| Integração | `run_pipeline` com fontes falsas, `FakeSummarizer` e `history-in`/`history-out` em `tmp_path`: H1-1 a H1-6, H4-1 a H4-5, H3-2; `reprocess` (H5-1, H5-3, H5-4); `import-site` duas vezes (RF-211) | pytest |
| Integração (consultas) | índice montado de uma árvore de histórico de exemplo; cada comando de `queries`; busca com filtros; índice refeito do zero dá o mesmo resultado | pytest + `sqlite3` |
| Aceitação | um teste por critério de aceite, nomeado pelo critério (`test_h1_2_records_run_that_did_not_publish`) | pytest |
| Segurança | o pacote gerado com `ANTHROPIC_API_KEY` falsa no ambiente não contém o valor (RNF-205); `content.json` do histórico é byte a byte igual ao publicado | pytest |
| Formato aberto | todos os arquivos de uma árvore de exemplo são lidos só com `json` e `gzip` (RF-214) | pytest |
| Workflow | execução manual com `fake=true` num repositório de histórico de teste; `actionlint`, se já estiver no CI | GitHub Actions |

Dependências externas nos testes: o histórico é uma pasta (`tmp_path`), então não há git nem rede no pytest. O LLM continua no `FakeSummarizer` e as fontes no `MockTransport`. As operações de git ficam no workflow e são verificadas na execução manual.

## Rastreabilidade

| Requisito | Módulo / componente |
|---|---|
| RF-201 | `history/records.py` (`RunRecord`), `cli.py` (try/finally grava sempre), job `record` |
| RF-202, RF-203 | `history/recorder.py`, `records.py` (`ItemRecord`, `Decision`), `domain/identity.py` |
| RF-204 | `summarizer/__init__.py` (`SummarizeOutcome`), `summarizer/anthropic.py`, `summarizer/fake.py` |
| RF-205 | `history/bundle.py` (`days/…/content.json`, `provenance`) |
| RF-206 | `pipeline.py` (`RunReport`), `recorder.py` |
| RF-207 | `config/__init__.py` (snapshot efetivo), `records.py` |
| RF-208 | `history/index.py`, `queries.py`, `cli.py` |
| RF-209 | `domain/dedupe.py` (`dedupe_against`), `history/reader.py`, `pipeline.py` |
| RF-210 | `pipeline.py` (`process_stage`), `cli.py` (`reprocess`), workflow (`reprocess_run_id`, `republish`) |
| RF-211 | `history/site_import.py`, workflow (`import_site`) |
| RF-212 | `history/ratings.py`, `queries.py` |
| RF-213 | `history/index.py` (FTS5), `queries.py` |
| RF-214 | formato em arquivos + `FORMAT.md`; teste de leitura só com `json`/`gzip` |
| RNF-201, RNF-202, RNF-203 | ADR 0008, `apply.py` (`usage.json`), alerta no job `record` |
| RNF-204, RNF-205, RNF-206 | repositório privado, pacote criptografado, deploy keys separadas, teste de segredo no pacote |
| RNF-207 | `continue-on-error` na leitura, `record` com `if: always()` sem falhar o dia, `HistoryUnavailable` |
| RNF-208 | `apply.py` (retenção), `config.history.retention` |
| RNF-209 | `records.py` (`formatVersion`, migrações), `FORMAT.md` |
| RNF-210 | `apply.py` (lista de caminhos permitidos, sem sobrescrever) |
| RNF-211 | `HistoryReader` como porta; testes com `tmp_path` |

## Riscos e decisões

| Risco | Mitigação |
|---|---|
| Mudança no `Summarizer` e no `pipeline.py` em conflito com a spec 002 | Só começar depois que as tasks de pipeline da 002 estiverem no `main` |
| O repositório cresce mais que o estimado | `usage.json` + alerta a 80%; medir na primeira semana; procedimento de compactação documentado |
| Retenção não apaga do passado do git | Aceito no ADR 0008: o conteúdo é público e o objetivo da retenção é volume. A compactação remove de fato quando for preciso |
| Vazamento de uma deploy key | Chaves separadas por função e restritas a um repositório; a de escrita só existe no job `record`, que não processa conteúdo externo; troca descrita em `docs/ops/historico.md` |
| `apply.py` roda com permissão de escrita sobre dados derivados de conteúdo externo | Só biblioteca padrão; lista fechada de caminhos e tamanhos; não interpreta o conteúdo, só copia; pedir `dev-security` ao fim |
| Senha do pacote vaza | Impacto baixo (conteúdo público e dados de operação); troca simples do secret |
| Histórico fora do ar atrasa o dia | Leitura com `continue-on-error`; gravação no job seguinte, que não bloqueia o `publish` |
| Clone esparso e parcial é frágil | Padrões gerados e testados em Python; se falhar, segue sem histórico (H4-4) e registra |
| Duas escritas ao mesmo tempo (job e avaliação local) | `concurrency` do workflow serializa as execuções; o `record` faz `pull --rebase` e tenta de novo uma vez |
| Projeção de custo errada no início do mês | Abaixo de `projection_min_days`, volta à regra da 002 e registra `basis: single_run` |

Decisões que viram ADR: **0008 — histórico em repositório privado com arquivos** (armazenamento, separação leitura/escrita, criptografia do pacote, retenção e compactação).

## Histórico

| Data | Mudança | Motivo |
|---|---|---|
| 2026-11-22 | Criação | Spec 003 aprovada |
