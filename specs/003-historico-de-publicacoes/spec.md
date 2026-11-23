# Spec 003 — Histórico das publicações capturadas

- **Status**: Rascunho
- **Criada em**: 2026-11-22
- **Depende de**: [Spec 002](../002-regras-configuraveis/spec.md) (implementada antes desta)

## Contexto e problema

Hoje o projeto não tem banco de dados. A cada execução, o pipeline coleta os itens das fontes, filtra pela janela de tempo, deduplica, ranqueia, pede os resumos ao LLM, monta os cards e publica `latest.json` e o arquivo do dia. Só os **últimos 7 dias** publicados ficam disponíveis; os mais antigos são apagados a cada publicação. O relatório da execução (contagens, fontes que falharam, tokens) aparece apenas no log da execução, que também expira.

Com isso, perdemos:

1. **Tudo o que foi coletado e não selecionado**: itens fora da janela, duplicados, de ranking baixo ou que o LLM não conseguiu resumir. Não há como saber por que um assunto ficou de fora.
2. **Os dias publicados há mais de 7 dias**: não há como rever o que o app mostrou num dia qualquer do mês passado.
3. **Os resumos do LLM como foram gerados**, inclusive os que falharam na validação. Sem eles, a amostra semanal de qualidade ([medição do MVP](../../docs/ops/medicao-mvp.md)) depende do que ainda está publicado, e não dá para comparar modelos ou instruções diferentes sobre os mesmos itens.
4. **O custo real do mês**: a spec 002 (H7-4) estima o custo do mês multiplicando o custo de uma execução; sem histórico, não há soma das execuções reais, nem das repetidas ou das que não publicaram.
5. **A repetição entre dias**: a deduplicação só compara itens da mesma execução. Um artigo científico fica até 7 dias dentro da janela e pode voltar ao feed em dias seguidos.
6. **A possibilidade de reprocessar**: as fontes (feeds RSS, listas diárias) mudam e descartam itens; depois de algumas horas não dá para coletar de novo o mesmo conjunto.

## Objetivo

Guardar, de forma durável, barata e só com conteúdo público, tudo o que cada execução do pipeline coletou, gerou e decidiu, para ter histórico além de 7 dias, evitar repetir conteúdo entre dias, medir custo e qualidade, reprocessar dias e permitir busca no futuro. O histórico é um apoio da operação: o app instalado não depende dele, e uma falha no histórico nunca impede a publicação do dia.

## Histórias de usuário

O "mantenedor" é o autor do projeto, que opera o pipeline. O usuário do app não interage com o histórico nesta spec.

### H1 — Cada execução deixa um registro completo (P1)

Como mantenedor, quero que toda execução do pipeline fique registrada com o que coletou, o que descartou e por quê, o que gerou e o que publicou, para entender cada dia sem depender do log.

**Critérios de aceite**
1. **Dado** uma execução que publica o dia, **quando** ela termina, **então** o histórico tem: todos os itens coletados (inclusive os não selecionados), o motivo de cada item ter ficado de fora (fora da janela, duplicado de outro item, abaixo do ranking, sem resumo, inválido), os resumos do LLM, os cards publicados e o relatório da execução.
2. **Dado** uma execução que não publica (menos cards que o mínimo, configuração inválida, falha do LLM), **quando** ela termina, **então** o registro existe do mesmo jeito, com o estado da execução e o motivo de não ter publicado.
3. **Dado** uma execução pulada porque o dia já estava publicado, **quando** ela termina, **então** fica registrada só com o horário e o estado "pulada".
4. **Dado** um resumo do LLM que falhou na validação ou foi encurtado (spec 002, H6-3), **quando** a execução termina, **então** o histórico guarda a resposta original, o motivo da falha ou do encurtamento e o texto final.
5. **Dado** um item coletado em dias diferentes, **quando** ele é gravado, **então** é reconhecido como o mesmo item (mesma identidade do card) com uma nova ocorrência, e não como um item novo.
6. **Dado** uma execução repetida ou retomada, **quando** grava no histórico, **então** não cria registros duplicados da mesma execução.
7. **Dado** que o conteúdo foi gerado mas a etapa de publicação falhou, **quando** consulto o dia, **então** vejo que ele foi gerado e não chegou ao app; "publicado" só vale depois que o conteúdo ficou disponível para o app.

### H2 — Histórico além de 7 dias (P1)

Como mantenedor, quero recuperar exatamente o que o app mostrou em qualquer dia passado, para conferir qualidade e responder "o que saiu naquele dia?".

**Critérios de aceite**
1. **Dado** um dia publicado há mais de 7 dias, **quando** peço o conteúdo desse dia, **então** recebo o mesmo conteúdo que foi publicado, campo a campo.
2. **Dado** que a publicação continua apagando os dias antigos do endereço público, **quando** um dia sai de lá, **então** ele continua no histórico.
3. **Dado** os dias ainda publicados no momento em que o histórico começa a funcionar, **quando** o histórico é ativado, **então** esses dias são importados como dias publicados, marcados como importados (sem itens coletados nem relatório, que já se perderam).
4. **Dado** um dia publicado, **quando** consulto o histórico, **então** sei qual execução o gerou, a versão do contrato e os parâmetros em vigor (spec 002) naquela execução.

### H3 — Custo e falhas medidos pelo histórico (P1)

Como mantenedor, quero ver o custo real do mês e a saúde das fontes, para controlar o orçamento de US$ 5/mês e agir antes que algo quebre.

**Critérios de aceite**
1. **Dado** as execuções de um mês, **quando** peço o custo do mês, **então** recebo a soma do custo estimado de todas as execuções (publicadas, repetidas, reprocessadas e as que falharam), com tokens de entrada e saída, comparada com o orçamento mensal configurado (spec 002, RF-110).
2. **Dado** que há histórico suficiente no mês, **quando** a execução calcula o alerta de orçamento (spec 002, H7-4), **então** usa o custo acumulado do mês mais a projeção dos dias restantes, e não só o custo de uma execução multiplicado pelos dias do mês.
3. **Dado** uma fonte que falhou, **quando** consulto o histórico, **então** vejo em quais execuções ela falhou, o motivo, e há quantas execuções seguidas está falhando.
4. **Dado** um período, **quando** peço o resumo da operação, **então** vejo por dia: itens coletados por fonte, descartes por motivo, cards por área, encurtamentos de texto e alertas.

### H4 — Não repetir conteúdo de dias anteriores (P2)

Como usuário do app, quero não ver no feed de hoje um conteúdo que já apareceu nos dias anteriores, para que cada dia traga algo novo.

**Critérios de aceite**
1. **Dado** um item que já virou card publicado dentro da janela de repetição configurada, **quando** o pipeline monta o dia, **então** o item fica de fora com o motivo "já publicado em AAAA-MM-DD".
2. **Dado** um item de outra fonte sobre o mesmo assunto de um card publicado nessa janela, **quando** o pipeline monta o dia, **então** ele é tratado como repetido pelas mesmas regras de semelhança já usadas dentro do dia.
3. **Dado** a janela de repetição com valor zero, **quando** o pipeline roda, **então** não há comparação com dias anteriores (comportamento da spec 001).
4. **Dado** que o histórico está indisponível, **quando** o pipeline roda, **então** publica sem a comparação com dias anteriores e registra no relatório que ela não foi feita.
5. **Dado** que a comparação deixa o dia abaixo do mínimo para publicar, **quando** o pipeline decide, **então** segue a regra de mínimo da spec 002 (H7-3), sem exceção nova.

### H5 — Reprocessar um dia a partir do que foi coletado (P2)

Como mantenedor, quero gerar de novo os cards de um dia a partir dos itens guardados, para testar outro modelo, outras instruções ou outros parâmetros sem depender das fontes, que já mudaram.

**Critérios de aceite**
1. **Dado** um dia com itens coletados no histórico, **quando** peço para reprocessá-lo com outros parâmetros, **então** o pipeline refaz as etapas a partir dos itens guardados, sem coletar das fontes, e grava o resultado como uma nova versão daquele dia, sem apagar a original.
2. **Dado** duas versões de um dia, **quando** as comparo, **então** vejo lado a lado os cards de cada uma e o custo de cada uma.
3. **Dado** um reprocessamento, **quando** ele termina, **então** nada é publicado para o app, a não ser que eu peça explicitamente e o dia seja o atual (ver dúvidas). Um dia passado nunca substitui o conteúdo atual do app.
4. **Dado** um reprocessamento, **quando** ele chama o LLM, **então** seu custo entra no custo do mês (H3-1) e respeita o mesmo teto de itens e o mesmo orçamento das execuções diárias.
5. **Dado** os itens guardados, **quando** são reprocessados, **então** recebem o mesmo tratamento de conteúdo não confiável que recebem na coleta (são dados de terceiros, não instruções).

### H6 — Qualidade medida no histórico (P3)

Como mantenedor, quero registrar a avaliação semanal de qualidade junto dos cards avaliados, para acompanhar a meta de no máximo 1 resumo impreciso em 10 ao longo do tempo e por modelo.

**Critérios de aceite**
1. **Dado** um card publicado, **quando** registro a avaliação (preciso ou impreciso, com uma nota), **então** ela fica ligada ao card, ao dia e ao modelo que gerou o resumo.
2. **Dado** avaliações de várias semanas, **quando** peço a taxa de imprecisão, **então** recebo o resultado por semana e por modelo.
3. **Dado** uma semana, **quando** peço uma amostra para avaliar, **então** recebo cards variados (áreas e tipos diferentes) ainda não avaliados.

### H7 — Busca no histórico (P3)

Como mantenedor, quero buscar no histórico por texto, área, fonte e período, para encontrar o que foi coletado ou publicado sobre um assunto.

**Critérios de aceite**
1. **Dado** o histórico, **quando** busco um termo num período, **então** recebo os cards publicados e os itens coletados que o contêm no título ou no resumo, com a data e a fonte.
2. **Dado** um filtro por área, subárea, fonte, tipo (notícia ou artigo) ou situação (publicado ou descartado), **quando** busco, **então** o resultado respeita o filtro.
3. A busca pelo app fica para uma spec futura (ver dúvidas); esta spec só garante que os dados guardados a permitem.

## Requisitos funcionais

- **RF-201**: toda execução do pipeline (diária, repetida, pulada, reprocessamento ou importação) gera um registro com identificador único, horário de início e fim, estado (publicada, gerada e não publicada, não publicada, pulada, falhou) e motivo.
- **RF-202**: o histórico guarda cada item coletado com os dados normalizados que o pipeline já usa (fonte, tipo, área, subárea, título, link canônico, data de publicação, resumo ou abstract da fonte, autores, veículo, sinais de ranking) e a decisão tomada sobre ele em cada execução, com o motivo do descarte.
- **RF-203**: a identidade de um item no histórico é a mesma identidade estável do card; ocorrências do mesmo item em execuções diferentes ficam ligadas a ele.
- **RF-204**: o histórico guarda, para cada resumo pedido ao LLM: o item de origem, o modelo, a versão das instruções, a resposta recebida, o resultado da validação, os encurtamentos aplicados e os tokens usados.
- **RF-205**: o histórico guarda cada dia publicado exatamente como foi publicado, com a versão do contrato, e liga cada card ao item e ao resumo de origem.
- **RF-206**: o relatório de cada execução fica no histórico: contagens por etapa (coletados, na janela, únicos, selecionados, resumidos, cards), descartes por motivo, fontes que falharam e por quê, tentativas repetidas, tokens de entrada e saída, custo estimado, encurtamentos e alertas.
- **RF-207**: cada execução guarda uma cópia dos parâmetros em vigor (spec 002) e da versão do pipeline, para que qualquer dia possa ser entendido e reprocessado com os valores da época.
- **RF-208**: o histórico permite consultar: conteúdo de um dia, custo de um período, falhas por fonte, resumo da operação de um período e versões de um dia.
- **RF-209**: o pipeline compara os itens do dia com os cards publicados dentro de uma janela de repetição configurável (H4); zero desliga a comparação.
- **RF-210**: um dia pode ser reprocessado a partir dos itens guardados (H5); cada reprocessamento gera uma nova versão do dia, sem sobrescrever as anteriores.
- **RF-211**: os dias ainda publicados quando o histórico for ativado são importados uma única vez, marcados como importados (H2-3). Importar de novo não duplica.
- **RF-212**: a avaliação de qualidade de um card pode ser registrada e consultada por semana e por modelo (H6).
- **RF-213**: o histórico pode ser buscado por texto, área, subárea, fonte, tipo, situação e período (H7).
- **RF-214**: o histórico inteiro pode ser exportado num formato aberto e legível, sem depender do serviço onde estiver guardado.

## Requisitos não funcionais

- **RNF-201** (Custo): guardar e consultar o histórico não pode tirar o projeto do orçamento total de **US$ 5/mês** (spec 001, RNF-005), que inclui o LLM. Meta: custo zero de armazenamento, dentro de cotas gratuitas, e nunca mais que US$ 1/mês. O histórico não faz chamadas extras ao LLM; só reprocessamentos pedidos pelo mantenedor geram custo de LLM, contado no mês (H5-4).
- **RNF-202** (Limites de cota): se o histórico depender de uma cota gratuita, o relatório da execução mostra o uso em relação ao limite e registra alerta ao passar de uma fração configurável. Chegar ao limite nunca pode gerar cobrança automática nem impedir a publicação do dia.
- **RNF-203** (Volume): o histórico deve suportar pelo menos 3 anos de execuções diárias no volume atual (algumas centenas de itens coletados por execução, até 3 execuções por dia) sem ultrapassar o limite de custo do RNF-201.
- **RNF-204** (Privacidade): o histórico guarda só conteúdo público coletado das fontes e dados da operação. Nenhum dado de usuário do app (preferências, progresso, identificadores de aparelho, uso) é enviado ou guardado; o app continua sem enviar nada (spec 001, RNF-004).
- **RNF-205** (Segredos): nenhum segredo (chave do LLM, credencial de acesso ao histórico) aparece em registros, relatórios ou parâmetros guardados. A credencial de escrita no histórico segue as mesmas regras das demais credenciais da operação ([ADR 0005](../../docs/adr/0005-chave-de-api-no-github-actions.md)).
- **RNF-206** (Respeito às fontes): o histórico guarda só o que o pipeline já coleta (título, resumo ou abstract, metadados e link), nunca o texto integral das fontes, e não é republicado em lugar nenhum (spec 001, RNF-008). [PRECISA ESCLARECER: o histórico pode ficar público ou precisa ser privado?]
- **RNF-207** (Publicação primeiro): uma falha ao ler ou gravar o histórico nunca impede nem atrasa além do horário-limite (spec 002, RF-107) a publicação do dia. A falha entra no relatório e gera alerta; os dias publicados nesse período podem ser recuperados depois pela importação (RF-211) enquanto ainda estiverem no endereço público.
- **RNF-208** (Retenção): cada tipo de registro tem um prazo de retenção configurável. Proposta de padrão: dias publicados, resumos dos cards publicados, relatórios de execução e avaliações sem prazo (volume pequeno); itens coletados e não publicados e respostas do LLM que não viraram card por [PRECISA ESCLARECER: prazo, proposta de 180 dias]. Itens apagados pela retenção não quebram a ligação dos cards publicados com seus dados de origem.
- **RNF-209** (Formato versionado): o formato dos registros tem versão. Registros gravados por versões anteriores do pipeline continuam legíveis ou são convertidos sem perda, como os dados locais do app (spec 002, RF-103).
- **RNF-210** (Integridade): só o pipeline e o mantenedor escrevem no histórico; uma execução nunca apaga ou altera registros de outra execução, exceto pela retenção (RNF-208).
- **RNF-211** (Testabilidade): o pipeline continua testável sem acesso ao histórico real, com um substituto local nos testes, como já acontece com as fontes e o LLM.

## Relação com a spec 002

A spec 002 separa regras de parâmetros e torna o contrato tolerante a versões. Esta spec segue as mesmas regras:

| Ponto | Como esta spec respeita a 002 |
|---|---|
| Nenhuma regra fixa nova | Janela de repetição (RF-209), prazos de retenção (RNF-208), alerta de cota (RNF-202) e opções de reprocessamento são parâmetros, no mesmo lugar único de configuração da 002 (RNF-103), com padrão e validação na partida (H7-2 da 002) |
| App instalado não quebra | O app não lê o histórico. O conteúdo publicado não muda de formato por causa desta spec; se algum dado do histórico for publicado no futuro, entra como campo opcional (RF-102 da 002), sem mudar a versão principal |
| Mínimo para publicar e cobertura por grupo | A comparação com dias anteriores (H4) só remove candidatos; a decisão de publicar continua sendo a da 002 (H7-3) |
| Relatório e orçamento | O relatório da 002 (custo estimado, encurtamentos, alerta) passa a ser guardado (RF-206), e o alerta mensal passa a usar o custo acumulado quando houver histórico (H3-2) |
| Contrato e parâmetros versionados | Cada execução guarda a versão do contrato e os parâmetros da época (RF-207), o que torna os reprocessamentos comparáveis |
| Dados versionados | O formato do histórico tem versão e migração sem perda (RNF-209), como o RF-103 da 002 faz com os dados locais |

## Fora de escopo

- O app consultar o histórico (busca de dias anteriores, "ver mais" de uma área). Fica para uma spec futura, que precisaria rever o [ADR 0001](../../docs/adr/0001-conteudo-estatico-diario.md) (sem servidor). Ver dúvidas.
- Qualquer dado de usuários do app, métrica de uso ou telemetria.
- Painel visual para o mantenedor: nesta spec, as consultas e o resumo da operação podem ser comandos ou relatórios gerados.
- Guardar o texto integral das fontes ou os PDFs dos artigos.
- Trocar a forma de publicação do app: o endereço público continua sendo a fonte do app, com a retenção de dias que a 002 configura.
- Recuperar itens coletados ou relatórios de antes da ativação do histórico (já foram perdidos).
- Republicar dias passados para o app.

## Dúvidas em aberto

- [PRECISA ESCLARECER: onde hospedar o histórico. As opções vão para o plan, mas a decisão depende de duas respostas: ele pode ficar junto do repositório do projeto ou precisa ser um serviço à parte? Pode ser público ou precisa ser privado (RNF-206)? O repositório `one-percent` é público hoje, então guardar o histórico dentro dele o torna público. Proposta: privado, porque reúne resumos e abstracts de terceiros em volume.]
- [PRECISA ESCLARECER: o app vai consultar o histórico um dia? Proposta: não nesta spec; só o pipeline e o mantenedor. Se a resposta for "sim, em breve", o plan precisa evitar escolhas que impeçam uma leitura pública somente de cards publicados.]
- [PRECISA ESCLARECER: janela de repetição padrão (H4). Proposta: 7 dias, que cobre a janela de artigos científicos, onde a repetição é mais provável. A comparação entra ligada ou desligada (zero) no início?]
- [PRECISA ESCLARECER: prazo de retenção dos itens coletados e não publicados (RNF-208). Proposta: 180 dias, o bastante para reprocessar e medir qualidade de um semestre.]
- [PRECISA ESCLARECER: reprocessar pode republicar o dia atual para o app (H5-3)? Proposta: sim, só o dia atual e só com pedido explícito, passando pelas mesmas validações e pelo mínimo para publicar.]
- [PRECISA ESCLARECER: a avaliação semanal de qualidade (H6) passa a ser registrada no histórico, substituindo a tabela de `docs/ops/medicao-mvp.md`, ou a tabela continua e o histórico só a complementa?]

## Como saber que funcionou

- Depois de 30 dias de operação, o mantenedor consegue: abrir qualquer um desses dias como foi publicado; dizer o custo real do mês; listar as fontes que mais falharam; explicar por que um item coletado não virou card.
- Nenhum card repete um card dos 7 dias anteriores (com a janela padrão ligada).
- O custo total do projeto no mês continua abaixo de US$ 5, e o do histórico abaixo de US$ 1.
- Nenhuma publicação diária falhou ou atrasou por causa do histórico.

## Histórico

| Data | Mudança | Motivo |
|---|---|---|
| 2026-11-22 | Criação (rascunho) | Pedido do autor: guardar as publicações capturadas pelo pipeline, depois da spec 002 |
