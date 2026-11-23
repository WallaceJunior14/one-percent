# Plan 002 — Regras configuráveis e contrato evolutivo

Spec: [spec.md](./spec.md)

## Stack

Sem tecnologia nova. Tudo usa o que o projeto já tem.

| Camada | Escolha | Motivo |
|---|---|---|
| Configuração do pipeline | `config/pipeline.yaml` validado com pydantic, ao lado do `areas.yaml` | Mesmo padrão já usado para áreas e fontes; erro de valor falha antes de coletar (H7-2) |
| Configuração do build do app | `expo.extra` no `app.json`, lido com `expo-constants` | Já é dependência do app; o valor muda por build, sem mexer no código (RF-111) |
| Catálogo de textos | Módulo TypeScript `shared/i18n/pt-BR.ts` + `Intl.PluralRules` | Sem biblioteca nova; tipado, então texto faltando é erro de compilação (H8) |
| Dados locais versionados | Envelope `{ version, data }` + migrações em código | O AsyncStorage não tem versão; a migração fica testável sem o aparelho (RF-103) |

## Ordem de entrega (obrigatória)

O app instalado hoje rejeita campos desconhecidos. Por isso:

1. **App tolerante primeiro** (H1, H2): passa a ignorar campos novos e a descartar só o card inválido. Precisa estar no celular **antes** do passo 2.
2. **Contrato com campos novos opcionais** (catálogo com pesos, parâmetros do feed).
3. **Pipeline publica os campos novos** e passa a ler sua configuração.
4. **App usa os campos novos**, com os valores atuais como padrão quando ausentes.

Os passos 1 e 2 ficam em commits separados do passo 3, e o passo 3 só vai para o `main` depois de confirmado o app novo no celular.

## Arquitetura

```
config/areas.yaml (áreas, peso, grupo, fontes)    config/pipeline.yaml (operação)
            │                                              │
            └──────────────► pipeline ◄────────────────────┘
                               │  limites de texto lidos do schema do contrato
                               ▼
     latest.json  { schemaVersion: 1, catalog: {groups, areas+weight}, settings: {...}, cards, stories }
                               │
                               ▼
app: parseDailyContent (tolerante) → catalogRepository (último catálogo, fallback embutido)
                                   → feedSettings (publicado ou padrão)
                                   → composeFeed(pesos por área) → telas (textos do catálogo i18n)
```

## Modelo de dados e contratos

### Contrato (`contracts/daily-content.schema.json`), versão principal 1

Mudanças **aditivas** (não mudam `schemaVersion`):

```jsonc
{
  "schemaVersion": 1,
  "groups": [{ "id": "scitech", "name": "Ciência & Tecnologia" }],          // novo, opcional
  "areas": [{ "id": "tech", "name": "Tecnologia", "groupId": "scitech",      // groupId e weight: novos, opcionais
              "weight": 0.25, "subareas": [...] }],
  "settings": {                                                              // novo, opcional
    "feedSize": 15, "minPaperShare": 0.3, "quizQuestions": 3,
    "publishIntervalHours": 24, "freshnessToleranceHours": 6, "secondsPerCard": 40
  },
  "cards": [...], "stories": [...]
}
```

- `quiz.options`: de "exatamente 4" para 2 a 6; `answerIndex` < tamanho de `options`.
- `stories[].slides`: de 3 a 5 para pelo menos 1 (a faixa vira configuração do pipeline).
- O schema continua com `additionalProperties: false` **para o produtor**: o pipeline valida a própria saída de forma estrita e pega seus bugs. A tolerância é só do leitor (app).
- Política de versão registrada no **ADR 0007**: campo novo opcional → mesma versão principal; remoção, mudança de tipo ou de significado → versão principal nova, publicada em `latest-v2.json` ao lado de `latest.json` durante a transição.

### App: leitura tolerante (RF-101)

- `z.object` (remove campos desconhecidos) no lugar de `z.strictObject`.
- `parseDailyContent(raw)` valida o envelope; cada card passa por `safeParse` individual. Card inválido ou de `type` desconhecido sai da lista e vai para `diagnostics.droppedCards` com o motivo. Stories cujas manchetes apontem para cards descartados perdem essas manchetes, e a story some se ficar vazia.
- `schemaVersion` maior que `SUPPORTED_SCHEMA_VERSION` → `UnsupportedContentVersionError`. O `resolveContent` trata como conteúdo indisponível e devolve `updateSuggested: true`.

### App: dados locais versionados (RF-103)

```ts
createVersionedStore<T>({ key, version, schema, migrations, legacyKeys })
  .read(): Promise<T | null>     // migra versões antigas; ilegível → cópia em `${key}.unreadable.<timestamp>` + diagnóstico
  .write(value: T): Promise<void>
```

- Envelope gravado: `{ "version": 2, "data": ... }`.
- Leitura das chaves atuais sem envelope (`progress.v1`, `saved.v1`, `quiz.v1`, `preferences.v1`, `stories.seen.v1`, `reminder.v1`, `content.latest`) como versão 1, migrada na primeira leitura (`legacyKeys`).
- Cada repositório tem seu próprio store, então uma chave ilegível não afeta as outras (H2-3).

### App: catálogo e composição (RF-104, H3)

- `catalogRepository.current()`: catálogo do último conteúdo baixado; sem nenhum, o catálogo embutido (`shared/config/areas.ts`, agora com `weight` e `groupId`).
- `validatePreferences` deixa de lançar erro por área desconhecida: remove as áreas que não existem mais. Lista vazia → onboarding (H3-3).
- `composeFeed(content, preferences, settings)`:
  1. Divide `settings.feedSize` entre as **áreas escolhidas** pelo peso de cada uma (maior resto; empate pela ordem do catálogo).
  2. Pega os cards de cada área pelo rank (filtrando subáreas, como hoje).
  3. A cota que uma área não preencher vai para as outras, na proporção dos pesos.
  4. Garante a fatia mínima de artigos, trocando a pior notícia pelo melhor artigo da mesma área ou, se não houver, do mesmo grupo.
  5. Intercala por área.
- Pesos padrão do catálogo embutido: Tecnologia 0,25, Ciência 0,25, Economia, Finanças e Saúde 1/6 cada. Com todas as áreas escolhidas, o resultado é o da spec 001 (8 + 7). **Muda** com escolha parcial: Tecnologia + Economia fica 9 + 6 (proporcional aos pesos), e não mais 8 + 7.

### App: parâmetros do feed (RF-105, H4)

- `resolveFeedSettings(content.settings)` → `{ ...FEED_DEFAULTS, ...publicados }`, com cada valor validado e o padrão no lugar do inválido.
- Contador: "n de N vistos", com N = `cards.length` (H4-1).
- Encerramento: se `cards.length < settings.feedSize`, mostra o aviso de menos conteúdo hoje (H4-2).
- Lembrete: `body` montado com `settings.feedSize` e `ceil(feedSize × secondsPerCard / 60)` min, a partir das configurações do último conteúdo (H4-3).
- `selectQuiz(feed, settings.quizQuestions)`.

### App: atualidade (RF-106, H5)

```
idade = agora − generatedAt
idade < publishIntervalHours                      → usa o cache, sem rede
idade ≥ publishIntervalHours                      → tenta baixar; fica com o mais novo
idade do melhor > intervalo + tolerância          → aviso de conteúdo anterior
```

A sequência e o quiz continuam usando a data do celular (spec 001, H4-5).

### Pipeline: `config/pipeline.yaml` (RF-107, RF-108, RF-110)

```yaml
content:
  timezone: America/Sao_Paulo
  publish_deadline: "07:00"          # informativo: o agendador usa este horário
  retention_days: 7
  windows: { news_hours: 36, paper_days: 7 }
  min_cards: { total: 15, per_group: 7 }
  stories: { min_slides: 3, max_slides: 5 }
  quiz: { distractors: 3 }
feed:                                 # publicado em `settings` para o app
  size: 15
  min_paper_share: 0.3
  quiz_questions: 3
  publish_interval_hours: 24
  freshness_tolerance_hours: 6
  seconds_per_card: 40
llm:
  model: claude-haiku-5-5
  max_items_per_run: 150
  max_tokens: 2048
  batch_timeout_minutes: 25
  prompt_target_ratio: 0.8           # fração do limite do contrato pedida ao LLM
  prompt_target_overrides: { title: 0.6, quiz: 0.5 }
  price_per_mtok: { input: 0.05, output: 0.25 } # Batch API (50% do preço padrão, prompts até 100 mil tokens); conferir na troca de modelo
budget:
  monthly_usd: 5
  alert_ratio: 0.8                   # alerta se o custo estimado do mês passar de 80% do orçamento
```

- `areas.yaml` ganha `groups:` e, em cada área, `group:` e `weight:`.
- Ranking (meias-vidas, bônus, cotas por tipo), dedupe (limiar, stopwords) e classificação **ficam no código**, como constantes nomeadas: são algoritmo, não operação, e mudá-los pede teste novo.
- `ContentSettings` (pydantic) é injetado em `run_pipeline`, `build_day`, `publish`, `prune_old_days`, `is_within_window`, `AnthropicSummarizer` e `build_card`, sem leituras globais.

### Pipeline: limites de texto (RF-109, H6)

- `contract.text_limits()` lê os `maxLength` de `$defs` no schema (`shortText`, `mediumText`, `longText`, `originalTitle`).
- `Summary` e `Quiz` são montados a partir desses limites (`pydantic.create_model`), com a quantidade de alternativas vinda de `quiz.distractors`.
- O prompt é um template preenchido com `limite × prompt_target_ratio` (ou o override do campo).
- `shorten(text, limit)`: corta no último `. ! ?` seguido de espaço dentro do limite; senão, no último espaço, com `…`. Roda nos campos de texto antes da validação; o relatório conta `shortened_fields`.

### Pipeline: mínimo por grupo e custo (H7-3, H7-4)

- `publish` só grava se `total ≥ min_cards.total` **e** cada grupo com áreas no catálogo tiver `≥ min_cards.per_group` cards.
- `RunReport.estimated_cost_usd` = tokens × `price_per_mtok`. Alerta no log (`::warning::` no Actions) se `custo × 30 > monthly_usd × alert_ratio`.

### App: textos (RF-112, H8)

- `shared/i18n/pt-BR.ts` exporta um objeto `t` com strings e funções (`t.feed.seen(n, total)`, `t.streak.days(n)`, `t.reminder.body(cards, minutes)`).
- `plural(n, { one, other })` com `Intl.PluralRules('pt-BR')`.
- Componentes importam `t`, e nenhum texto visível fica escrito no JSX. Os testes continuam procurando os textos em português, o que prova que nada mudou para o usuário.

### App: endereço do conteúdo (RF-111)

- `app.json` → `expo.extra.contentBaseUrl`; `dependencies.ts` lê com `Constants.expoConfig?.extra?.contentBaseUrl` e falha com mensagem clara se faltar.

## Estratégia de testes

| Tipo | O que cobre | Ferramenta |
|---|---|---|
| Unitário (app) | leitor tolerante, versão não suportada, store versionado e migrações, catálogo, `composeFeed` por peso, `resolveFeedSettings`, atualidade, mensagem do lembrete, `plural` | Jest |
| Componente (app) | contador "n de N", aviso de feed curto, onboarding com catálogo publicado | RNTL |
| Unitário (pipeline) | `pipeline.yaml` válido e inválido, `text_limits`, prompt derivado, `shorten`, mínimo por grupo, custo estimado | pytest |
| Contrato | `sample-day.json` com os campos novos é válido nos dois lados; um payload com campo desconhecido e um card inválido é lido pelo app sem perder os outros cards | pytest + Jest |
| Fonte única (RNF-103) | o catálogo embutido no app é igual ao `areas.yaml` (ids, nomes, grupos, pesos); o prompt não tem números escritos à mão; `FEED_DEFAULTS` do app é igual a `feed:` do `pipeline.yaml` | pytest + Jest |
| Compatibilidade | `latest.json` gerado pelo pipeline novo é lido pelo parser do app (fixture compartilhada) | Jest |

Fakes: relógio (`fixedClock`), armazenamento (`createMemoryStore`), API de conteúdo; no pipeline, o `FakeSummarizer` e o `MockTransport` do httpx, como hoje.

## Rastreabilidade

| Requisito | Módulo / componente |
|---|---|
| RF-101 | `app/src/features/content/contract.ts`, `resolveContent.ts` |
| RF-102 | `docs/adr/0007-versao-do-contrato.md`, schema |
| RF-103 | `app/src/shared/lib/versionedStore.ts` + repositórios |
| RF-104 | `areas.yaml`, `publishing/day.py`, `app/.../catalog.ts`, `composeFeed.ts`, `preferences.ts` |
| RF-105 | `pipeline.yaml`, `feedSettings.ts`, `composeFeed.ts`, `selectQuiz.ts`, `FeedScreen.tsx` |
| RF-106 | `resolveContent.ts` |
| RF-107, RF-108, RF-110 | `config/pipeline.yaml`, `config/__init__.py`, `publishing/day.py`, `domain/window.py`, `summarizer/anthropic.py`, `cli.py` |
| RF-109 | `contract.py`, `summarizer/__init__.py`, `summarizer/anthropic.py`, `summarizer/shorten.py` |
| RF-111 | `app.json`, `dependencies.ts` |
| RF-112 | `app/src/shared/i18n/` + componentes |

## Riscos e decisões

| Risco | Mitigação |
|---|---|
| Publicar campos novos antes de o app tolerante estar no celular | Ordem de entrega obrigatória; teste de contrato com campo desconhecido antes de mudar o pipeline |
| Mudança de divisão com escolha parcial de áreas (peso por área) | Padrões reproduzem o 50/50 com todas as áreas; mudança registrada na spec e no CHANGELOG |
| Migração de dados locais com bug apaga progresso | Nada é apagado: o valor original fica copiado antes da migração; teste com dados reais exportados do formato v1 |
| Encurtar texto muda o sentido | Corte só em fim de frase; reticências quando não houver; relatório com a contagem para acompanhar |
| `create_model` dinâmico perde checagem de tipos | Tipos públicos (`Summary`) continuam declarados; os limites entram por `Annotated` montado na importação |
| Preço do modelo desatualizado na configuração | O custo é rotulado como estimativa; a troca de modelo pede conferir o preço (comentário no YAML) |

## Histórico

| Data | Mudança | Motivo |
|---|---|---|
| 2026-11-22 | Criação | Spec 002 aprovada |
