# ADR 0005 — Chave de API em *Actions secrets* (substitui o ADR 0004)

- **Status**: Aceito
- **Data**: 2026-11-13
- **Substitui**: [ADR 0004](./0004-federacao-de-identidade.md)

## Contexto

O ADR 0004 adotou federação de identidade (WIF) para o GitHub Actions. Na prática, as três execuções de teste falharam na troca do token (`401`), por diferenças entre a regra criada pelo assistente do Console e os claims enviados pelo GitHub (subject com IDs imutáveis, `repository` e `repository_owner` no formato errado). Depois dos ajustes ainda houve falha, e o pipeline ficou uma semana sem publicar. O autor decidiu priorizar a simplicidade.

## Decisão

O workflow `daily-content.yml` autentica com uma **chave de API** guardada no secret `ANTHROPIC_API_KEY` do repositório. A chave só é exposta aos passos que precisam dela (verificação e geração), nunca ao job inteiro.

Boas práticas adotadas:
- Chave criada em *Settings → API keys* do Console, vinculada a uma **conta de serviço** (não pessoal) e restrita a **um workspace**.
- **Expiração** definida na criação (ex.: 90 dias), com rotação antes do vencimento.
- Cadastro do secret feito pelo próprio autor, direto no GitHub; a chave nunca passa por chat, código ou logs.
- Secrets do GitHub não são entregues a workflows disparados por pull requests de forks.

## Alternativas consideradas

| Opção | Prós | Contras |
|---|---|---|
| Chave em *Actions secrets* (escolhida) | Simples; funciona de imediato | Segredo de longa duração; exige rotação manual |
| Federação de identidade (ADR 0004) | Nenhum segredo fixo | Configuração sensível a detalhes dos claims; não funcionou nas tentativas |

## Consequências

- **Positivas**: autenticação simples e previsível; o código Python não mudou (`anthropic.Anthropic()` lê `ANTHROPIC_API_KEY`).
- **Negativas / custos**: rotação periódica da chave; se ela vazar, revogar imediatamente no Console e cadastrar outra.
- **Volta para a federação**: possível no futuro sem mudar o código; a configuração e os aprendizados estão no ADR 0004. As *variables* de federação do repositório ficam sem uso e podem ser apagadas.
