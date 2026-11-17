# Changelog

Todas as mudanças relevantes deste projeto. Formato [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/), versões em [SemVer](https://semver.org/lang/pt-BR/).

## [Unreleased]

## [0.1.0] — 2026-11-16

Primeira versão do MVP (spec [001](specs/001-mvp-feed-diario/spec.md)).

### Added

- **Contrato de dados**: JSON Schema do conteúdo diário, compartilhado por pipeline e app, com exemplo de 22 cards fictícios.
- **Pipeline diário** (Python):
  - Coleta de 23 fontes: RSS, arXiv, bioRxiv/medRxiv e Hugging Face Daily Papers.
  - Janela de tempo, deduplicação por título, classificação por palavras-chave e ranking por subárea com cota de notícias e artigos.
  - Resumos em português com Claude Haiku pela Batch API, com saída estruturada. URLs, autores e datas vêm sempre da fonte.
  - Publicação de `latest.json` e dos últimos 7 dias no GitHub Pages, com validação contra o contrato.
- **Execução diária**: GitHub Actions disparado às 05:00 por agendador externo (cron do GitHub como reserva), com idempotência (`--skip-if-published`), até 2 tentativas e códigos de saída que separam falhas temporárias de permanentes.
- **App Android** (Expo):
  - Onboarding de áreas e subáreas.
  - Feed finito de 15 cards: 50% finanças, economia e saúde; 50% ciência e tecnologia; pelo menos 30% de artigos.
  - Cards compactos com painel de detalhe e links abertos no navegador.
  - Cache e modo sem internet, com aviso quando o conteúdo é de um dia anterior.
- **Engajamento**: "Concluir o dia" com sequência de dias, stories por área, cards salvos disponíveis offline, quiz diário de 3 perguntas, Perfil com progresso acumulado e lembrete diário opcional com notificação local.
- **Acessibilidade**: tema claro e escuro do sistema, contraste WCAG AA verificado em teste e layout que acompanha a fonte grande do sistema.
- **Documentação**: ADRs 0001–0006, verificação das fontes, guia do agendador externo, code review e auditoria de segurança do MVP.

### Security

- XML dos feeds verificado contra entidades externas (XXE) antes do parsing; respostas limitadas em tamanho e tempo; só `https`, inclusive após redirecionamentos.
- O app só abre links `https` e mostra os textos do LLM como texto puro.
- Workflow diário com dependências travadas por hash, job sem permissão de escrita para o código que processa os feeds e actions fixadas por SHA.
