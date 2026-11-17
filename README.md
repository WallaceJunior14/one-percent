# 1% ao Dia

App Android que entrega, todo dia, uma dose finita de conhecimento: os principais assuntos de tecnologia, economia, finanças, saúde e ciência, incluindo artigos científicos explicados em linguagem simples, em cards no estilo de uma rede social.

> Status: MVP 0.1.0 completo (spec 001). Conteúdo real publicado todo dia; app rodando pelo Expo Go. Veja o [CHANGELOG](CHANGELOG.md).

## Funcionalidades

- Feed diário finito de 15 cards: 50% finanças, economia e saúde; 50% ciência e tecnologia; pelo menos 30% de artigos científicos
- Card compacto e painel de detalhe com resumo, por que importa e, nos artigos, método, resultado e limitações
- Stories por área, cards salvos (disponíveis offline) e quiz diário de 3 perguntas
- "Concluir o dia", sequência de dias e Perfil com progresso acumulado
- Lembrete diário opcional (notificação local, desligado por padrão)
- Funciona sem internet com o último conteúdo baixado; tema claro/escuro e fonte do sistema

## Como funciona

```
pipeline/ (Python, GitHub Actions diário)  →  JSON do dia (GitHub Pages)  →  app/ (Expo, Android)
```

O conteúdo é gerado uma vez por dia para todos os usuários; o app monta o feed pessoal localmente, a partir das áreas escolhidas. Detalhes em [`docs/adr/0001`](docs/adr/0001-conteudo-estatico-diario.md).

## Estrutura

```
one-percent/
├── app/          # app Expo (React Native + TypeScript)
├── pipeline/     # coleta, resumo e publicação do conteúdo (Python)
├── contracts/    # JSON Schema compartilhado entre pipeline e app
├── specs/        # especificações (SDD): spec, plan, tasks
└── docs/         # ADRs, reviews e auditorias de segurança
```

## Pré-requisitos

- Node.js 24+
- Python 3.12
- App **Expo Go** no celular Android (para desenvolvimento)

## App

```bash
cd app
npm install
npm start          # abre o servidor; escaneie o QR code com o Expo Go
```

| Comando | O que faz |
|---|---|
| `npm test` | testes (Jest + React Native Testing Library) |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript sem emitir arquivos |
| `npm run format` | formata com Prettier |

## Pipeline

```bash
cd pipeline
py -3.12 -m venv .venv            # Windows; em Linux/macOS: python3.12 -m venv .venv
.venv/Scripts/activate            # Linux/macOS: source .venv/bin/activate
pip install -e ".[dev]"
```

Para usar o LLM real localmente, exporte a chave antes de rodar (modelo em [`pipeline/.env.example`](pipeline/.env.example)):

```bash
export ANTHROPIC_API_KEY=...      # PowerShell: $env:ANTHROPIC_API_KEY = "..."
```

| Comando | O que faz |
|---|---|
| `python -m one_percent run --fake --out out` | roda o pipeline com fontes reais e resumos falsos (sem custo); gera `out/latest.json` |
| `python -m one_percent run --limit 3 --out out` | roda com o LLM real em só 3 itens (exige `ANTHROPIC_API_KEY`) |
| `pytest` | testes |
| `ruff check .` / `ruff format .` | lint / formatação |
| `mypy` | checagem de tipos (strict) |

**Dependências travadas.** O workflow diário instala `pipeline/requirements.lock` com `--require-hashes`. Ao mudar dependências no `pyproject.toml`, regenere o lock e commite junto:

```bash
pip install pip-tools
pip-compile --generate-hashes --strip-extras --no-emit-index-url --output-file requirements.lock pyproject.toml
```

## Execução diária

O workflow [`daily-content.yml`](.github/workflows/daily-content.yml) é disparado às 05:00 (Brasília) por um agendador externo ([guia](docs/ops/agendador-externo.md), [ADR 0006](docs/adr/0006-agendador-externo.md)), com o cron do GitHub como reserva, e publica o JSON no branch `gh-pages`. Ele tem dois jobs: `generate`, que roda o pipeline sem permissão de escrita no repositório, e `publish`, que só copia o resultado para o `gh-pages`. Ele se autentica na Anthropic com o secret `ANTHROPIC_API_KEY`, cadastrado em *Settings → Secrets and variables → Actions → Secrets* ([ADR 0005](docs/adr/0005-chave-de-api-no-github-actions.md)).

Conteúdo publicado (GitHub Pages):

| Arquivo | URL |
|---|---|
| Dia mais recente | https://wallacejunior14.github.io/one-percent/latest.json |
| Dia específico (últimos 7) | `https://wallacejunior14.github.io/one-percent/daily/AAAA-MM-DD.json` |
| Contrato (JSON Schema) | https://wallacejunior14.github.io/one-percent/schemas/daily-content-v1.json |

## Metodologia

Desenvolvido com **SDD + TDD**: nenhuma feature começa sem spec aprovada, e nenhum código sem um teste falhando antes. Especificações em [`specs/`](specs), decisões em [`docs/adr/`](docs/adr), code reviews em [`docs/reviews/`](docs/reviews) e auditorias de segurança em [`docs/security/`](docs/security).

## Licença

A definir.
