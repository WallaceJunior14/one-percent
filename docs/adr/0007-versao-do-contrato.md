# ADR 0007 — Política de versão do contrato do conteúdo diário

- **Status**: Aceito
- **Data**: 2026-11-22

## Contexto

O app instalado e o pipeline evoluem em ritmos diferentes: o pipeline muda a qualquer momento, e o app só muda quando o usuário instala uma versão nova. Até a spec 002, o app recusava o dia inteiro se o JSON trouxesse um campo desconhecido ou um único card inválido, e exigia `schemaVersion: 1` exato. Qualquer evolução do conteúdo deixava os apps já instalados presos no conteúdo antigo.

## Decisão

1. **O produtor é estrito; o leitor é tolerante.** O pipeline valida a própria saída contra `contracts/daily-content.schema.json` com `additionalProperties: false`, para pegar os próprios bugs. O app ignora campos desconhecidos e descarta só os cards inválidos ou de tipo desconhecido.
2. **`schemaVersion` é a versão principal.** Uma mudança **aditiva** (campo novo opcional, tipo novo de card, valor novo em uma lista aberta) mantém a versão. Uma mudança **incompatível** (remover campo, mudar tipo, mudar significado, tornar obrigatório um campo antes opcional) cria uma versão principal nova.
3. **Transição de versão principal.** O conteúdo da versão nova é publicado em `latest-v<N>.json` e `daily/v<N>/` ao lado do atual. O formato anterior continua sendo publicado até que o app que lê a versão nova esteja instalado. Um app que encontra uma versão maior do que suporta continua com o último conteúdo compatível e sugere a atualização.
4. **Ordem de entrega.** Quando uma mudança exige que o app saiba ler algo novo, o app tolerante sai primeiro; o pipeline só publica depois.
5. **Afrouxar um limite** (ex.: `maxLength` maior, mais alternativas no quiz) continua sendo aditivo, mas o app antigo descarta os itens que passarem do limite dele. Por isso, o app com o limite novo sai antes de o pipeline começar a usar a folga.

## Alternativas consideradas

| Opção | Prós | Contras |
|---|---|---|
| Produtor estrito, leitor tolerante, versão principal só para incompatíveis (escolhida) | Campos novos não quebram apps antigos; o pipeline continua pegando os próprios erros | Dois validadores com regras diferentes de rigor |
| Leitor estrito, versão nova a cada mudança | Comportamento simples de entender | Toda mudança quebra os apps instalados até serem atualizados |
| Sem versão, leitor tolerante a tudo | Nada a manter | Mudanças incompatíveis passam despercebidas e viram bugs no app |

## Consequências

- **Positivas**: o pipeline pode acrescentar dados (catálogo, parâmetros do feed) sem esperar uma versão nova do app.
- **Negativas / custos**: durante uma transição de versão principal, o pipeline publica dois formatos. Testes de compatibilidade (saída do pipeline lida pelo parser do app; payload com campo desconhecido) passam a ser obrigatórios no CI.
