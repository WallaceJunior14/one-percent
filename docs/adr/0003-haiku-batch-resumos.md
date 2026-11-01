# ADR 0003 — Claude Haiku 5.5 com Batch API para gerar os cards

- **Status**: Aceito
- **Data**: 2026-10-31

## Contexto

Todo dia ~70 itens (notícias e artigos) precisam virar cards em português, com resumo, "por que importa", campos de artigo científico e uma pergunta de quiz. O orçamento é de até US$ 5/mês (RNF-005) e o pipeline roda de madrugada, sem pressa de latência.

## Decisão

Usar **Claude Haiku 5.5** (`claude-haiku-5-5`) pela **Batch API**, com **saída estruturada por JSON Schema** e teto de tokens por execução. O LLM recebe apenas título + resumo/abstract de cada item.

## Alternativas consideradas

Preços de referência em 2026-10 (por milhão de tokens, entrada/saída); estimativa de ~70 mil tokens de entrada e ~35 mil de saída por dia.

| Opção | Custo/mês estimado | Prós | Contras |
|---|---|---|---|
| Haiku 5.5 + Batch (escolhida) | ≈ US$ 0,40 | Cabe com folga no orçamento | Menor capacidade de síntese que modelos maiores |
| Haiku 5.5 síncrono | ≈ US$ 0,75 | Mais simples (sem polling) | Dobro do custo, sem benefício de latência |
| Sonnet 5.5 | ≈ US$ 15 | Resumos melhores em textos técnicos | Estoura o orçamento |
| Opus 5.5 | ≈ US$ 30+ | Máxima qualidade | Estoura muito o orçamento |

## Consequências

- **Positivas**: custo desprezível; a mesma porta `Summarizer` permite trocar de modelo por configuração.
- **Negativas / custos**: a qualidade dos resumos precisa ser acompanhada (métrica da spec: ≤ 1 card impreciso em 10 por semana). Se falhar, a primeira alternativa é usar Sonnet 5.5 só nos artigos científicos, revendo o orçamento.
- **O que fica mais difícil de mudar depois**: pouco; o modelo é um parâmetro de configuração.
