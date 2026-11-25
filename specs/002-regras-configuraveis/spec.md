# Spec 002 — Regras configuráveis e contrato evolutivo

- **Status**: Aprovada (2026-11-22), com as respostas às dúvidas
- **Criada em**: 2026-11-22
- **Corrige**: [Spec 001](../001-mvp-feed-diario/spec.md)

## Contexto e problema

A spec 001 fixou valores que eram decisões do MVP como se fossem regras permanentes: 15 cards, 30% de artigos, dois grupos com 50% cada, cinco áreas, 3 perguntas com 4 alternativas, stories de 3 a 5 telas, janelas de 36 h e 7 dias, horário de Brasília. Esses valores estão repetidos na spec, no contrato, no pipeline, no prompt do LLM e no app, e mudar qualquer um deles exige alterar vários lugares e publicar uma versão nova do app.

A revisão de 2026-11-22 encontrou problemas concretos:

1. **Contrato rígido quebra apps instalados.** O app rejeita campos desconhecidos e exige `schemaVersion: 1` e exatamente 4 alternativas. Se um único card vier inválido, o dia inteiro é descartado. Qualquer campo novo publicado pelo pipeline faz todos os apps já instalados ficarem presos no conteúdo antigo até serem atualizados.
2. **Dados locais podem sumir.** Se o formato salvo de progresso, salvos ou histórico do quiz não for reconhecido (por exemplo, depois de uma atualização do app), o app volta ao estado vazio e a sequência de dias se perde sem aviso.
3. **Catálogo de áreas em três lugares.** As áreas e os grupos estão escritos na configuração do pipeline, no código do app e na tabela da spec 001. Adicionar uma área exige nova versão do app, e um grupo novo não existe para quem já instalou.
4. **Feed pode ficar curto sem explicação.** O pipeline publica o dia se houver 15 cards no total, mas quem escolheu poucas áreas pode receber bem menos. O contador "n de 15", o lembrete "15 cards, ~10 min" e o mínimo de publicação assumem que todo feed tem 15 cards.
5. **Fuso horário misturado.** O conteúdo é datado pelo horário de Brasília e o app compara com a data do celular. Fora desse fuso, um conteúdo recém-publicado pode aparecer como "de um dia anterior", ou o de ontem como "de hoje".
6. **Limites de texto repetidos.** O tamanho máximo de cada texto aparece no contrato, no validador do pipeline, no prompt e no validador do app. Na mudança de 14/11, foi preciso alterar quatro lugares, e o prompt ainda pede valores diferentes dos limites.
7. **Parâmetros operacionais dentro do código.** Modelo do LLM, teto de itens por execução, janelas de tempo, retenção de dias, faixa de stories e endereço do conteúdo só mudam com uma alteração no código.
8. **Inconsistência na spec 001.** A seção "Decisões tomadas" diz "dia concluído ao ver todos os cards", mas a regra vigente (H4) é tocar em "Concluir o dia".

## Objetivo

Separar **regras** (o que o app garante) de **parâmetros** (os valores atuais). Os parâmetros passam a ter um único lugar de definição, podem mudar sem alterar o código e, quando afetam o app, sem publicar uma versão nova dele. O conteúdo publicado evolui sem quebrar apps já instalados, e os dados do usuário sobrevivem às atualizações.

## Histórias de usuário

### H1 — Conteúdo novo não quebra app antigo (P1)

Como usuário, quero que o app continue mostrando o conteúdo do dia mesmo que eu ainda não tenha atualizado o app, para não ficar preso em conteúdo velho.

**Critérios de aceite**
1. **Dado** um conteúdo publicado com campos que o app não conhece, **quando** o app o carrega, **então** ignora esses campos e mostra o feed normalmente.
2. **Dado** um conteúdo com um card inválido ou de um tipo que o app não conhece, **quando** o app o carrega, **então** descarta só esse card, mantém os demais e registra o descarte para diagnóstico.
3. **Dado** um conteúdo com uma versão de contrato maior que a suportada pelo app, **quando** o app o carrega, **então** continua com o último conteúdo compatível e mostra o aviso de conteúdo anterior, com a sugestão de atualizar o app.
4. **Dado** que o pipeline muda o contrato, **quando** a mudança só acrescenta campos opcionais, **então** a versão principal do contrato não muda; mudanças incompatíveis exigem nova versão principal, publicada lado a lado com a anterior por um período de transição.

### H2 — Meu progresso sobrevive às atualizações (P1)

Como usuário, quero que minha sequência, salvos e histórico continuem depois de atualizar o app, para não perder o que construí.

**Critérios de aceite**
1. **Dado** dados locais gravados por uma versão anterior do app, **quando** abro a versão nova, **então** eles são convertidos para o formato novo, sem perda.
2. **Dado** dados locais que o app não consegue interpretar, **quando** abro o app, **então** o conteúdo original fica guardado à parte (não é apagado), o app segue com dados vazios e o problema fica registrado para diagnóstico.
3. **Dado** que um tipo de dado não conseguiu ser lido (por exemplo, os salvos), **quando** o app abre, **então** os outros tipos (progresso, histórico do quiz) não são afetados.

### H3 — Áreas novas sem atualizar o app (P1)

Como usuário, quero ver áreas e grupos novos assim que forem publicados, para não depender de atualizar o app.

**Critérios de aceite**
1. **Dado** que o conteúdo publicado traz o catálogo de áreas, subáreas e grupos, **quando** abro o onboarding ou a edição de áreas, **então** vejo o catálogo publicado mais recente.
2. **Dado** o primeiro acesso sem internet, **quando** abro o onboarding, **então** vejo o catálogo que vem junto com o app.
3. **Dado** que escolhi uma área que deixou de ser publicada, **quando** o feed é montado, **então** essa área é ignorada sem erro e, se nenhuma área escolhida sobrar, o app me leva a escolher de novo.
4. **Dado** o peso publicado de cada área (tema principal), **quando** o feed é montado, **então** os cards se dividem entre as áreas escolhidas na proporção desses pesos. Subáreas não têm peso próprio: dentro de uma área, os cards seguem o ranking.
5. **Dado** os pesos padrão, **quando** escolho todas as áreas, **então** a divisão continua a da spec 001: metade para Ciência & Tecnologia e metade para Mercado & Saúde.
6. **Dado** um grupo de áreas, **quando** o onboarding é exibido, **então** ele organiza as áreas na tela; a divisão do feed vem só dos pesos das áreas.

### H4 — Feed com regras explícitas e números reais (P1)

Como usuário, quero que contadores, avisos e lembretes reflitam o feed que eu realmente recebo, para confiar no que o app mostra.

**Critérios de aceite**
1. **Dado** o feed montado, **quando** ele é exibido, **então** o contador mostra "n de N vistos", sendo N o tamanho real do feed.
2. **Dado** que as áreas escolhidas não têm cards suficientes para o tamanho padrão do feed, **quando** o feed é montado, **então** ele usa os cards disponíveis e o encerramento informa que hoje houve menos conteúdo nessas áreas.
3. **Dado** o lembrete ativo, **quando** a notificação é agendada, **então** ela informa o tamanho do feed e o tempo estimado de leitura calculados a partir dos parâmetros vigentes, e não de valores fixos.
4. **Dado** os parâmetros do feed (tamanho, fatia mínima de artigos, pesos dos grupos, número de perguntas do quiz), **quando** são alterados no conteúdo publicado, **então** o app passa a usá-los no próximo carregamento, com os valores atuais como padrão quando ausentes.

### H5 — "Hoje" funciona em qualquer fuso (P2)

Como usuário fora do fuso de Brasília, quero que o app saiba se o conteúdo é o mais recente, para não ver avisos errados.

**Critérios de aceite**
1. **Dado** um conteúdo publicado, **quando** o app decide se ele é atual, **então** usa o momento de publicação e o intervalo esperado até a próxima publicação, e não a comparação entre a data do conteúdo e a data do celular.
2. **Dado** que o conteúdo passou do intervalo esperado mais uma tolerância, **quando** abro o app, **então** vejo o aviso de conteúdo anterior.
3. A sequência de dias continua contada no fuso do celular (spec 001, H4-5).

### H6 — Limites de texto definidos uma vez (P2)

Como mantenedor, quero definir o tamanho máximo de cada texto num único lugar, para que pipeline, LLM e app nunca discordem.

**Critérios de aceite**
1. **Dado** que um limite muda no contrato, **quando** o pipeline roda, **então** a validação dos resumos e as instruções ao LLM usam o novo limite sem outra alteração.
2. **Dado** os limites pedidos ao LLM, **quando** o prompt é montado, **então** eles são derivados dos limites do contrato com uma margem configurável, e não escritos à mão.
3. **Dado** um texto do resumo acima do limite, **quando** é validado, **então** é encurtado no último fim de frase que caiba, sem contar o ponto de abreviações comuns (Dr., Sr., et al., p. ex.); se nenhuma frase couber, no último espaço, com reticências. O card só é descartado se o campo ficar vazio. Cada encurtamento entra no relatório da execução.

### H7 — Operação ajustável sem mexer no código (P2)

Como mantenedor, quero ajustar a operação diária por configuração, para reagir a custo, fontes e qualidade sem alterar o código.

**Critérios de aceite**
1. **Dado** a configuração do pipeline, **quando** ela define modelo do LLM, teto de itens, janelas de tempo por tipo, retenção de dias, faixa de telas dos stories, quantidade de perguntas do quiz e mínimo para publicar, **então** a execução usa esses valores, com os atuais como padrão.
2. **Dado** um valor de configuração inválido, **quando** o pipeline inicia, **então** falha antes de coletar, com uma mensagem que aponta o campo, e o conteúdo anterior continua valendo.
3. **Dado** o mínimo para publicar, **quando** o pipeline decide se publica, **então** considera também a cobertura por grupo de áreas, e não só o total de cards.
4. **Dado** uma execução, **quando** termina, **então** o relatório inclui o custo estimado, comparado com o orçamento mensal configurado; ao passar de um limite configurável, a execução registra um alerta.
5. **Dado** um build do app, **quando** ele é gerado, **então** o endereço do conteúdo vem da configuração do build, e não do código.

### H8 — Textos da interface prontos para tradução (P3)

Como mantenedor, quero os textos da interface num só lugar, para poder traduzir o app no futuro sem procurar strings no código.

**Critérios de aceite**
1. **Dado** um texto visível ao usuário, **quando** ele é exibido, **então** vem de um catálogo de textos, e não está escrito dentro do componente.
2. Plurais e números (dias, cards, minutos) são formatados por funções do catálogo.

## Requisitos funcionais

- **RF-101** (substitui a parte rígida do contrato): o app lê o conteúdo de forma tolerante. Ignora campos desconhecidos, descarta só os cards inválidos ou de tipo desconhecido e aceita qualquer versão secundária da versão principal que suporta.
- **RF-102**: o contrato tem política de versão: acréscimos opcionais mantêm a versão principal; mudanças incompatíveis criam uma versão principal nova, publicada em paralelo durante uma transição.
- **RF-103**: todo dado local tem versão de formato e migração para o formato atual; dado ilegível é preservado à parte, nunca apagado.
- **RF-104** (substitui a tabela de áreas da H3 e o RF-011 da spec 001): o catálogo de áreas, subáreas e grupos, com o peso de cada área, faz parte do conteúdo publicado. Pesos existem só no nível da área (tema principal), nunca na subárea. O app embute uma cópia só para o primeiro acesso sem internet.
- **RF-105** (substitui os números fixos do RF-007, H1-1, H3-4, H5-2, H7-1, H7-3 e H8-1): tamanho do feed, fatia mínima de artigos, pesos das áreas, quantidade de perguntas e de alternativas do quiz e faixa de telas dos stories são parâmetros com valor padrão. Os valores atuais (15 cards, 30%, metade para cada grupo, 3 perguntas, 4 alternativas, 3 a 5 telas) passam a ser só os padrões.
- **RF-106** (substitui a comparação de datas da spec 001): a atualidade do conteúdo é decidida pelo momento de publicação e pelo intervalo esperado entre publicações, com tolerância configurável. Padrão: o app busca conteúdo novo 24 h depois da publicação e só mostra o aviso de conteúdo anterior depois de 30 h (24 h + 6 h de tolerância).
- **RF-107** (substitui o RF-001 da spec 001): o horário-limite de publicação e o fuso de referência do conteúdo são configuração da operação. Hoje: 07:00, America/Sao_Paulo.
- **RF-108** (substitui os números fixos do RF-003 da spec 001): a janela de tempo de cada tipo de conteúdo é configurável, com padrão de 36 h para notícias e 7 dias para artigos.
- **RF-109**: os limites de texto ficam definidos só no contrato; o pipeline deriva deles a validação e as instruções ao LLM. Texto acima do limite é encurtado, não descartado (H6-3).
- **RF-110**: o pipeline lê de configuração validada o modelo do LLM, o teto de itens, a retenção, o mínimo para publicar (total e por grupo) e o orçamento mensal.
- **RF-111**: o endereço do conteúdo é configuração do build do app.
- **RF-112**: os textos e a formatação de números da interface ficam num catálogo único.
- **RF-113**: o app limita os valores publicados que controlam a montagem do feed e o cache: tamanho do feed de 1 a 50, peso de área até 100, intervalo de publicação até 168 h; `generatedAt` no futuro ou inválido conta como desatualizado. Fora do limite, vale o padrão. O alerta de orçamento do pipeline só avisa, não interrompe a execução.

## Requisitos não funcionais

- **RNF-101** (Compatibilidade): um app instalado continua funcionando com o conteúdo publicado por pelo menos 6 meses de evolução do pipeline, desde que não haja mudança de versão principal do contrato.
- **RNF-102** (Segurança dos dados): nenhuma atualização do app apaga dados do usuário sem uma cópia preservada.
- **RNF-103** (Fonte única): cada parâmetro tem um único lugar de definição. Um teste falha se o mesmo valor for declarado em dois lugares que precisam concordar (por exemplo, os limites de texto ou o catálogo embutido no app e a configuração do pipeline).
- **RNF-104** (Diagnóstico): descartes de cards, dados locais ilegíveis e valores de configuração inválidos ficam registrados com o motivo.

## Correções à spec 001

| Item da spec 001 | Problema | Correção nesta spec |
|---|---|---|
| RF-001 "até as 7h (horário de Brasília)" | Horário e fuso tratados como regra | RF-107 |
| RF-003 "24–36 horas" e "7 dias" | Valores fixos e faixa ambígua | RF-108 |
| RF-007 "15 cards", "30%" | Números fixos espalhados | RF-105, H4 |
| RF-011 grupos e 50% | Grupos e pesos fixos no app | RF-104, H3-4 a H3-6: peso por área, grupos só na tela |
| H1-1 "n de 15 vistos" | Assume feed sempre cheio | H4-1 |
| H3 tabela de áreas | Catálogo fixo em três lugares | RF-104 |
| H5-2 "de 3 a 5 telas" | Faixa fixa no contrato e no app | RF-105 |
| H7-1 "3 perguntas (4 alternativas)", H7-3 "0–3" | Números fixos no contrato e no app | RF-105 |
| H8-1 "15 cards, ~10 min" | Mensagem com valores fixos | H4-3 |
| H4-5 + data do conteúdo em Brasília | Fusos diferentes comparados como datas | RF-106, H5 |
| "Decisões tomadas": "dia concluído ao ver todos os cards" | Contradiz a H4 (botão "Concluir o dia") | Vale a regra da H4; a seção passa a remeter a ela |

## Fora de escopo

- Tela para o usuário configurar os pesos por área (os pesos passam a ser parâmetro publicado; a tela fica para uma spec futura).
- Tradução do app para outros idiomas (a H8 só prepara o código para isso).
- Banco de dados com o histórico das publicações capturadas (próxima spec).
- Painel ou serviço remoto de configuração: os parâmetros do app vêm no próprio conteúdo publicado.
- Sincronização de dados entre dispositivos e backup na nuvem.
- Trocar a forma de publicação (GitHub Pages) ou o agendador.

## Decisões tomadas

Respostas do autor em 2026-11-22:

1. **Pesos**: configurados por área (tema principal), não por subárea (H3-4 a H3-6, RF-104).
2. **Atualidade**: busca nova após 24 h; aviso de conteúdo anterior após 30 h (RF-106).
3. **Texto acima do limite**: encurtar, para não perder conteúdo importante (H6-3).
4. **Textos para tradução**: entram nesta spec (H8).

## Histórico

| Data | Mudança | Motivo |
|---|---|---|
| 2026-11-22 | Criação | Revisão do código e das specs: regras fixas que travam a evolução do conteúdo e do app |
| 2026-11-22 | Aprovada; dúvidas resolvidas: peso por área, 24 h + 6 h, encurtar textos longos, H8 entra agora | Respostas do autor |
| 2026-11-24 | H6-3 ignora abreviações ao encurtar; RF-113 limita valores publicados; orçamento só alerta | Review e auditoria da spec 002 (CR-005, SEC-001, SEC-002, SEC-005), decisões do autor |
