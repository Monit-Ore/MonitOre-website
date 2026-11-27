# Dashboard de suporte: guia de leitura

## Em uma frase

O navegador pede uma captura JSON ao Node, o Node lê a captura mais recente do S3 e devolve o conteúdo; o navegador transforma esse conteúdo em KPIs, gráficos e tabela.

## Para a área de negócio

- O dado **não** está mais em um arquivo fixo dentro de `public/`. Ele nasce no ETL, é salvo no S3 na camada Gold e é lido pelo servidor na hora em que a página abre.
- Cada arquivo JSON no prefixo `dashboard-suporte/` é uma "captura". A mais recente é a que aparece na tela.
- A API compara a captura atual com a anterior para mostrar a variação de chamados abertos. Se não houver uma captura comparável, o painel mostra "Sem histórico".
- O navegador nunca recebe credenciais AWS. Ele só conhece o endereço `/suporte/buscar`.

## Mapa de arquivos

### Servidor

| Arquivo | Responsabilidade |
|---|---|
| `app.js` | Carrega `.env.dev` e registra `app.use("/suporte", suporteRouter)` |
| `src/routes/suporte.js` | Define `GET /suporte/buscar` e chama o controller |
| `src/controllers/suporteController.js` | Recebe a requisição, chama o model e traduz erros em status HTTP |
| `src/models/suporteModel.js` | Fala com o S3: configura cliente, lista, lê, valida e compara capturas |
| `.env.example` | Modelo das variáveis `AWS_REGION`, `S3_BUCKET_NAME`, `S3_PREFIX` e `AWS_PROFILE` |

### Navegador

| Arquivo | Responsabilidade |
|---|---|
| `public/dashboard-suporte.html` | Estrutura, IDs e ordem de carregamento dos scripts |
| `public/js/dashboard-suporte.js` | Entrada: prepara a tela, busca a captura e chama cada módulo |
| `public/js/suporte/suporte-api.js` | Único lugar que faz `fetch('/suporte/buscar')` |
| `public/js/suporte/suporte-estado.js` | Um objeto `estado` compartilhado, no lugar de variáveis soltas |
| `public/js/suporte/suporte-formatacao.js` | Funções puras: números, datas, acentos, classes CSS e escape HTML |
| `public/js/suporte/suporte-indicadores.js` | KPIs, SLA, aviso de dados demonstrativos e quebras de SLA |
| `public/js/suporte/suporte-graficos.js` | Criação e destruição dos três gráficos Chart.js |
| `public/js/suporte/suporte-tabela.js` | Filtros, contadores e linhas da tabela de chamados |

## Jornada de um clique

1. A pessoa abre `dashboard-suporte.html`. O Chart.js já foi carregado no `<head>`.
2. O `<script type="module">` do fim do `<body>` carrega `dashboard-suporte.js`, que importa os demais módulos.
3. `dashboard-suporte.js` escuta `DOMContentLoaded`, preenche nome/cargo do usuário e liga os botões de sair e menu.
4. `carregarDashboardSuporte()` chama `prepararEstadoCarregamento()`, que limpa o estado, destrói gráficos antigos e mostra "Carregando...".
5. `suporte-api.js` faz `GET /suporte/buscar`. Se der erro, extrai `mensagem` do corpo JSON.
6. `src/routes/suporte.js` entrega a requisição a `suporteController.buscarCaptura()`.
7. No model, `lerConfiguracao()` valida região e bucket; `criarClienteS3()` cria o `S3Client`.
8. `listarCapturas()` usa `paginateListObjectsV2`, filtra só `.json` e ordena por `LastModified`.
9. `lerCaptura()` baixa o primeiro JSON com `Body.transformToString()` e exige as seções `metadados` e `indicadores`.
10. `buscarCapturaAnterior()` procura uma captura mais antiga comparável para calcular `variacaoChamadosAbertos`.
11. O controller devolve `{ captura, fonte, historico }`. O navegador guarda `captura` e `historico` no `estado`.
12. `suporte-indicadores.js`, `suporte-graficos.js` e `suporte-tabela.js` preenchem KPIs, gráficos e tabela usando o mesmo `estado`.

## Glossário

| Termo | Significado simples |
|---|---|
| Bucket | Pasta raiz no S3 |
| Prefixo | "caminho" dentro do bucket; aqui, `dashboard-suporte/` |
| Captura | Um arquivo JSON com um retrato do suporte naquele momento |
| `LastModified` | Data em que o arquivo foi gravado; define qual captura é a mais recente |
| Gold | Camada final do ETL, já agregada e pronta para o dashboard |
| SLA | Prazo combinado de atendimento; "em risco" é perto de vencer |
| ETL | Processo que extrai do JIRA, limpa e grava o JSON no S3 |

## Onde mexer para...

| Objetivo | Arquivo / função |
|---|---|
| Trocar bucket, região ou prefixo | `.env.dev` (local, não versionado) e `.env.example` (modelo) |
| Trocar a meta padrão antes da resposta chegar | `metaSla` em `suporte-estado.js` |
| Trocar a regra de risco da tabela | `estaEmRisco()` em `suporte-formatacao.js` |
| Mudar o texto "na amostra" / "na captura" | `atualizarContagemFiltros()` em `suporte-tabela.js` e `atualizarDescricaoChamados()` em `suporte-indicadores.js` |
| Mudar cores dos gráficos | `suporte-graficos.js`; cores gerais em `public/css/dashboard-suporte.css` |
| Adicionar uma coluna na tabela | `<thead>` no HTML + `desenharTabela()` em `suporte-tabela.js` + ajustar o `colspan` |
| Adicionar um novo KPI | HTML + `mostrarIndicadores()` em `suporte-indicadores.js` |

## Erros que podem aparecer

| Situação | Resposta da API | Mensagem no painel |
|---|---|---|
| Falta `AWS_REGION` ou `S3_BUCKET_NAME` | 500 | "O servidor não está configurado para acessar o S3." |
| Nenhum JSON no prefixo | 404 | "Nenhuma captura de dashboard de suporte..." |
| JSON inválido ou sem `metadados`/`indicadores` | 502 | "A captura mais recente no S3 não contém um JSON válido." |
| Acesso negado ou bucket inexistente | 502 | Mensagem específica de leitura do S3 |
| Erro não previsto | 500 | "Erro interno ao buscar a captura de suporte." |

A tradução de `SyntaxError` e `TypeError` para mensagens amigáveis fica em `mensagemDoErro()` no `suporte-api.js`.

## Pontos preservados de propósito

- O KPI mostra "próximas 24 horas" usando `sla_vencem_proxima24horas`, do JSON. A tabela considera "em risco" somente até 4 horas em `estaEmRisco()`. As duas regras convivem e estão explicadas nos comentários.
- O botão "Só alta e crítica" mantém seu estado apertado após um novo carregamento, enquanto o gráfico volta a mostrar a equipe completa. Isso já acontecia antes da refatoração.
- O endereço `/suporte/buscar`, a forma da resposta, os IDs do HTML, as cores e a meta de 95% não mudaram.

## Verificação manual

```bash
node --check app.js src/routes/suporte.js src/controllers/suporteController.js src/models/suporteModel.js
for arquivo in public/js/suporte/*.js public/js/dashboard-suporte.js; do node --input-type=module --check < "$arquivo"; done
npm start
```

Com `.env.dev` preenchido, conferir `curl http://localhost:<APP_PORT>/suporte/buscar`. No navegador: KPIs, três gráficos, filtros de chamados, quebras de SLA, botões de atenção e dois recarregamentos seguidos sem duplicar gráficos ou eventos.
