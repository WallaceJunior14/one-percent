# Agendador externo do conteúdo diário (ADR 0006)

O cron do GitHub Actions atrasa horas em horários de pico (até 10 h observadas). Um agendador externo dispara o workflow `daily-content.yml` às **05:00 de Brasília em ponto**, pela API do GitHub. Os três horários de cron do próprio GitHub continuam como reserva; como todos usam `--skip-if-published`, o primeiro disparo que rodar publica o dia e os outros terminam sem trabalho nem custo.

Configuração única, feita pelo dono do repositório (envolve credenciais).

## 1. Criar um token restrito no GitHub

Em **GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**:

| Campo | Valor |
|---|---|
| Token name | `one-percent agendador` |
| Expiration | 1 ano (anote a data para renovar) |
| Resource owner | `WallaceJunior14` |
| Repository access | **Only select repositories** → `one-percent` |
| Repository permissions | **Actions: Read and write** (o GitHub adiciona *Metadata: Read-only* sozinho). Nenhuma outra |

**O que esse token permite:** disparar, cancelar e reexecutar workflows **só neste repositório**, e apagar execuções e artefatos dele.
**O que não permite:** ler secrets (como a `ANTHROPIC_API_KEY`), alterar código, mexer em outros repositórios ou na sua conta.
**Se vazar:** revogue na mesma página e gere outro. O pior caso é alguém disparar o pipeline várias vezes; o `--skip-if-published` faz essas execuções terminarem sem chamar o LLM.

Copie o token direto para o próximo passo. Não cole em chats nem em arquivos do repositório.

## 2. (Opcional) Testar o disparo pelo terminal

No PowerShell, com o token só nesta sessão do terminal:

```powershell
$env:GH_DISPATCH_TOKEN = Read-Host -MaskInput "Token"
curl.exe -s -o NUL -w "%{http_code}`n" -X POST `
  -H "Accept: application/vnd.github+json" `
  -H "Authorization: Bearer $env:GH_DISPATCH_TOKEN" `
  -H "X-GitHub-Api-Version: 2022-11-28" `
  https://api.github.com/repos/WallaceJunior14/one-percent/actions/workflows/daily-content.yml/dispatches `
  -d '{"ref":"main","inputs":{"skip_if_published":"true"}}'
Remove-Item Env:GH_DISPATCH_TOKEN
```

A resposta esperada é `204`. Em seguida, aparece uma execução "Daily content" na aba **Actions**.

## 3. Criar o job no cron-job.org

Crie uma conta gratuita em <https://cron-job.org> e, em **Cronjobs → Create cronjob**:

| Aba / campo | Valor |
|---|---|
| **Common → Title** | `one-percent daily content` |
| **Common → URL** | `https://api.github.com/repos/WallaceJunior14/one-percent/actions/workflows/daily-content.yml/dispatches` |
| **Common → Execution schedule** | Every day at **05:00** |
| **Common → Time zone** | `America/Sao_Paulo` |
| **Advanced → Request method** | `POST` |
| **Advanced → Headers** | `Accept: application/vnd.github+json`<br>`Authorization: Bearer <token do passo 1>`<br>`X-GitHub-Api-Version: 2022-11-28`<br>`Content-Type: application/json` |
| **Advanced → Request body** | `{"ref":"main","inputs":{"skip_if_published":"true"}}` |
| **Notifications** | Ativar aviso por e-mail quando a execução falhar |

Use **Test run** para conferir: o cron-job.org deve mostrar a resposta **204 No Content**.

## Manutenção

- **Renovar o token** antes de expirar (o GitHub avisa por e-mail). Depois, atualize o header `Authorization` no cron-job.org.
- **Mudar o horário:** só no cron-job.org; o repositório não precisa mudar.
- **Desligar:** desative o job no cron-job.org. O cron do GitHub continua como reserva.
