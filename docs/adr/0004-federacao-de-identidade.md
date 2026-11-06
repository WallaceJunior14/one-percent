# ADR 0004 — Federação de identidade (WIF) em vez de chave de API no GitHub Actions

- **Status**: Aceito
- **Data**: 2026-11-05

## Contexto

O pipeline diário (T053) chama a API da Anthropic a partir do GitHub Actions, sem supervisão, num repositório **público**. O plano original guardava uma chave `sk-ant-...` em *Actions secrets*. A Anthropic recomenda Workload Identity Federation (WIF) para pipelines de CI, para eliminar segredos fixos.

## Decisão

No GitHub Actions, autenticar com **federação de identidade**: o job pede ao GitHub um token OIDC (audience `https://api.anthropic.com`) e o SDK o troca por um acesso temporário da Anthropic, vinculado a uma conta de serviço. Localmente, continuar com chave pessoal ou `ant auth login`.

Configuração no Claude Console (*Settings → Workload identity → Connect workload → GitHub Actions*):

| Item | Valor |
|---|---|
| Issuer | `https://token.actions.githubusercontent.com` (modo `discovery`) |
| `subject_prefix` | `repo:WallaceJunior14@40186223/one-percent@1441433068:ref:refs/heads/main` |
| `audience` | `https://api.anthropic.com` |
| `claims` | `repository_owner: WallaceJunior14` |
| Eventos (`event_name`) | `schedule` e `workflow_dispatch` (o workflow nunca roda por `push`) |

O GitHub emite o `sub` no formato com **IDs imutáveis** (`<dono>@<id>/<repo>@<id>`). O formato sem IDs (`repo:WallaceJunior14/one-percent:...`) não casa e a troca falha com o motivo `match_subject_prefix`. Os IDs também impedem que um repositório recriado com o mesmo nome herde o acesso.
| `oauth_scope` | `workspace:inference` (o pipeline só chama a API de mensagens) |
| `token_lifetime_seconds` | `600` |

O workflow lê quatro ids **não secretos** das *variables* do repositório: `ANTHROPIC_FEDERATION_RULE_ID`, `ANTHROPIC_ORGANIZATION_ID`, `ANTHROPIC_SERVICE_ACCOUNT_ID` e `ANTHROPIC_WORKSPACE_ID`.

## Alternativas consideradas

| Opção | Prós | Contras |
|---|---|---|
| WIF (escolhida) | Nenhum segredo fixo para vazar ou rotacionar; acesso restrito ao repositório e ao branch `main` (forks não conseguem); auditoria no Console | Configuração inicial no Console; o workflow precisa renovar o token do GitHub durante a execução |
| Chave de API em *Actions secrets* | Configuração mais simples | Segredo de longa duração; se vazar (log, alteração do workflow), vale até ser revogado |

## Consequências

- **Positivas**: o repositório público não depende de nenhum segredo; o código Python não mudou (`anthropic.Anthropic()` sem argumentos detecta a federação).
- **Negativas / custos**:
  - O token do GitHub dura ~5 min e cada um só pode ser trocado uma vez; o acesso da Anthropic dura no máximo o dobro do tempo restante dele. Como a espera pelo batch pode passar de 10 min, o workflow grava um token novo a cada 60 s no arquivo que o SDK relê a cada renovação.
  - `ANTHROPIC_API_KEY` não pode existir no ambiente do job: mesmo vazia, tem prioridade sobre a federação. O workflow faz `unset` por garantia.
- **Diagnóstico**: falhas de troca retornam sempre `401 Authentication failed`; o motivo aparece em *Workload identity → Authentication history* no Console.
