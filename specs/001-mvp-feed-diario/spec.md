# Spec 001 — MVP: Feed diário de conhecimento

- **Status**: Aprovada (2026-10-31)
- **Criada em**: 2026-10-31
- **Nome do app**: 1% ao Dia

## Contexto e problema

Redes sociais e vídeos curtos (Shorts) consomem muito tempo de tela com conteúdo que pouco acrescenta. Ao mesmo tempo, quem quer se manter atualizado em várias áreas (tecnologia, economia, finanças, saúde, ciência) precisa garimpar fontes dispersas. Para pesquisadores, isso inclui artigos científicos, que raramente chegam em um formato rápido de consumir.

O app aproveita o hábito de "rolar o feed" e o direciona para algo que gera aprendizado: todo dia, os principais assuntos e artigos científicos das áreas escolhidas, em cards curtos no estilo de uma rede social.

## Objetivo

Oferecer, todos os dias, uma dose **finita** de conhecimento curado (~10 minutos) que deixe o usuário um pouco mais informado e mais inteligente a cada dia, e transformar isso em hábito sem recorrer ao scroll infinito.

## Princípios de produto

1. **Finito por design**: o feed do dia tem fim. Concluir o dia é a recompensa.
2. **Sempre com fonte**: todo card leva ao conteúdo original. O resumo nunca afirma algo que não esteja na fonte.
3. **Hábito, não compulsão**: as mecânicas de retenção reforçam constância (sequência de dias, progresso, revisão), e não o tempo de tela.
4. **Ciência acessível**: artigos científicos com o mesmo destaque que as notícias, explicados em linguagem simples, mas sem perder o rigor (método, resultado, limitações).

## Histórias de usuário

### H1 — Ler o conteúdo do dia (P1)

Como usuário, quero abrir o app e ver um feed vertical com os principais assuntos do dia nas minhas áreas, para me atualizar rapidamente.

**Critérios de aceite**
1. **Dado** que há conteúdo publicado para hoje, **quando** abro o app, **então** vejo um feed vertical de cards, um por vez, que avanço deslizando.
2. **Dado** um card de notícia, **quando** ele é exibido, **então** mostra: área, título, resumo de até 3 frases em português, "por que importa" em 1 frase, nome da fonte, data de publicação e um botão para abrir a matéria original.
3. **Dado** o último card do dia, **quando** deslizo além dele, **então** não aparece mais conteúdo; aparece a tela de dia concluído (H4).
4. **Dado** que não há conteúdo de hoje disponível (falha na publicação ou sem internet no primeiro acesso), **quando** abro o app, **então** vejo o conteúdo do dia anterior com um aviso, ou, se não houver nenhum, uma mensagem clara com a opção de tentar de novo.

### H2 — Ler artigos científicos explicados (P1)

Como pesquisador, quero que o feed traga artigos científicos recentes das minhas áreas explicados de forma simples, para acompanhar a ciência no meu tempo livre.

**Critérios de aceite**
1. **Dado** um card de artigo científico, **quando** ele é exibido, **então** é visualmente identificável como "Artigo" e mostra: título original, título traduzido, resumo em linguagem simples (até 3 frases), **método** em 1 frase, **principal resultado** em 1 frase, **limitações** em 1 frase, autores (até 3 + "et al."), repositório/periódico, data, e links para o artigo e para o PDF quando disponível.
2. **Dado** que o artigo é um preprint (sem revisão por pares), **quando** o card é exibido, **então** há uma indicação "Preprint — não revisado por pares".
3. **Dado** que o resumo é gerado automaticamente, **quando** ele é exibido, **então** ele se baseia apenas no título e no resumo (abstract) do artigo, sem acrescentar afirmações que não estejam lá.

### H3 — Escolher minhas áreas de interesse (P1)

Como usuário, quero escolher as áreas e subáreas que me interessam, para receber só o que é relevante para mim.

**Critérios de aceite**
1. **Dado** o primeiro acesso, **quando** abro o app, **então** vejo um onboarding curto onde escolho pelo menos 1 área e, opcionalmente, subáreas.
2. **Dado** que já escolhi áreas, **quando** acesso as configurações, **então** posso alterá-las, e a mudança vale a partir do próximo carregamento do feed.
3. **Dado** que escolhi áreas, **quando** o feed do dia é montado, **então** ele contém apenas cards dessas áreas, distribuídos de forma equilibrada entre elas.

Áreas iniciais:

| Área | Subáreas sugeridas | Tipo de conteúdo |
|---|---|---|
| Tecnologia | IA, Desenvolvimento de software, Segurança, Hardware | Notícias + Artigos |
| Ciência | IA/ML, Computação, Física, Biologia | Artigos |
| Economia | Brasil, Mundo | Notícias |
| Finanças | Mercado, Investimentos, Finanças pessoais | Notícias |
| Saúde | Medicina, Nutrição, Saúde mental | Notícias + Artigos |

### H4 — Concluir o dia e manter a sequência (P1)

Como usuário, quero ver que concluí o conteúdo do dia e acompanhar minha sequência de dias, para criar o hábito.

**Critérios de aceite**
1. **Dado** que vi todos os cards do dia, **quando** chego ao fim do feed, **então** vejo a tela "Dia concluído" com: quantidade de cards lidos, áreas cobertas e a sequência atual de dias.
2. **Dado** que concluí o dia ontem e concluo hoje, **quando** a tela de conclusão aparece, **então** a sequência aumenta em 1.
3. **Dado** que não concluí o dia anterior, **quando** concluo hoje, **então** a sequência volta para 1.
4. **Dado** que já concluí o dia, **quando** abro o app novamente no mesmo dia, **então** posso rever os cards, e a sequência não muda.
5. O "dia" é contado no fuso horário do celular.

Regra de conclusão: **ver todos os cards do feed do dia** (chegar ao último).

### H5 — Stories por área (P2)

Como usuário, quero ver no topo do app um "story" por área com o resumo do dia, para ter uma visão geral rápida antes de ir ao feed.

**Critérios de aceite**
1. **Dado** o conteúdo do dia, **quando** abro o app, **então** vejo no topo um círculo por área escolhida que tenha conteúdo hoje.
2. **Dado** que toco em um story, **quando** ele abre, **então** vejo de 3 a 5 telas com as manchetes principais daquela área, avançando por toque ou automaticamente.
3. **Dado** que já vi um story, **quando** volto ao topo, **então** o círculo aparece como visto.

### H6 — Salvar cards (P2)

Como usuário, quero salvar cards para consultar depois, montando minha biblioteca pessoal.

**Critérios de aceite**
1. **Dado** um card, **quando** toco em "Salvar", **então** ele vai para a aba "Salvos" e o ícone indica que está salvo; tocar de novo remove.
2. **Dado** cards salvos, **quando** abro "Salvos", **então** vejo a lista do mais recente para o mais antigo, com filtro por área, e o conteúdo completo do card continua disponível em dias posteriores e sem internet.

### H7 — Quiz do dia (P2)

Como usuário, quero responder um quiz rápido sobre o que li, para fixar o conteúdo.

**Critérios de aceite**
1. **Dado** que concluí o dia, **quando** estou na tela de conclusão, **então** posso fazer o quiz com 3 perguntas de múltipla escolha (4 alternativas) sobre cards do dia.
2. **Dado** que respondo uma pergunta, **quando** escolho uma alternativa, **então** vejo na hora se acertei, qual era a resposta certa e um atalho para o card de origem.
3. **Dado** que termino o quiz, **quando** vejo o resultado, **então** a pontuação (0–3) fica registrada no meu histórico.
4. O quiz é opcional e não afeta a sequência.

### H8 — Lembrete diário (P3)

Como usuário, quero receber uma notificação por dia no horário que eu escolher, avisando que o conteúdo está pronto.

**Critérios de aceite**
1. **Dado** que ativei o lembrete e escolhi um horário, **quando** chega esse horário, **então** recebo uma única notificação, por exemplo: "Seu dia está pronto: 15 cards, ~10 min".
2. **Dado** que já concluí o dia antes do horário, **quando** chega o horário, **então** não recebo notificação.
3. O lembrete vem desligado por padrão e é oferecido no fim do onboarding.

### H9 — Meu progresso (P3)

Como usuário, quero ver meu progresso acumulado, para perceber que estou evoluindo.

**Critérios de aceite**
1. **Dado** o uso do app, **quando** abro o Perfil, **então** vejo: sequência atual, maior sequência, total de cards lidos, total de artigos científicos lidos, distribuição por área e média de acertos no quiz.

## Requisitos funcionais

- **RF-001**: Publicar diariamente um conjunto de conteúdos curados por área, disponível até as 7h (horário de Brasília).
- **RF-002**: Cada conteúdo deve ter fonte original identificada e link funcional.
- **RF-003**: Notícias devem ter sido publicadas nas últimas 24–36 horas; artigos científicos, submetidos ou publicados nos últimos 7 dias.
- **RF-004**: Não pode haver itens duplicados no mesmo dia (mesma notícia vinda de fontes diferentes conta como duplicada).
- **RF-005**: Os conteúdos devem ser selecionados por relevância dentro de cada área, e não apenas pelos mais recentes.
- **RF-006**: Fontes em outros idiomas são aceitas; o card é sempre apresentado em português.
- **RF-007**: O feed do dia tem tamanho fixo de **15 cards**, distribuídos entre as áreas escolhidas, com pelo menos **30% de artigos científicos** quando alguma área escolhida tiver artigos.
- **RF-008**: Cada conteúdo publicado inclui o material do quiz (pergunta, alternativas, resposta correta) e dos stories.
- **RF-009**: O app guarda localmente: áreas escolhidas, progresso, sequência, salvos, histórico do quiz e o conteúdo do dia.
- **RF-010**: Abrir o link original de um card leva ao navegador do celular, fora do app.

## Requisitos não funcionais

- **RNF-001** (Plataforma): Android, idioma português do Brasil.
- **RNF-002** (Offline): depois de baixado, o conteúdo do dia e os salvos funcionam sem internet.
- **RNF-003** (Desempenho): com o conteúdo em cache, o feed abre em menos de 2 segundos e a rolagem é fluida.
- **RNF-004** (Privacidade): o MVP não exige conta nem coleta dados pessoais; preferências e histórico ficam só no celular.
- **RNF-005** (Custo): a operação diária (coleta + resumos) deve custar até **US$ 5/mês**.
- **RNF-006** (Confiabilidade): se a publicação diária falhar, o app continua funcionando com o último conteúdo disponível (H1, critério 4).
- **RNF-007** (Acessibilidade): textos respeitam o tamanho de fonte do sistema; contraste adequado; tema claro e escuro.
- **RNF-008** (Fontes): só usar fontes cujo acesso automatizado seja permitido (feeds RSS públicos, APIs abertas), respeitando os termos de uso; os cards exibem resumo próprio e link, e não reproduzem o texto integral.

## Fora de escopo (MVP)

- Login, contas e sincronização entre dispositivos
- Recursos sociais: seguir pessoas, comentários, curtidas públicas, compartilhamento interno
- iOS e versão web
- Áudio (narração dos cards)
- Repetição espaçada dos salvos
- Leitor de PDF dentro do app e exportação para Zotero/BibTeX
- Personalização por algoritmo de recomendação
- Busca no histórico de dias anteriores (além dos salvos)
- Monetização e anúncios
- Publicação na Play Store (o MVP é instalado diretamente no celular)

## Métricas de sucesso

- O próprio autor conclui o dia em pelo menos **12 de 14 dias** seguidos.
- Tempo médio diário no app entre **8 e 15 minutos**.
- Redução percebida de pelo menos **20 minutos/dia** em Shorts/redes sociais (autoavaliação).
- Qualidade dos cards: em uma amostra semanal de 10 cards, no máximo 1 com resumo impreciso em relação à fonte.

## Decisões tomadas

Todas as dúvidas foram resolvidas em 2026-10-31 com os valores propostos: nome "1% ao Dia"; áreas da tabela da H3; feed de 15 cards com ≥ 30% de artigos; dia concluído ao ver todos os cards; conteúdo pronto até 7h; orçamento de até US$ 5/mês.

## Histórico

| Data | Mudança | Motivo |
|---|---|---|
| 2026-10-31 | Criação | — |
| 2026-10-31 | Aprovada; dúvidas resolvidas com os valores propostos | Decisão do autor |
