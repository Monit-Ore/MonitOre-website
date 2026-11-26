# AJUSTES.md

Como usar: uma sessão por bloco da seção "Ordem de execução". Comece sempre no modo plan (liste arquivos que vai alterar e como vai verificar, sem escrever código). Depois de aprovado, implemente, verifique exatamente como descrito em "Como verificar", marque o item com [x] e faça um commit por ajuste. Se algo estiver ambíguo, pare e pergunte. Não corrija as "Lacunas conhecidas" do AGENTS.md fora do que o item pede. A dependência `@aws-sdk/client-s3` está autorizada para o app Node; qualquer outra, avise antes.

---

## Decisões de design (valem para todos os itens)

### Buckets e chaves (S3)

Um bucket por camada, nomes vindos de variáveis de ambiente: `S3_BUCKET_BRONZE`, `S3_BUCKET_SILVER`, `S3_BUCKET_GOLD`, mais `AWS_REGION`. Buckets separados evitam que uma Lambda grave um arquivo que dispara ela mesma em loop.

Padrão de chave (mesmo em todas as camadas, só muda a extensão e o sufixo de tipo):

```
{hostname}/{AAAA}/{MM}/{DD}/{hostname}_{AAAAMMDD-HHMMSS}[_tipo].{ext}
```

- Data e hora sempre em UTC no nome do arquivo; a conversão para America/Sao_Paulo é só na exibição.
- Bronze e silver: dois arquivos por captura, com sufixo `_hardware` e `_processos` (CSV).
- Gold: um JSON por captura (`{hostname}_{AAAAMMDD-HHMMSS}.json`) e, além dele, `{hostname}/latest.json`, sobrescrito a cada captura.
- Motivo: o prefixo por hostname e data permite listar só o intervalo pedido, e o `latest.json` dá o último registro de uma torre com uma única leitura, sem listar nada.

### Contrato do JSON da gold

Antes de qualquer código, o agente deve ler um JSON real de exemplo da gold (pedir ao usuário que coloque um em `docs/exemplos/` se não existir) e não inventar campos. O app precisa, no mínimo: hostname, data/hora da captura (ISO 8601 UTC) e a lista de componentes com valor e status. Se o JSON atual não tiver isso, o ajuste vai para o `tratamento.py` (Ajuste 4).

### Regra do status da torre

Pior status entre os componentes do último registro: crítico > alerta > normal. Sem registro encontrado: "sem dados". Usar os valores de status exatamente como aparecem no JSON.

### Credenciais

Nunca no código, no repositório nem em prompt. Em produção, role IAM; local, perfil AWS ou variáveis de ambiente. Em container, injetar as variáveis (o `.dockerignore` exclui `.env*`).

---

## Ordem de execução

| Sessão | Itens | Resultado |
|---|---|---|
| A | [x] Ajuste 2 | Torre ligada ao hostname e módulo de leitura do S3 |
| B | Ajuste 1 | Status real na seleção de torres |
| C | Ajuste 3 | Filtro por intervalo na dashboard da torre |
| D | Ajuste 4 (captura) | `captura.py` envia para a bronze |
| E | Ajuste 4 (limpeza + tratamento) | Bronze → silver → gold |
| F | Ajuste 4 (infra) + teste ponta a ponta | Gatilhos configurados e fluxo completo |

Para desenvolver A, B e C sem esperar o pipeline, suba manualmente 2 ou 3 JSONs de exemplo para o bucket gold no layout acima.

---

## Ajuste 2 — Vincular dados a uma torre específica pelo hostname (P0)

- **Hoje:** os dados da captura não estão associados a uma torre específica.
- **Esperado:** cada torre tem um hostname; os dados de uma captura só aparecem na torre cujo hostname seja igual ao hostname da captura.
- **Onde mexer:** `src/database/script-tabelas.sql` (verificar se a tabela da torre já tem hostname; se não, adicionar a coluna e um script de ajuste para bancos existentes), model e controller de torres, novo módulo `src/services/` para o S3 (leitura do gold: `latest.json` de um hostname e listagem/leitura por intervalo).
- **Regras:** o módulo S3 não monta chave à mão em vários lugares; uma função única gera o prefixo a partir de hostname e data. Os endpoints novos recebem `fkEmpresa` e filtram a torre por empresa na consulta SQL. Seguir o padrão atual: SQL cru com `mysql.escape()`, erros `{ mensagem: "..." }` em português.
- **Como verificar:** com um JSON de exemplo no gold, chamar uma função/endpoint de teste que, dado o id de uma torre, devolve o conteúdo do `latest.json` do hostname dela; trocar o hostname da torre e confirmar que passa a devolver outro conjunto (ou "sem dados").
- **Fora do escopo:** autenticação, telas.

## Ajuste 1 — Status da torre vindo do último registro (P0)

- **Hoje:** a página de seleção de torres exibe um status derivado de `id % 3` / `id % 2` (`mapearStatusExibicao`), sem relação com os dados reais.
- **Esperado:** o status de cada torre vem do `latest.json` da gold daquela torre, pela regra de status acima. A página faz uma requisição por torre (em paralelo) e preenche cada card conforme a resposta chega; uma torre lenta ou sem dados não trava as outras.
- **Onde mexer:** nova rota `GET /torres/:idTorre/status?fkEmpresa=` (routes → controller → service S3), JS da página de seleção de torres em `public/js/` (localizar o arquivo certo), `torresController`.
- **Regras:** esta é a decisão de produto que autoriza substituir `mapearStatusExibicao` apenas no fluxo da seleção de torres. Resposta sugerida: `{ status, capturadoEm }`. Falha de leitura no S3 devolve "sem dados" para aquela torre, não erro geral.
- **Como verificar:** `curl "http://localhost:$APP_PORT/torres/1/status?fkEmpresa=1"` com três JSONs de exemplo (um só com componentes normais, um com alerta, um com crítico) e confirmar os três status; abrir a página de seleção e ver os cards com status diferentes; torre sem arquivo no S3 aparece como "sem dados".
- **Fora do escopo:** dashboard da torre, visão executiva.

## Ajuste 3 — Filtro dinâmico e escalável na dashboard da torre (P1)

- **Hoje:** o filtro da dashboard de torre específica não busca por intervalo de tempo.
- **Esperado:** ao aplicar o filtro, o front envia o intervalo e o backend busca no S3 apenas os registros daquele intervalo, agrega quando necessário e devolve já tratado. O front só renderiza.
- **Onde mexer:** nova rota `GET /torres/:idTorre/dashboard?fkEmpresa=&inicio=&fim=` (ISO 8601 UTC; o front usa `toISOString()`), service S3 (listagem por prefixos de data), JS da dashboard da torre em `public/js/`.
- **Regras:**
  - Validar `inicio < fim`, datas válidas e um intervalo máximo (sugestão: 31 dias); erro 400 com `{ mensagem }` caso contrário.
  - Listar só os prefixos de dia dentro do intervalo e descartar, pelo timestamp do nome do arquivo, o que ficar fora nas bordas, antes de baixar.
  - Ler os objetos com concorrência limitada (ex.: 10 a 20 em paralelo).
  - Agregar por janelas para limitar a resposta a algo como 200–300 pontos: até 1h dados brutos, até 24h janelas de 5 min, até 7 dias janelas de 1h, acima disso janelas de 1 dia. Por janela: média e máximo de cada métrica, e o pior status. Devolver `granularidade` e, se algo foi cortado, `truncado: true`.
  - Não implementar agora: rollups pré-calculados no gold. Fica como evolução.
- **Como verificar:** com JSONs de exemplo em vários horários, `curl` com um intervalo de 30 min (dados brutos), outro de 2 dias (agregado em 1h) e um inválido (400); na tela, trocar o filtro e ver o gráfico mudar sem recarregar a página.
- **Fora do escopo:** visão executiva (a rota `/dashboard/visao-executiva` continua um problema conhecido à parte).

## Ajuste 4 — Pipeline bronze → silver → gold (P0)

Fluxo: `captura.py` → bucket bronze → Lambda `limpeza.py` → bucket silver → Lambda `tratamento.py` → bucket gold → app.

Localizar onde os scripts Python vivem no repositório antes de planejar. Em cada script, separar a lógica (`processar(bucket, chave)`) do handler da Lambda (`lambda_handler(event, context)`), para poder testar local com arquivos de exemplo. Na Lambda, ler o evento S3 com `urllib.parse.unquote_plus` na chave.

### 4a. captura.py (bronze)
- Depois de gerar os CSVs, enviar para o bucket bronze com a chave do padrão acima, hostname da própria máquina e timestamp UTC. Nunca sobrescrever nome existente.
- Enviar `_processos` primeiro e `_hardware` por último.
- Se o upload falhar, manter o CSV local e tentar de novo na próxima execução; logar o erro, sem derrubar a captura.
- **Verificar:** rodar uma captura e ver os dois objetos no bucket bronze com o nome esperado.

### 4b. limpeza.py (bronze → silver)
- Gatilho: criação de objeto `.csv` na bronze. Lê o CSV (separador `;`), limpa (tipos, nulos, duplicados, valores impossíveis) e grava em silver com a mesma chave. Reprocessar a mesma chave sobrescreve, sem duplicar.
- **Verificar:** rodar local sobre CSVs de exemplo (incluindo um com linhas sujas) e conferir a saída; depois testar a Lambda subindo um CSV na bronze.

### 4c. tratamento.py (silver → gold)
- Gatilho: criação de `_hardware.csv` na silver. Lê também o `_processos.csv` irmão, se já existir; se não existir, segue sem processos e registra em log (limitação conhecida da corrida entre as duas limpezas).
- Identifica torre e mineradora pelo hostname (CADASTRO_TORRES.csv) e aplica os limites de atenção/crítico para classificar cada componente.
- Grava o JSON da captura e atualiza `{hostname}/latest.json` na gold, no contrato definido acima.
- Decisão em aberto: os limites hoje vêm do MySQL; a Lambda precisa de acesso de rede ao banco. Se for inviável, exportar os limites para um arquivo na S3 e ler de lá.
- **Verificar:** rodar local com silver de exemplo e comparar o JSON com o contrato; subir na silver e confirmar o JSON novo e o `latest.json` atualizado na gold.

### 4d. Infra (feita pelo usuário no console, o agente gera o passo a passo ou os comandos de CLI)
- Criar os três buckets; notificações de evento (bronze → Lambda de limpeza, filtro `.csv`; silver → Lambda de tratamento, filtro `_hardware.csv`).
- Uma role por Lambda, com permissão mínima: ler do bucket de origem e escrever no de destino.
- Variáveis de ambiente, memória e timeout de cada Lambda; layer de pandas se for usado.
- **Teste ponta a ponta:** rodar `captura.py` e acompanhar bronze, silver e gold e os logs no CloudWatch; depois abrir a seleção de torres no app e ver o status real.

---

## Ao terminar tudo

Atualizar o AGENTS.md: remover a pegadinha do `mapearStatusExibicao` na parte que foi substituída, documentar o layout do S3, as variáveis novas e as rotas `/torres/:idTorre/status` e `/torres/:idTorre/dashboard`.
