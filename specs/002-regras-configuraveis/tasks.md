# Tasks 002 — Regras configuráveis e contrato evolutivo

Spec: [spec.md](./spec.md) · Plan: [plan.md](./plan.md)

Cada task segue Red → Green → Refactor: o teste indicado é escrito primeiro e precisa falhar antes da implementação. **A ordem das fases é obrigatória**: o app tolerante (Fase 1) precisa estar no celular antes de o pipeline publicar campos novos (Fase 3).

## Fase 0 — Decisão

- [x] T200 ADR 0007: política de versão do contrato (aditivo mantém a versão principal; incompatível publica `latest-v2.json` em paralelo)
  - Teste: —
  - Cobre: RF-102

## Fase 1 — App tolerante e dados preservados (H1, H2)

- [ ] T201 Leitor tolerante: campos desconhecidos ignorados; card inválido ou de tipo desconhecido descartado com motivo; stories sem manchetes válidas removidas
  - Teste: `content/contract.test.ts` — `ignores_unknown_fields`, `drops_only_the_invalid_card`, `drops_unknown_card_types`, `drops_story_slides_of_dropped_cards`
  - Cobre: H1-1, H1-2, RF-101
- [ ] T202 Versão principal não suportada: `resolveContent` mantém o último conteúdo compatível e sinaliza `updateSuggested`; a tela mostra a sugestão de atualizar
  - Teste: `content/resolveContent.test.ts` — `keeps_cache_when_major_version_is_newer`; `feed/DailyFeed.test.tsx` — `suggests_updating_the_app`
  - Cobre: H1-3
- [ ] T203 `createVersionedStore`: envelope com versão, migrações, leitura das chaves antigas, cópia de dado ilegível
  - Teste: `shared/lib/versionedStore.test.ts` — `migrates_legacy_unversioned_value`, `applies_migrations_in_order`, `preserves_unreadable_value`, `writes_current_version`
  - Cobre: H2-1, H2-2, RF-103
- [ ] T204 Repositórios (preferências, progresso, salvos, quiz, stories vistos, lembrete, cache do conteúdo) usam o store versionado, um por chave
  - Teste: testes existentes de cada repositório + `keeps_other_keys_when_one_is_unreadable`
  - Cobre: H2-3, RNF-102
- [ ] T205 **Marco**: app da Fase 1 instalado no celular e lendo o `latest.json` atual sem regressão

## Fase 2 — Contrato com campos novos (aditivo)

- [ ] T210 Schema: `groups`, `areas[].groupId`, `areas[].weight`, `settings`; quiz com 2 a 6 alternativas; stories com pelo menos 1 tela. Exemplo `sample-day.json` atualizado
  - Teste: `test_contract.py` e `contract.test.ts` com o exemplo novo; `old_reader_fixture_still_parses` (payload sem os campos novos)
  - Cobre: RF-104, RF-105
- [ ] T211 Compatibilidade cruzada: fixture gerada pelo pipeline (`--fake`) lida pelo parser do app; payload com campo desconhecido e um card inválido lido sem perder os demais
  - Teste: `contract.test.ts` — `reads_pipeline_output_fixture`, `reads_payload_with_unknown_field`
  - Cobre: RNF-101

## Fase 3 — Pipeline configurável (H6, H7)

- [ ] T220 `config/pipeline.yaml` + modelo pydantic `PipelineSettings`; valor inválido falha antes de coletar, apontando o campo
  - Teste: `test_pipeline_settings.py` — `loads_defaults`, `rejects_invalid_value_with_field_path`; `test_cli.py` — `invalid_settings_exit_2_before_collecting`
  - Cobre: H7-1, H7-2, RF-110
- [ ] T221 Injetar `PipelineSettings` em janela, retenção, stories, fuso do conteúdo, mínimo total, modelo, teto de itens, `max_tokens` e timeout do batch; remover as constantes equivalentes do código
  - Teste: testes existentes passando com os padrões + `uses_configured_window`, `uses_configured_retention`, `uses_configured_story_range`
  - Cobre: RF-107, RF-108, RF-110
- [ ] T222 `areas.yaml` com `groups`, `group` e `weight` por área; publicação do catálogo no dia
  - Teste: `test_config.py` — `weights_must_be_positive`, `every_area_belongs_to_a_known_group`; `test_day.py` — `publishes_catalog_with_groups_and_weights`
  - Cobre: RF-104, H3-4
- [ ] T223 Publicar `settings` do feed a partir de `feed:` no `pipeline.yaml`
  - Teste: `test_day.py` — `publishes_feed_settings`
  - Cobre: RF-105, H4-4
- [ ] T224 Limites de texto lidos do schema; `Summary`/`Quiz` montados a partir deles e da quantidade de alternativas; prompt como template preenchido pelos limites × margem
  - Teste: `test_contract.py` — `reads_text_limits_from_schema`; `test_anthropic_summarizer.py` — `prompt_limits_follow_the_contract`, `prompt_has_no_hand_written_numbers`
  - Cobre: H6-1, H6-2, RF-109
- [ ] T225 `shorten`: corta no último fim de frase que caiba, senão no último espaço com reticências; aplicado antes da validação; contagem no relatório
  - Teste: `test_shorten.py` — `cuts_at_last_sentence_end`, `falls_back_to_word_boundary_with_ellipsis`, `keeps_text_within_limit`; `test_anthropic_summarizer.py` — `long_summary_is_shortened_not_dropped`
  - Cobre: H6-3
- [ ] T226 Mínimo para publicar por grupo além do total
  - Teste: `test_day.py` — `skips_publishing_when_a_group_is_below_minimum`
  - Cobre: H7-3
- [ ] T227 Custo estimado no `RunReport` e alerta quando a projeção mensal passa do limite do orçamento
  - Teste: `test_pipeline_e2e.py` — `reports_estimated_cost`; `test_anthropic_summarizer.py` — `warns_when_projected_cost_exceeds_budget`
  - Cobre: H7-4
- [ ] T228 **Marco**: execução real publicada com catálogo e `settings`, lida pelo app da Fase 1 sem regressão

## Fase 4 — App usa os parâmetros (H3, H4, H5, H7-5)

- [ ] T230 `catalogRepository`: último catálogo publicado, catálogo embutido no primeiro acesso; onboarding e edição de áreas usam o catálogo atual
  - Teste: `onboarding/catalog.test.ts` — `uses_bundled_catalog_without_content`, `uses_latest_published_catalog`; `OnboardingScreen.test.tsx` — `shows_published_area`
  - Cobre: H3-1, H3-2
- [ ] T231 Preferências com áreas que sumiram: removidas sem erro; nenhuma sobrando → onboarding
  - Teste: `preferences.test.ts` — `drops_areas_missing_from_catalog`; `DailyFeed.test.tsx` — `redirects_when_no_chosen_area_remains`
  - Cobre: H3-3
- [ ] T232 `composeFeed` com pesos por área (maior resto), sobra redistribuída pelos pesos, fatia de artigos na mesma área ou grupo, intercalação por área
  - Teste: `composeFeed.test.ts` — `splits_by_area_weight`, `all_areas_with_default_weights_keep_half_per_group`, `redistributes_shortfall_by_weight`, `subareas_have_no_weight`
  - Cobre: H3-4, H3-5, RF-104
- [ ] T233 `resolveFeedSettings`: publicados com padrão para ausente ou inválido; `FEED_DEFAULTS` igual ao `feed:` do `pipeline.yaml`
  - Teste: `feed/feedSettings.test.ts` — `falls_back_to_defaults`, `ignores_invalid_values`; `defaults_match_pipeline_config`
  - Cobre: H4-4, RNF-103
- [ ] T234 Contador "n de N", aviso de feed curto no encerramento, quiz com a quantidade configurada
  - Teste: `FeedScreen.test.tsx` — `counter_uses_real_feed_size`, `explains_short_feed`; `selectQuiz.test.ts` — `uses_configured_question_count`
  - Cobre: H4-1, H4-2
- [ ] T235 Lembrete com tamanho e tempo estimado calculados a partir dos parâmetros
  - Teste: `reminderScheduler.test.ts` — `message_uses_feed_settings`
  - Cobre: H4-3
- [ ] T236 Atualidade por `generatedAt`: busca após o intervalo, aviso após intervalo + tolerância, independente do fuso
  - Teste: `resolveContent.test.ts` — `uses_cache_before_interval`, `fetches_after_interval`, `warns_only_after_tolerance`, `same_result_in_any_timezone`
  - Cobre: H5-1, H5-2, RF-106
- [ ] T237 Endereço do conteúdo via `expo.extra.contentBaseUrl`
  - Teste: `dependencies.test.ts` — `reads_content_url_from_build_config`, `fails_clearly_without_it`
  - Cobre: H7-5, RF-111

## Fase 5 — Textos da interface (H8)

- [ ] T240 Catálogo `shared/i18n/pt-BR.ts` com `plural` via `Intl.PluralRules`
  - Teste: `i18n/pt-BR.test.ts` — `pluralizes_days_and_cards`, `formats_feed_counter`
  - Cobre: H8-2, RF-112
- [ ] T241 [P] Migrar telas do feed, detalhe, stories e salvos para o catálogo
  - Teste: testes de componente existentes (os textos em português continuam os mesmos)
  - Cobre: H8-1
- [ ] T242 [P] Migrar onboarding, dia concluído, quiz, perfil e lembrete para o catálogo
  - Teste: testes de componente existentes
  - Cobre: H8-1
- [ ] T243 Guarda contra texto escrito no componente: lint ou teste que falha com string literal visível no JSX
  - Teste: `i18n/no-literal-strings.test.ts`
  - Cobre: H8-1

## Fase final — Qualidade

- [ ] T250 Teste de fonte única que falta: catálogo embutido no app = `areas.yaml` (ids, nomes, grupos, pesos). Os outros já estão na T224 e na T233
  - Teste: `test_contract_sample_sync.py` e `shared/config/areas.test.ts` — `bundled_catalog_matches_pipeline_config`
  - Cobre: RNF-103
- [ ] T251 `dev-code-review` do diff da spec 002 → `dev-review-fix`
- [ ] T252 `dev-security` do diff da spec 002: leitura tolerante de conteúdo externo, dados locais preservados (cópias de ilegíveis), novos parâmetros publicados
- [ ] T253 `dev-docs`: README (configuração do pipeline e do build), CHANGELOG `0.2.0` com a mudança de divisão por peso de área, spec 001 atualizada com remissões à 002
- [ ] T254 **Marco**: app final da 002 no celular por 3 dias: feed, onboarding com catálogo publicado, lembrete e verificação com fonte grande do sistema
