# Code Review — Fase 5 da spec 002: catálogo de textos (T240–T243)

- **Data**: 2026-11-24
- **Escopo**: `4bf244b..16acc8e` (0da5eac, 85956fd, 30d526d, 16acc8e) — `app/src/shared/i18n/`, `shared/lib/links.ts` e telas em `app/src/features/`
- **Spec relacionada**: `specs/002-regras-configuraveis/spec.md` (H8, RF-112), `plan.md` ("App: textos")
- **Veredito**: Mudanças necessárias

## Rodada de correções — 2026-11-24

Corrigidos: 6 (CR-001, 002, 003, 004, 006, 007) · Não procede: 0 · Adiados: 0 · Corrigido (o orquestrador atualizou `plan.md`): 1 (CR-005, atualizar `plan.md`, fora do escopo desta rodada) · Abertos: 0.

## Resumo

A migração é mecânica e foi bem feita: comparei cada string removida com a entrada correspondente do catálogo e **nenhum texto visível mudou** (incluindo espaços colapsados do JSX, como `Média no quiz:{' '}` e `{seen} de {cards.length} vistos`). O `plural(0)` está correto e se comporta como antes. O problema é que ficou um texto visível fora do catálogo, em `app/src/app/reminder.tsx`. Ele viola H8-1 e o teste-guarda não o detecta, porque não varre `src/app/` nem atributos com nomes próprios como `saveLabel`. Rodei a suíte 4 vezes (335/335 em todas) e não reproduzi a falha instável. A seção "Teste instável" traz a hipótese.

| Severidade | Qtd |
|---|---|
| Crítico | 0 |
| Alto | 1 |
| Médio | 2 |
| Baixo | 2 |
| Pergunta | 2 |

## Respostas aos pontos do briefing

1. **Textos mudaram?** Não. Todas as strings do diff são idênticas às anteriores. **Sobrou texto no componente?** Sim: `app/src/app/reminder.tsx:28` (CR-001). Fora do JSX também ficaram outros textos visíveis (CR-004).
2. **`plural(0)`**: o código está correto e consistente. No CLDR, `pt` usa `one` para `i = 0..1`, então `Intl.PluralRules('pt-BR').select(0)` é `one`. O desvio explícito `n === 0 → other` mantém "0 dias" / "0 dias seguidos" / "Maior sequência: 0 dias", que é o que `formatDays` e `n === 1 ? ... : ...` produziam antes. O comentário em `pt-BR.ts:3-6` descreve exatamente isso, e o teste cobre `plural(0)`. Ressalva: com esse desvio, para inteiros, a função é equivalente a `n === 1`, e o `Intl` não acrescenta nada. Ele só traz o risco do CR-006. Vale registrar a escolha no `plan.md`, que hoje diz apenas "`plural` com `Intl.PluralRules`" (CR-005).
3. **Teste-guarda**: é útil. Usa o AST do TypeScript em vez de regex, ignora comparações e `key` e pegaria os padrões que existiam antes (`<Text>Olá</Text>`, ternários, templates em `accessibilityLabel`). Não vi falsos positivos que incomodem hoje. Os falsos negativos, porém, são estruturais (CR-001, CR-002).
4. **Teste instável**: não reproduzido (4 execuções, 335/335). Ver CR-007.

## Achados

### CR-001 · [Alto] Texto visível escrito no componente de rota do lembrete
- **Local**: `app/src/app/reminder.tsx:28`
- **Problema**: `saveLabel={fromOnboarding ? 'Começar' : 'Salvar'}` é o rótulo do botão principal de `ReminderScreen` e ficou fora do catálogo. Isso descumpre H8-1 ("nenhum texto visível fica escrito no componente"). O guarda não acusa por dois motivos: `ROOTS` só cobre `features/` e `shared/ui/`, e `saveLabel` não está em `TEXT_ATTRIBUTES`.
- **Cenário**: uma futura tradução troca o catálogo, mas a tela de lembrete continua mostrando "Começar"/"Salvar" em português.
- **Sugestão**: criar `t.reminder.start: 'Começar'` e usar `t.common.save`. Incluir `'app'` em `ROOTS` (ver CR-002).
- **Teste sugerido**: com `src/app` incluído em `ROOTS` e a regra de atributo ampliada, `has_no_literal_strings_in_components` fica vermelho hoje e verde depois da correção.
- **Status**: Corrigido
- **Correção**: Rótulos movidos para `t.reminder.start` e `t.common.save`; guarda passou a varrer `src/` inteiro · teste: `no-literal-strings.test.ts::has_no_literal_strings_in_components`

### CR-002 · [Médio] Guarda com falsos negativos estruturais
- **Local**: `app/src/shared/i18n/no-literal-strings.test.ts:33-34` e `:98-101`
- **Problema**: o guarda só olha (a) arquivos em `features/` e `shared/ui/`, (b) quatro nomes de atributo fixos e (c) literais dentro do JSX. Três padrões reais deste código escapariam:
  - props de texto com nome próprio: `saveLabel` (CR-001), `accessibilityHint`, `message`, `subtitle`;
  - texto em constante ou variável antes do `return`. Os casos `filters = [{ label: 'Todas' }]` (SavedScreen) e `reminderLabel = ... : 'desligado'` (ProfileScreen) existiam antes desta fase e o guarda não os teria pegado, porque o valor chega ao JSX por variável;
  - rotas em `src/app/`.

  O comentário do teste reconhece as constantes, mas não menciona `src/app` nem os nomes de prop.
- **Cenário**: alguém escreve `const label = 'Voltar'; <Pill label={label} />` ou `<ReminderScreen saveLabel="Salvar" />`, e o teste passa.
- **Sugestão**: varrer `src/` inteiro, excluindo `shared/i18n/` e testes. Trocar o conjunto fixo por um padrão de nome (`/label|title|text|hint|placeholder|message/i`). Opcionalmente, acusar também literais com letras atribuídos a `const` dentro de componentes `.tsx`, mantendo uma lista curta de exceções (ids, rotas, `testID`). Em troca, aparecem alguns falsos positivos que hoje não existem, como `styles['x']` ou `.includes('abc')` dentro de `{...}`. Hoje eles já seriam acusados se estivessem como filhos do JSX.
- **Teste sugerido**: em `flags_literal_text_in_jsx`, adicionar `<ReminderScreen saveLabel="Começar" />` e `<View accessibilityHint="Abre o card" />` e esperar que sejam acusados.
- **Status**: Corrigido
- **Correção**: Guarda varre `src/` (exceto catálogo e testes) e usa padrão de nome de atributo; constantes fora do JSX continuam fora do alcance, registrado no comentário · teste: `no-literal-strings.test.ts::flags_literal_text_in_custom_text_props`

### CR-003 · [Médio] H8-2 só pluraliza "dias"; "cards" e "perguntas" continuam fixos
- **Local**: `app/src/shared/i18n/pt-BR.ts:84` (`startQuiz`), `:100-101` (`areaRow`), `:119-120` (`reminder.body`); `pt-BR.test.ts:5`
- **Problema**: H8-2 pede "plurais e números (dias, cards, minutos) formatados por funções do catálogo". As funções existem, mas `cards` e `perguntas` estão sempre no plural. O nome do teste `pluralizes_days_and_cards` promete cards e não testa nenhum caso com 1 card.
- **Cenário**: o usuário leu 1 card de Física e o rótulo de acessibilidade da linha em "Por área" diz "Física: 1 cards, 7%". Com o quiz configurável (RF-105) em 1 pergunta, o botão mostra "Fazer o quiz (1 perguntas)". O texto antigo já tinha esse defeito, então não é regressão, mas o critério de aceite H8-2 não fica atendido.
- **Sugestão**: criar `const cards = (n: number) => \`${n} ${plural(n, { one: 'card', other: 'cards' })}\`` e o equivalente para `perguntas`, e usá-los em `areaRow`, `reminder.body` e `startQuiz`.
- **Teste sugerido**: `expect(t.profile.areaRow('Física', 1, 7)).toBe('Física: 1 card, 7%')` e `expect(t.dayComplete.startQuiz(1)).toBe('Fazer o quiz (1 pergunta)')`.
- **Status**: Corrigido
- **Correção**: Criados `cards` e `questions` no catálogo, usados em `areaRow`, `reminder.body` e `startQuiz` · teste: `pt-BR.test.ts::pluralizes_cards_and_questions_in_singular`

### CR-004 · [Baixo] Textos visíveis fora do JSX que ficaram fora do catálogo
- **Local**: `app/src/features/reminders/expoNotificationScheduler.ts:33` (`name: 'Lembrete diário'`), `app/src/features/content/catalog.ts:7` (`'Outras áreas'`)
- **Problema**: o primeiro é o nome do canal de notificação, que aparece nas configurações do Android. O segundo é o nome do grupo de reserva, exibido no onboarding quando o catálogo publicado traz uma área sem grupo conhecido. Os dois são texto de interface. As mensagens de erro em `contract.ts` e `versionedStore.ts` são internas e podem ficar onde estão.
- **Sugestão**: criar `t.reminder.channelName` (ou reaproveitar `t.reminder.toggle`) e `t.onboarding.otherGroup`.
- **Teste sugerido**: o teste do canal em `expoNotificationScheduler` passa a comparar com `t.reminder.channelName`, e o teste de `catalog` com área sem grupo espera `t.onboarding.otherGroup`.
- **Status**: Corrigido
- **Correção**: Criados `t.reminder.channelName` e `t.onboarding.otherGroup`, usados no canal e no grupo de reserva · teste: `expoNotificationScheduler.test.ts::names_the_channel_from_the_catalog`, `catalog.test.ts::unknown_area_without_weight_gets_weight_one_in_an_extra_group`

### CR-005 · [Baixo] Decisão sobre `plural(0)` não registrada no plan
- **Local**: `specs/002-regras-configuraveis/plan.md:167`, `app/src/shared/i18n/pt-BR.ts:7-10`
- **Problema**: o código desvia do CLDR de propósito (0 → `other`), mas o plan diz apenas "`plural(n, { one, other })` com `Intl.PluralRules('pt-BR')`". Pela metodologia, a spec e o plan são a fonte da verdade.
- **Sugestão**: acrescentar ao plan "zero usa a forma `other` ('0 dias'), como antes da H8". Se o CR-006 se confirmar, trocar a implementação por `n === 1 ? one : other` e registrar o motivo.
- **Teste sugerido**: o atual (`plural(0, forms) === 'dias'`) já cobre o comportamento.
- **Status**: Aguardando decisão
- **Correção**: `plan.md` está fora dos caminhos desta rodada. A implementação já é `n === 1 ? one : other` (CR-006); falta atualizar a linha 167 do plan para registrar que zero usa `other` e que `Intl.PluralRules` não é usado por causa do Hermes.

### CR-006 · [Pergunta] `Intl.PluralRules` existe no Hermes da versão usada (RN 0.88)?
- **Local**: `app/src/shared/i18n/pt-BR.ts:1`
- **Problema**: `new Intl.PluralRules('pt-BR')` roda no carregamento do módulo, e o módulo é importado por todas as telas e por `reminderScheduler`. Historicamente, o Intl do Hermes no Android não incluía `PluralRules` (`DateTimeFormat`, que `dates.ts` usa, sim). Não consegui confirmar no repositório, porque o runtime vem compilado. O Jest roda no Node, que tem `PluralRules`, então os testes não pegariam a falha.
- **Cenário (se não houver suporte)**: `TypeError` ao importar `pt-BR.ts` e o app quebra na abertura, o que seria **Crítico**.
- **Sugestão**: confirmar no aparelho ou emulador (`typeof Intl.PluralRules`). Como, com o desvio do zero, `Intl` não muda nenhum resultado para inteiros, a saída mais simples é `n === 1 ? forms.one : forms.other`, com nota no plan. Outra opção é instanciar só quando disponível.
- **Teste sugerido**: teste que remove `Intl.PluralRules` dentro de `jest.isolateModules`, importa `pt-BR` e espera `t.streak.days(1) === '1 dia'`.
- **Status**: Corrigido
- **Correção**: `plural` agora é `n === 1 ? one : other`, sem `Intl.PluralRules` (decisão do autor) · teste: `pt-BR.test.ts::loads_without_intl_plural_rules`

### CR-007 · [Pergunta] Teste instável não reproduzido; hipótese em `DailyFeed.test.tsx`
- **Local**: `app/src/features/feed/DailyFeed.test.tsx` (por exemplo `:73-77`, `shows_feed_after_loading`)
- **Problema**: em 4 execuções completas (3 com `grep`, 1 com `--json`), todas deram 335/335. A causa mais provável é o tempo de espera padrão de 1000 ms do `findBy*`/`waitFor` do RNTL, que o `testTimeout: 20000` do Jest não afeta. A suíte `DailyFeed` é a mais lenta (cerca de 9 s) e o primeiro teste levou 3,2 s com 43 suítes em paralelo. Se o primeiro render ou a resolução das promessas falsas passar de 1 s numa máquina carregada, o `findByTestId('feed-list')` estoura. Não tem relação com este diff: o teste é da Fase 4 (6dc0ff0).
- **Sugestão**: se a falha voltar, guardar o nome do teste e a mensagem. Uma mitigação barata é `configure({ asyncUtilTimeout: 5000 })` do RNTL num arquivo de `setupFilesAfterEnv` do Jest.
- **Status**: Corrigido
- **Correção**: Não reproduzido (suíte completa verde nas rodadas desta correção). Mitigação só nos testes: `configure({ asyncUtilTimeout: 5000 })` em `DailyFeed.test.tsx`; sem teste novo, pois a falha não foi reproduzida.
