# ADR 0001 — Conteúdo estático por dia e personalização no app

- **Status**: Aceito
- **Data**: 2026-10-31

## Contexto

O app precisa entregar todo dia um feed curado e resumido por LLM (spec 001). O orçamento de operação é de até US$ 5/mês (RNF-005), o MVP não tem contas de usuário (RNF-004) e o app deve funcionar offline depois de baixar o conteúdo (RNF-002).

## Decisão

Um pipeline diário gera **um único arquivo JSON por dia**, com um pool de cards por subárea, e o publica como arquivo estático. Cada app baixa esse arquivo e **monta localmente** o feed de 15 cards conforme as áreas escolhidas pelo usuário.

## Alternativas consideradas

| Opção | Prós | Contras |
|---|---|---|
| JSON estático + personalização no app (escolhida) | Custo fixo e quase zero; sem servidor; privacidade total; cache e offline triviais | Personalização limitada ao que está no pool; o arquivo cresce com o número de subáreas |
| Backend com API e feed por usuário | Personalização ilimitada; métricas centralizadas | Servidor, banco e autenticação para manter; custo cresce com usuários; dados pessoais no servidor |
| Gerar o conteúdo no próprio celular (chamar LLM do app) | Sem pipeline | Chave da API exposta no APK; custo por usuário; lento |

## Consequências

- **Positivas**: infraestrutura gratuita (GitHub Actions + Pages); nenhum dado do usuário sai do celular; o app fica simples de testar.
- **Negativas / custos**: recomendações por comportamento (algoritmo) exigiriam rever esta decisão; o JSON precisa de versionamento (`schemaVersion`).
- **O que fica mais difícil de mudar depois**: o contrato `contracts/daily-content.schema.json` é compartilhado por pipeline e app; mudanças nele precisam ser compatíveis com versões instaladas do app.
