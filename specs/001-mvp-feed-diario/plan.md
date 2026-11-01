# Plan 001 — MVP: Feed diário de conhecimento

Spec: [spec.md](./spec.md) · Status: Aprovado (2026-10-31) · Criado em: 2026-10-31

## Visão geral

O sistema tem duas partes independentes, ligadas por um **contrato de dados (JSON)**:

```
┌──────────────────── GitHub Actions (cron diário, 05h BRT) ────────────────────┐
│  pipeline/ (Python)                                                            │
│  coletar → normalizar → deduplicar → ranquear → resumir (LLM) → validar → publicar │
└───────────────────────────────────────┬───────────────────────────────────────┘
                                        │ content/daily/AAAA-MM-DD.json + latest.json
                                        ▼ (GitHub Pages, HTTPS, estático)
┌──────────────────────────── app/ (Expo / React Native) ───────────────────────┐
│  baixa o JSON do dia → cache local → monta o feed das áreas do usuário         │
│  → stories, feed, salvos, quiz, sequência, notificação (tudo local)            │
└────────────────────────────────────────────────────────────────────────────────┘
```

Decisão central: **o conteúdo é gerado uma vez por dia para todos os usuários e a personalização acontece no app.** O pipeline publica um *pool* de cards por subárea, e o app escolhe os 15 do usuário. Isso mantém o custo fixo, independente do número de usuários (RNF-005), e preserva a privacidade, porque nenhuma preferência sai do celular (RNF-004).

## Stack

| Camada | Escolha | Motivo |
|---|---|---|
| App | **Expo (React Native) + TypeScript**, expo-router | Testar no celular via Expo Go em minutos, ecossistema grande, TS facilita TDD e contratos tipados |
| Estado do app | Zustand | Simples, testável fora da UI |
| Armazenamento local | AsyncStorage atrás de uma interface `KeyValueStore` | Funciona no Expo Go; pode ser trocado por MMKV depois sem mexer no domínio |
| Feed vertical | FlatList com paginação vertical (`pagingEnabled`) | Nativo e suficiente para 15 itens; FlashList só se necessário |
| Notificações | expo-notifications (agendamento **local**) | Não exige servidor de push (H8) |
| Pipeline | **Python 3.12**, httpx, feedparser, defusedxml, pydantic v2 | Ótimo ecossistema para RSS/XML/APIs científicas; pydantic valida o contrato |
| LLM | **Anthropic API, Claude Haiku 5.5** (`claude-haiku-5-5`), saída estruturada (JSON Schema) | Único modelo atual dentro do orçamento (ver "Custos"); saída validada por schema |
| Agendamento | GitHub Actions (cron) | Grátis, versionado, com segredos gerenciados |
| Hospedagem do conteúdo | GitHub Pages (branch `gh-pages`) | Estático, HTTPS, grátis, com cache de CDN |
| Testes app | Jest + React Native Testing Library | Padrão do Expo |
| Testes pipeline | pytest + respostas gravadas (fixtures) | Testes sem rede, determinísticos |
| E2E (P2) | Maestro | Roda os critérios de aceite no emulador/celular Android |
| Qualidade | ESLint + Prettier (app), Ruff + mypy (pipeline) | Padrões da stack (`dev-clean-code`) |

## Estrutura do repositório

Monorepo com um repositório git em `one-percent/`:

```
one-percent/
├── specs/001-mvp-feed-diario/
├── docs/{adr,reviews,security}/
├── contracts/
│   └── daily-content.schema.json     # contrato único entre pipeline e app
├── pipeline/
│   ├── src/one_percent/
│   │   ├── domain/        # ContentItem, Card, Area, regras puras (dedupe, ranking, seleção)
│   │   ├── sources/       # um adapter por fonte: rss.py, arxiv.py, pubmed.py, hf_papers.py
│   │   ├── summarizer/    # porta Summarizer + AnthropicSummarizer + FakeSummarizer
│   │   ├── publishing/    # monta o JSON, valida no schema, escreve os arquivos
│   │   ├── config/        # areas.yaml (áreas, subáreas, fontes, consultas)
│   │   └── cli.py         # `python -m one_percent run --date AAAA-MM-DD`
│   ├── tests/{unit,integration,fixtures}/
│   └── pyproject.toml
├── app/
│   ├── src/
│   │   ├── app/           # rotas expo-router: (tabs)/index, saved, profile; onboarding; story/[area]
│   │   ├── features/
│   │   │   ├── content/   # baixar/cachear o JSON do dia, fallback para o dia anterior
│   │   │   ├── feed/      # composeFeed, FeedScreen, NewsCard, PaperCard, DayCompleteScreen
│   │   │   ├── stories/
│   │   │   ├── onboarding/  # escolha de áreas (preferences)
│   │   │   ├── streak/    # calculateStreak, progresso (H4, H9)
│   │   │   ├── saved/
│   │   │   ├── quiz/
│   │   │   └── reminders/
│   │   └── shared/        # ui, tema claro/escuro, KeyValueStore, clock, http
│   └── package.json
└── .github/workflows/
    ├── daily-content.yml  # cron do pipeline
    └── ci.yml             # testes + lint do app e do pipeline em cada push
```

Regra de dependência (nos dois lados): `ui → domain ← data`. O domínio não importa rede, armazenamento nem framework.

## Contrato de dados

`contracts/daily-content.schema.json` (JSON Schema) é a fonte da verdade. O pipeline valida contra ele antes de publicar, e o app valida ao carregar. Formato:

```jsonc
{
  "schemaVersion": 1,
  "date": "2026-11-01",                 // dia de referência (America/Sao_Paulo)
  "generatedAt": "2026-11-01T08:12:00Z",
  "areas": [
    { "id": "tech", "name": "Tecnologia",
      "subareas": [{ "id": "tech.ai", "name": "IA" }] }
  ],
  "cards": [
    {
      "id": "c_8f3a…",                  // hash estável da URL canônica
      "type": "news",                   // "news" | "paper"
      "areaId": "tech", "subareaId": "tech.ai",
      "rank": 1,                        // posição dentro da subárea
      "title": "…", "summary": "…", "whyItMatters": "…",
      "sourceName": "TechCrunch", "url": "https://…", "publishedAt": "…",
      // só para type = "paper":
      "originalTitle": "…", "method": "…", "result": "…", "limitations": "…",
      "authors": ["A", "B", "C"], "authorsTruncated": true,
      "venue": "arXiv", "isPreprint": true, "pdfUrl": "https://…",
      "quiz": { "question": "…", "options": ["…","…","…","…"], "answerIndex": 2 }
    }
  ],
  "stories": [
    { "areaId": "tech", "slides": [{ "headline": "…", "cardId": "c_8f3a…" }] }
  ]
}
```

`latest.json` aponta para o arquivo do dia mais recente publicado com sucesso. Os arquivos de dias anteriores ficam publicados por 7 dias.

## Pipeline: etapas

1. **Coletar**: cada fonte implementa a porta `ContentSource.fetch(since) -> list[ContentItem]` (Strategy + Adapter). Timeouts, limite de tamanho de resposta e parsing seguro de XML (`defusedxml`).
2. **Normalizar**: URL canônica (sem `utm_*`), datas em UTC, texto limpo.
3. **Filtrar janela**: notícias ≤ 36h, artigos ≤ 7 dias (RF-003).
4. **Deduplicar** (RF-004): mesma URL canônica, ou títulos com similaridade alta (normalização + Jaccard de tokens, com limiar definido em teste).
5. **Ranquear** (RF-005): pontuação = recência + peso da fonte + sinais de popularidade quando disponíveis (upvotes do HF Daily Papers, número de fontes que cobrem o mesmo assunto). Mantém os top **N = 8 por subárea**.
6. **Resumir**: o LLM recebe só título + resumo/abstract (H2-3), com o conteúdo delimitado como dado. Ele devolve card + quiz em JSON validado por schema. Itens que falham na validação são descartados e registrados no log.
7. **Stories**: as 3–5 manchetes de maior rank por área, derivadas dos cards (sem chamada extra ao LLM).
8. **Publicar**: valida o JSON contra o schema e faz commit em `gh-pages`. Se houver menos de 15 cards válidos no total, **não publica** e mantém o `latest.json` anterior (RNF-006).

**Regras de segurança do LLM** (OWASP LLM01/02): URLs, autores, datas e fonte **nunca** vêm do LLM, sempre do item original. O LLM só escreve campos de texto, que o app exibe como texto puro (sem HTML/Markdown).

### Fontes iniciais

As URLs exatas e os termos de uso de cada fonte são verificados na task de setup das fontes (RNF-008).

| Área | Notícias (RSS / API) | Artigos |
|---|---|---|
| Tecnologia | Tecnoblog, G1 Tecnologia, TechCrunch, Ars Technica, Hacker News API | arXiv (cs.AI, cs.SE, cs.CR, cs.AR) |
| Ciência | — | arXiv (cs.LG, cs.CL, physics, q-bio), HF Daily Papers, bioRxiv |
| Economia | G1 Economia, Agência Brasil Economia, InfoMoney | — |
| Finanças | InfoMoney, Money Times | — |
| Saúde | G1 Saúde, Agência Fiocruz | PubMed (E-utilities), medRxiv |

Fontes em inglês são resumidas em português (RF-006).

### Agendamento

O cron roda às **08:00 UTC (05h BRT)**, com até 2 tentativas, e há também disparo manual (`workflow_dispatch`). As 2h de folga antes do prazo das 7h (RF-001) cobrem atrasos do cron do GitHub. O pipeline é idempotente por data: rodar de novo sobrescreve o dia.

## App: regras de domínio principais

Funções puras, testadas primeiro (TDD):

- `composeFeed(content, preferences) → Card[]` (RF-007, H3-3): 15 cards, distribuídos em rodízio entre as áreas escolhidas por ordem de rank, com ≥ 30% de `paper` quando existir área com artigos. Se faltar conteúdo em uma área, completa com as outras. É determinístico: mesma entrada, mesmo feed.
- `calculateStreak(completedDays, today) → { current, best }` (H4): dias no fuso do celular, com a regra de ontem/hoje.
- `selectQuiz(feed) → QuizItem[3]` (H7): 3 cards do feed do dia, com prioridade para áreas diferentes.
- `resolveContent(latest, cache, now)` (H1-4): hoje → cache de hoje → último disponível com aviso → estado vazio com "tentar de novo".

Dependências injetáveis: `Clock`, `KeyValueStore`, `ContentApi`, `NotificationScheduler`.

**Notificação (H8):** o app agenda uma notificação local diária. Ao concluir o dia, cancela a de hoje e agenda a de amanhã, atendendo ao critério 2 sem servidor.

**Links (RF-010):** abertos com `Linking.openURL`, só com esquema `https:` (o esquema é validado).

## Estratégia de testes

| Tipo | Cobre | Ferramenta |
|---|---|---|
| Unitário (pipeline) | dedupe, ranking, janela de tempo, normalização, montagem e validação do JSON | pytest |
| Integração (pipeline) | cada adapter de fonte com respostas gravadas; pipeline completo com `FakeSummarizer` | pytest + fixtures |
| Contrato | o JSON gerado passa no schema; o app aceita um JSON de exemplo gerado pelo pipeline | jsonschema (py) + teste no app |
| Unitário (app) | composeFeed, calculateStreak, selectQuiz, resolveContent, stores | Jest |
| Componentes (app) | NewsCard, PaperCard (selo de preprint), DayComplete, Quiz, Onboarding | RNTL |
| Aceitação (P2) | fluxos H1, H3, H4 no Android | Maestro |
| Smoke do LLM (manual) | 1 chamada real ao LLM com 3 itens, para revisar a qualidade dos cards | script `--live --limit 3` |

Nunca chamamos rede nem LLM real nos testes automáticos. O LLM fica atrás da porta `Summarizer`, e nos testes entra o `FakeSummarizer`. A qualidade dos resumos é medida pela métrica da spec (amostra semanal de 10 cards).

O CI (`ci.yml`) roda lint e testes do app e do pipeline em cada push.

## Custos (RNF-005: até US$ 5/mês)

Estimativa diária: ~70 cards gerados (8 por subárea × ~9 subáreas com conteúdo), ~1.000 tokens de entrada e ~500 de saída por card, incluindo instruções e quiz. Isso dá **~70 mil tokens de entrada + ~35 mil de saída por dia**.

| Modelo | Preço (entrada / saída por 1M tokens) | Custo/mês estimado |
|---|---|---|
| **Claude Haiku 5.5** | US$ 0,10 / 0,50 | **≈ US$ 0,75** (≈ 0,40 com Batch API) |
| Claude Sonnet 5.5 | US$ 2 / 10 | ≈ US$ 15 |
| Claude Opus 5.5 | US$ 4 / 20 | ≈ US$ 30 ou mais (o raciocínio gera tokens extras) |

Só o Haiku 5.5 cabe no orçamento, e com folga. O pipeline usa a **Batch API** (50% mais barata; ele não é sensível a latência) e define um teto de tokens por execução. GitHub Actions e Pages são gratuitos em repositório público.

## Rastreabilidade

| Requisito | Onde é atendido |
|---|---|
| RF-001 | `daily-content.yml` (cron) + `publishing/` |
| RF-002, RF-010 | `sources/` (URL original) + app `NewsCard`/`PaperCard` (abrir link) |
| RF-003 | `domain/` filtro de janela |
| RF-004 | `domain/` dedupe |
| RF-005 | `domain/` ranking |
| RF-006 | `summarizer/` (prompt em PT-BR) |
| RF-007 | app `feed/composeFeed` |
| RF-008 | `summarizer/` (quiz) + `domain/` stories |
| RF-009 | app `shared/KeyValueStore` + stores |
| RNF-001 | app Expo com build Android; textos e locale pt-BR |
| RNF-002, RNF-006 | app `content/resolveContent` + pipeline "não publica se < 15 cards" |
| RNF-003 | cache local + FlatList paginada |
| RNF-004 | personalização no app; nenhuma API de usuário |
| RNF-005 | Haiku 5.5 + Batch API + teto de tokens |
| RNF-007 | `shared/ui` tema + fontes escaláveis |
| RNF-008 | `config/areas.yaml` (só fontes verificadas) + cards com resumo próprio e link |
| H1–H9 | features homônimas no app |

## Riscos e decisões

| Risco / decisão | Mitigação |
|---|---|
| Resumo do LLM impreciso ou inventado | Entrada restrita a título + abstract; schema; links e metadados nunca vêm do LLM; revisão semanal por amostra |
| Fonte muda o formato ou sai do ar | Um adapter por fonte, com testes de fixture; falha de uma fonte não derruba o pipeline (é registrada no log e o resto segue) |
| Cron do GitHub atrasa ou falha | Rodar às 05h; retry; o app usa o último conteúdo (RNF-006) |
| Repositório público expõe código | Não há segredo no código; a chave da Anthropic fica em *Actions secrets*. Se o repo precisar ser privado, troca-se o Pages por Cloudflare Pages/R2 (mesmo contrato) |
| Termos de uso das fontes | Verificar cada fonte na task de setup; só RSS/API públicos; nunca republicar o texto integral |

ADRs a registrar com `dev-docs` na fase de setup: **0001** conteúdo estático por dia + personalização no app; **0002** Expo como stack mobile; **0003** Haiku 5.5 + Batch API para os resumos.

## Histórico

| Data | Mudança | Motivo |
|---|---|---|
| 2026-10-31 | Criação | — |
| 2026-10-31 | Aprovado: Expo, Haiku 5.5 + Batch API, repositório público com GitHub Pages | Decisão do autor |
| 2026-10-31 | Rotas em `app/src/app/` (convenção do Expo SDK 58 com pasta `src`) | Documentação do Expo Router |
