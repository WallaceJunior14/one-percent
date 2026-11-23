# Changelog

Todas as mudanças relevantes deste projeto. Formato [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/), versões em [SemVer](https://semver.org/lang/pt-BR/).

## [Unreleased]

### Changed

- **Divisão do feed por peso de área** (spec 002): cada área tem um peso publicado no conteúdo; com todas as áreas escolhidas, a divisão continua meio a meio entre os grupos, mas com escolha parcial passa a ser proporcional aos pesos (ex.: Tecnologia + Economia = 9 + 6).
- O app decide se o conteúdo está atrasado pelo horário de publicação (aviso após 30 h), não pela data do celular.
- Textos do LLM acima do limite são encurtados no fim de frase, em vez de descartar o card.
- Parâmetros da operação ficam em `pipeline/src/one_percent/config/pipeline.yaml`; o endereço do conteúdo, em `app/app.json` (`expo.extra.contentBaseUrl`).

### Added

- Contrato com grupos, pesos por área e parâmetros do feed (aditivo, `schemaVersion` 1; ADR 0007).
- Leitura tolerante no app: campos desconhecidos ignorados, só o card inválido é descartado.
- Dados locais versionados com migração; dado ilegível é preservado, nunca apagado.
- Custo estimado por execução e alerta de orçamento no log do pipeline.

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
