# ADR 0006 — Agendador externo para o conteúdo diário

- **Status**: Aceito
- **Data**: 2026-11-14

## Contexto

O conteúdo do dia deve estar pronto até as 07:00 de Brasília (RF-001). O cron do GitHub Actions não garante horário: em 14/11, o disparo agendado para 00:17 executou às 07:17 (7 h de atraso), e na semana anterior os atrasos foram de 6 a 10 h, mesmo com três horários e minutos fora da hora cheia.

## Decisão

Um **agendador externo gratuito (cron-job.org)** dispara o workflow às **05:00** pela API do GitHub (`workflow_dispatch` com `skip_if_published=true`), usando um token *fine-grained* restrito a este repositório e à permissão *Actions: Read and write*. Os três horários de cron do GitHub continuam como reserva. Configuração em [`docs/ops/agendador-externo.md`](../ops/agendador-externo.md).

## Alternativas consideradas

| Opção | Prós | Contras |
|---|---|---|
| Agendador externo (escolhida) | Horário pontual; quase nenhuma mudança de código; o cron do GitHub vira reserva | Conta num serviço de terceiros, que guarda um token do GitHub (restrito) |
| Gerar na noite anterior | Sem serviço externo | Mudanças no pipeline (data-alvo) e no app (buscar o arquivo pela data); notícias da madrugada ficam para o dia seguinte |
| Só o cron do GitHub | Nada a configurar | Atrasos de até 10 h; prazo das 07:00 perdido |

## Consequências

- **Positivas**: conteúdo pronto por volta das 05:05; falhas do agendador são cobertas pelo cron do GitHub.
- **Negativas / custos**: o token expira (máximo de 1 ano) e precisa ser renovado; um vazamento permitiria disparar ou cancelar workflows deste repositório, mas não ler secrets nem alterar código.
- **Idempotência**: `--skip-if-published` garante que disparos repetidos no mesmo dia não chamem o LLM de novo.
