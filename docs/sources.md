# Fontes de conteúdo — verificação (T030, RNF-008)

Verificado em 2026-11-01. Além de status HTTP e número de itens, a verificação mede **quantos itens têm até 36 horas**: um feed pode responder normalmente e estar abandonado (caso do G1 Ciência e Saúde). Cada fonte foi acessada com o User-Agent do projeto (`one-percent-pipeline/0.1 (+https://github.com/WallaceJunior14/one-percent)`).

## Política de uso adotada para todas as fontes

- Acesso **uma vez por dia**, uma conexão por vez, identificado pelo User-Agent.
- O LLM recebe apenas **título + descrição/abstract** fornecidos pela própria fonte (feed ou API).
- O card exibe um **resumo próprio** (até 3 frases) e o **link para o original**. Nunca exibimos o texto integral, imagens ou PDFs hospedados por nós.
- O app não se apresenta como endossado pelas fontes.

## Artigos científicos

| Fonte | Status | Termos | Notas |
|---|---|---|---|
| arXiv API | ✅ Ativa | Metadados (título, abstract, autores) em **CC0**; máx. 1 requisição a cada 3 s, uma conexão; linkar a página do abstract; não hospedar PDFs | [Termos](https://info.arxiv.org/help/api/tou.html) |
| bioRxiv / medRxiv API | ✅ Ativa | Termos de uso da API não documentados na página da API; cada artigo traz o campo `license` | Filtro `?category=` funciona; 30 itens por página |
| Hugging Face Daily Papers | ✅ Ativa | API pública; os artigos são do arXiv (metadados CC0) | Upvotes usados como sinal de popularidade |
| PubMed (E-utilities) | ⏸️ Adiada | Documentação protegida por verificação de navegador; não foi possível confirmar os termos | Não habilitada no MVP; medRxiv cobre artigos de saúde |

## Notícias (RSS)

| Fonte | Feed | Status | Notas |
|---|---|---|---|
| Tecnoblog | `tecnoblog.net/feed/` | ✅ 50 itens | |
| TechCrunch (IA) | `techcrunch.com/category/artificial-intelligence/feed/` | ✅ 20 itens | Em inglês |
| Ars Technica | `feeds.arstechnica.com/arstechnica/index` | ✅ 20 itens | Em inglês |
| Agência Brasil — Economia | `agenciabrasil.ebc.com.br/rss/economia/feed.xml` | ✅ 10 itens | Site diz "todos os direitos reservados"; página de termos retornou 404 |
| Agência Brasil — Internacional | `agenciabrasil.ebc.com.br/rss/internacional/feed.xml` | ✅ 10 itens | Idem |
| Agência Brasil — Saúde | `agenciabrasil.ebc.com.br/rss/saude/feed.xml` | ✅ 10 itens | Idem |
| InfoMoney | `infomoney.com.br/feed/` | ✅ 10 itens | |
| Money Times | `moneytimes.com.br/feed/` | ✅ 10 itens | |
| Drauzio Varella | `drauziovarella.uol.com.br/feed/` | ✅ 30 itens (5 nas últimas 36h) | Cobre nutrição e saúde mental |
| Medical Xpress | `medicalxpress.com/rss-feed/` | ✅ 30 itens (30 nas últimas 36h) | Em inglês |
| ScienceDaily — Health | `sciencedaily.com/rss/health_medicine.xml` | ✅ 60 itens (4 nas últimas 36h) | Em inglês |
| Agência Fiocruz | `agencia.fiocruz.br/rss.xml` | ✅ 10 itens | |
| G1 Tecnologia / Economia | `g1.globo.com/rss/g1/tecnologia/`, `/economia/` | ❌ Excluída | Feeds responderam vazios (0 itens) |
| G1 Ciência e Saúde / Bem Estar | `g1.globo.com/rss/g1/ciencia-e-saude/`, `/bemestar/` | ❌ Excluída | Feeds desatualizados: item mais recente com ~2 anos / ~3 dias |
| Ministério da Saúde (gov.br) | `gov.br/saude/.../noticias/RSS` | ❌ Excluída | Item mais recente com ~4 meses |
| Hacker News API | `hacker-news.firebaseio.com` | ⏸️ Adiada | Itens só têm título e link, sem descrição para resumir |

## Riscos residuais

- Os termos de uso dos veículos de notícia (Tecnoblog, TechCrunch, Ars Technica, InfoMoney, Money Times, Agência Brasil, Drauzio Varella, Medical Xpress, ScienceDaily) **não foram verificados individualmente**. O uso adotado é o de um leitor de feeds (manchete + resumo próprio + link), comum e de baixo risco para uso pessoal. **Antes de distribuir o app publicamente** (ex.: Play Store), revisar os termos de cada veículo ou pedir autorização.
- Fontes podem mudar o formato ou sair do ar; o pipeline tolera falha de fontes individuais (T035).
