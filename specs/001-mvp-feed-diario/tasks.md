# Tasks 001 — MVP: Feed diário de conhecimento

Spec: [spec.md](./spec.md) · Plan: [plan.md](./plan.md) · Status: Aprovado (2026-10-31)

Legenda: `[ ]` pendente · `[x]` feita · `[P]` pode ser feita em paralelo com as outras `[P]` da mesma fase

Cada task segue Red → Green → Refactor: o teste indicado é escrito primeiro e precisa falhar antes da implementação. Depois que o contrato (Fase 1) existe, **pipeline (Fase 2) e app (Fases 3–5) são independentes**: o app usa um JSON de exemplo até o pipeline publicar conteúdo real.

---

## Fase 0 — Setup

- [x] T001 Iniciar repositório git em `one-percent/`, criar estrutura de pastas do plan, `.gitignore` (Node + Expo + Python + segredos), `.editorconfig` e README inicial — `dev-docs`
  - Pronto quando: `git status` limpo após o primeiro commit; nenhum `.env` rastreado
- [x] T002 [P] Registrar ADRs 0001 (conteúdo estático + personalização no app), 0002 (Expo), 0003 (Haiku 5.5 + Batch API) — `dev-docs`
- [x] T003 [P] Setup do pipeline: `pyproject.toml` (Python 3.12, httpx, feedparser, defusedxml, pydantic, anthropic, jsonschema; dev: pytest, ruff, mypy)
  - Pronto quando: `pytest` roda um teste trivial verde; `ruff check` e `mypy` sem erros
- [x] T004 [P] Setup do app: projeto Expo com TypeScript e expo-router, Jest + RNTL, ESLint + Prettier
  - Pronto quando: `npm test` roda um teste trivial verde; o app abre no celular via Expo Go com uma tela "Olá"
  - Nota: testes, lint, typecheck e format verdes; abertura no Expo Go pendente de verificação no celular
- [x] T005 Workflow `ci.yml`: lint + testes do pipeline e do app em cada push
  - Pronto quando: o primeiro push mostra os dois jobs verdes no GitHub
  - Nota: run 41266851197 — Pipeline (Python) e App (Expo) verdes

## Fase 1 — Contrato de dados

- [x] T010 Escrever `contracts/daily-content.schema.json` conforme o plan (cards `news`/`paper`, quiz, stories, áreas)
  - Teste: `pipeline/tests/unit/test_contract.py` — `valid_sample_passes`, `paper_without_method_fails`, `quiz_requires_four_options`, `url_must_be_https`
  - Cobre: RF-002, RF-008
- [x] T011 Criar `contracts/examples/sample-day.json` (≥ 20 cards, todas as áreas, inclui preprint) usado pelos testes e pelo app em desenvolvimento
  - Teste: o exemplo passa no schema (mesmo arquivo de teste do T010)
- [x] T012 Tipos TypeScript do contrato + validação ao carregar no app
  - Teste: `app/src/features/content/contract.test.ts` — `parses_sample_day`, `rejects_invalid_payload`

## Fase 2 — Pipeline (conteúdo diário)

### Domínio
- [ ] T020 [P] `ContentItem` e normalização: URL canônica sem `utm_*`, datas em UTC, limpeza de texto
  - Teste: `tests/unit/test_normalize.py` — `strips_tracking_params`, `converts_dates_to_utc`, `strips_html_from_summary`
- [ ] T021 [P] Filtro de janela de tempo (notícias ≤ 36h, artigos ≤ 7 dias)
  - Teste: `tests/unit/test_window.py` — `drops_news_older_than_36h`, `keeps_paper_from_6_days_ago`
  - Cobre: RF-003
- [ ] T022 [P] Deduplicação por URL canônica e similaridade de título
  - Teste: `tests/unit/test_dedupe.py` — `same_url_is_duplicate`, `same_story_different_sources_is_duplicate`, `different_stories_are_kept`
  - Cobre: RF-004
- [ ] T023 [P] Ranking por recência, peso da fonte e popularidade; top 8 por subárea
  - Teste: `tests/unit/test_ranking.py` — `newer_item_ranks_higher_all_else_equal`, `story_covered_by_more_sources_ranks_higher`, `keeps_top_8_per_subarea`
  - Cobre: RF-005

### Fontes
- [ ] T030 Verificar URLs e termos de uso de cada fonte da tabela do plan; registrar em `config/areas.yaml` só as aprovadas
  - Pronto quando: cada fonte tem URL, tipo, área/subárea e uma nota de termos de uso
  - Cobre: RNF-008
- [ ] T031 [P] Porta `ContentSource` + adapter RSS genérico (feedparser + defusedxml, timeout, limite de tamanho)
  - Teste: `tests/integration/test_rss_source.py` com fixtures gravadas — `parses_items`, `ignores_malformed_entry`, `fails_gracefully_on_timeout`
- [ ] T032 [P] Adapter arXiv (API Atom por categoria)
  - Teste: `tests/integration/test_arxiv_source.py` — `parses_authors_and_pdf_link`, `marks_as_preprint`
- [ ] T033 [P] Adapter PubMed (E-utilities) e bioRxiv/medRxiv
  - Teste: `tests/integration/test_pubmed_source.py`, `test_biorxiv_source.py`
- [ ] T034 [P] Adapter Hugging Face Daily Papers (com upvotes como sinal de popularidade)
  - Teste: `tests/integration/test_hf_papers_source.py`
- [ ] T035 Coleta resiliente: falha de uma fonte é registrada no log e não interrompe as demais
  - Teste: `tests/unit/test_collect.py` — `one_failing_source_does_not_stop_others`

### Resumo (LLM)
- [ ] T040 Porta `Summarizer` + `FakeSummarizer` determinístico
  - Teste: `tests/unit/test_fake_summarizer.py`
- [ ] T041 Montagem do card: campos de texto vêm do summarizer; URL, autores, datas e fonte vêm do item original
  - Teste: `tests/unit/test_build_card.py` — `url_comes_from_source_not_llm`, `paper_card_has_method_result_limitations`, `invalid_summary_is_discarded`
  - Cobre: RF-002, RF-006, H2-3
- [ ] T042 `AnthropicSummarizer`: Haiku 5.5, saída estruturada por JSON Schema, prompt em PT-BR restrito ao título + abstract, conteúdo delimitado como dado, Batch API, teto de tokens por execução — `claude-api`
  - Teste: `tests/unit/test_anthropic_summarizer.py` com cliente fake — `builds_batch_request_with_schema`, `parses_results_by_custom_id`, `stops_at_token_budget`
  - Smoke manual: `python -m one_percent run --live --limit 3`, revisando os 3 cards gerados
  - Cobre: RF-006, RF-008, RNF-005

### Publicação
- [ ] T050 Montagem do JSON do dia + stories (top 3–5 por área) + validação no schema
  - Teste: `tests/unit/test_publish.py` — `output_passes_schema`, `stories_reference_existing_cards`
- [ ] T051 Regra de segurança: não publicar com menos de 15 cards válidos; manter o `latest.json` anterior
  - Teste: `tests/unit/test_publish.py` — `does_not_publish_below_15_cards`
  - Cobre: RNF-006
- [ ] T052 CLI `run --date` + pipeline completo com `FakeSummarizer`
  - Teste: `tests/integration/test_pipeline_e2e.py` — fixtures de todas as fontes → JSON válido com ≥ 15 cards
- [ ] T053 Workflow `daily-content.yml`: cron 08:00 UTC + `workflow_dispatch`, retry, `ANTHROPIC_API_KEY` em secrets, `permissions` mínimas, publica em `gh-pages`
  - Pronto quando: um disparo manual publica `latest.json` acessível via HTTPS
  - Cobre: RF-001

## Fase 3 — App P1 (H1–H4)

### Conteúdo
- [ ] T060 `ContentApi` (HTTP) + `KeyValueStore` (AsyncStorage) + `Clock` como interfaces injetáveis, com fakes para teste
- [ ] T061 `resolveContent`: hoje → cache de hoje → último disponível com aviso → estado vazio
  - Teste: `content/resolveContent.test.ts` — `uses_today_from_network`, `falls_back_to_cache_offline`, `shows_previous_day_with_warning`, `empty_state_when_nothing_available`
  - Cobre: H1-4, RNF-002, RNF-006

### Onboarding (H3)
- [ ] T070 Store de preferências (áreas/subáreas), persistida
  - Teste: `onboarding/preferencesStore.test.ts` — `requires_at_least_one_area`, `persists_and_restores`
- [ ] T071 Tela de onboarding (primeiro acesso) + edição nas configurações
  - Teste: `onboarding/OnboardingScreen.test.tsx` — `continue_disabled_until_area_selected`, `saves_selection`
  - Cobre: H3-1, H3-2

### Feed (H1, H2)
- [ ] T080 `composeFeed`: 15 cards, rodízio entre áreas por rank, ≥ 30% de artigos quando houver, completa com outras áreas se faltar conteúdo, determinístico
  - Teste: `feed/composeFeed.test.ts` — `returns_15_cards`, `only_selected_areas`, `balances_between_areas`, `at_least_30_percent_papers`, `fills_from_other_areas_when_short`, `same_input_same_output`
  - Cobre: RF-007, H3-3
- [ ] T081 [P] `NewsCard`: área, título, resumo, "por que importa", fonte, data, botão para a matéria
  - Teste: `feed/NewsCard.test.tsx` — `renders_all_fields`, `opens_https_link_externally`, `blocks_non_https_link`
  - Cobre: H1-2, RF-010
- [ ] T082 [P] `PaperCard`: selo "Artigo", títulos original e traduzido, método, resultado, limitações, autores truncados, links do artigo e do PDF, selo de preprint
  - Teste: `feed/PaperCard.test.tsx` — `renders_paper_fields`, `shows_preprint_badge`, `truncates_authors_with_et_al`
  - Cobre: H2-1, H2-2
- [ ] T083 `FeedScreen`: paginação vertical, sem conteúdo após o último card → navega para "Dia concluído"
  - Teste: `feed/FeedScreen.test.tsx` — `shows_one_card_per_page`, `navigates_to_day_complete_after_last_card`
  - Cobre: H1-1, H1-3

### Dia concluído e sequência (H4)
- [ ] T090 `calculateStreak` com dias no fuso local
  - Teste: `streak/calculateStreak.test.ts` — `increments_when_yesterday_completed`, `resets_to_1_after_gap`, `same_day_does_not_change`, `uses_local_timezone_boundaries`, `tracks_best_streak`
  - Cobre: H4-2, H4-3, H4-4, H4-5
- [ ] T091 Registro de progresso: dia concluído ao ver o último card; contagem de cards e artigos lidos por área
  - Teste: `streak/progressStore.test.ts` — `marks_day_complete_on_last_card`, `counts_cards_by_area`
- [ ] T092 Tela "Dia concluído": cards lidos, áreas cobertas, sequência atual; permite rever os cards
  - Teste: `streak/DayCompleteScreen.test.tsx`
  - Cobre: H4-1, H4-4

- [ ] T095 **Marco P1**: build Android instalado no celular, consumindo o conteúdo real do GitHub Pages. Usar por 3 dias e anotar ajustes
  - Pronto quando: os critérios de aceite de H1–H4 foram verificados à mão no celular

## Fase 4 — App P2 (H5–H7)

- [ ] T100 [P] Stories: círculos por área com conteúdo, viewer de 3–5 telas (toque/auto-avanço), estado "visto"
  - Teste: `stories/StoriesBar.test.tsx`, `stories/StoryViewer.test.tsx` — `only_areas_with_content`, `advances_on_tap`, `marks_as_seen`
  - Cobre: H5
- [ ] T101 [P] Salvos: alternar salvar/remover no card; aba "Salvos" com filtro por área e conteúdo completo offline
  - Teste: `saved/savedStore.test.ts`, `saved/SavedScreen.test.tsx` — `toggle_save`, `newest_first`, `filters_by_area`, `available_after_day_changes`
  - Cobre: H6
- [ ] T102 [P] `selectQuiz` + tela do quiz: 3 perguntas, feedback imediato, atalho para o card, pontuação no histórico, não afeta a sequência
  - Teste: `quiz/selectQuiz.test.ts`, `quiz/QuizScreen.test.tsx` — `picks_3_from_different_areas`, `shows_correct_answer_after_choice`, `records_score`, `does_not_affect_streak`
  - Cobre: H7
- [ ] T103 Aceitação com Maestro dos fluxos H1, H3 e H4 no emulador Android

## Fase 5 — App P3 (H8–H9)

- [ ] T110 [P] Lembrete diário: oferta no fim do onboarding, desligado por padrão, horário configurável, cancela a notificação do dia ao concluir
  - Teste: `reminders/reminderScheduler.test.ts` com `NotificationScheduler` fake — `off_by_default`, `schedules_at_chosen_time`, `skips_today_when_completed`
  - Cobre: H8
- [ ] T111 [P] Perfil: sequência atual e maior, cards e artigos lidos, distribuição por área, média do quiz
  - Teste: `streak/ProfileScreen.test.tsx`
  - Cobre: H9
- [ ] T112 Acessibilidade e tema: fontes escaláveis, contraste, tema claro/escuro
  - Teste: snapshots dos cards nos dois temas + verificação manual com fonte grande
  - Cobre: RNF-007

## Fase final — Qualidade

- [ ] T120 `dev-code-review` do pipeline e do app → `dev-review-fix` (ciclo com critério de parada)
- [ ] T121 `dev-security`: segredos, Actions, parsing de feeds, LLM01/02, links, armazenamento local
- [ ] T122 `dev-docs`: README final, CHANGELOG `0.1.0`, `.env.example`
- [ ] T123 Iniciar a medição das métricas de sucesso da spec (14 dias de uso)
