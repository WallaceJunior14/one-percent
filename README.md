# 1% ao Dia

App Android que entrega, todo dia, uma dose finita de conhecimento: os principais assuntos de tecnologia, economia, finanças, saúde e ciência, incluindo artigos científicos explicados em linguagem simples, em cards no estilo de uma rede social.

> Status: em desenvolvimento (MVP, spec 001 — Fase 0 concluída).

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

| Comando | O que faz |
|---|---|
| `pytest` | testes |
| `ruff check .` / `ruff format .` | lint / formatação |
| `mypy` | checagem de tipos (strict) |

## Metodologia

Desenvolvido com **SDD + TDD**: nenhuma feature começa sem spec aprovada, e nenhum código sem um teste falhando antes. Especificações em [`specs/`](specs), decisões em [`docs/adr/`](docs/adr).

## Licença

A definir.
