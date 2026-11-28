# Documentação da Dashboard Preditiva (Beeling) - Isaac

Este documento descreve a implementação da dashboard preditiva dinâmica (`dashboard-processos`), a estrutura para recebimento e ingestão de dados tratados em formato **JSON** vindos da **EC2 / Bucket S3 Gold**, os endpoints da API, variáveis de ambiente, instruções para execução local e o fluxo de migração para nuvem.

---

## 1. Arquitetura do Pipeline de Dados e Ingestão Gold

```
[ PCs Industriais das Torres ]
             │
             ▼ (Captura a cada ~11s)
   [ AWS S3 - Camada Bronze ] (CSVs Brutos)
             │
             ▼
   [ Instância EC2 / Tratamento Python ]
             │
             ▼ (Limpeza, normalização e agregação)
   [ AWS S3 - Camada Gold ] (Dados Tratados em JSON)
             │
    ┌────────┴─────────────────────────────────┐
    ▼                                          ▼
[ Ingestão Webhook / HTTP POST ]     [ Sincronização / Pasta Gold ]
(POST /preditiva/ingestao)            (PREDITIVA_PASTA_GOLD ou fixtures/gold)
    │                                          │
    └──────────────────┬───────────────────────┘
                       ▼
         [ preditivaMetricasModel-isaac ]
                       │
                       ▼ (Apenas com dados Gold prontos)
        [ preditivaController-isaac ]
        [ agregacaoService-isaac ]
        [ previsaoService-isaac ]
                       │
                       ▼
       [ Frontend: dashboard-processos.html / dashboard-isaac.js ]
       (Gráficos, KPIs, Projeções e Tabela de Processos)
```

### Regra de Negócio:
A dashboard preditiva **só aplica seus gráficos, KPIs e projeções após a chegada dos dados tratados em formato JSON vindos da EC2 (camada Gold)**.
- Se os dados da camada Gold ainda não foram tratados ou não chegaram para a torre selecionada, a API responde com status 200 e payload contendo `{ semDados: true, aguardandoGold: true }`.
- O frontend (`dashboard-isaac.js`) detecta esse estado e exibe o banner informativo: *"Aguardando Camada Gold (EC2) - Aguardando tratamento dos dados vindos da EC2 (Bucket Gold) em formato JSON para aplicar os gráficos e projeções da dashboard."*, garantindo estabilidade e integridade dos dados visuais.

---

## 2. Formato dos Dados Tratados em JSON (Camada Gold)

O payload enviado pela EC2 pode ser entregue via requisição HTTP POST ou colocado em arquivo `.json` no bucket/pasta Gold. O sistema suporta tanto a convenção *camelCase* quanto *UPPER_CASE*.

### Schema de Exemplo (JSON Unificado ou Ingestão POST)
```json
{
  "origem": "EC2-TRATAMENTO-GOLD",
  "timestamp": "2026-11-24T12:00:00.000Z",
  "hardware": [
    {
      "rodada": 1,
      "hostname": "PC-VALE-01",
      "dataHora": "2026-11-24T12:00:00.000Z",
      "cpuTotalPct": 68.4,
      "ramTotalPct": 78.5,
      "ramTotalMb": 12560,
      "discoTotalPct": 54.2,
      "qtdProcessos": 142
    }
  ],
  "processos": [
    {
      "rodada": 1,
      "hostname": "PC-VALE-01",
      "dataHora": "2026-11-24T12:00:00.000Z",
      "pid": 3042,
      "processo": "java-extracao",
      "procCpuAbsolutaPct": 35.2,
      "procCpuGlobalPct": 18.4,
      "procRamPct": 12.0,
      "procRamMb": 1960
    },
    {
      "rodada": 1,
      "hostname": "PC-VALE-01",
      "dataHora": "2026-11-24T12:00:00.000Z",
      "pid": 1102,
      "processo": "mysqld",
      "procCpuAbsolutaPct": 28.0,
      "procCpuGlobalPct": 14.2,
      "procRamPct": 10.5,
      "procRamMb": 1720
    }
  ]
}
```

---

## 3. Endpoints da API

### A) Ingestão de Dados Tratados da Camada Gold
* **Método**: `POST`
* **Rotas**: `/preditiva/ingestao` ou `/preditiva/gold`
* **Corpo (JSON)**: Objeto com `{ hardware: [...], processos: [...] }` ou array direto de métricas.
* **Resposta de Sucesso (201 Created)**:
```json
{
  "sucesso": true,
  "mensagem": "Dados tratados da camada Gold (JSON) recebidos com sucesso. A dashboard preditiva agora exibirá os gráficos atualizados.",
  "detalhes": {
    "sucesso": true,
    "totalHardware": 144,
    "totalProcessos": 450,
    "atualizadoEm": "2026-11-24T12:15:00.000Z"
  }
}
```

### B) Consulta para a Dashboard
* **Método**: `GET`
* **Rota**: `/preditiva/:idTorre?historico=24h|12h|6h&horizonte=2h|6h|24h&idUsuario=1`
* **Respostas**:
  * **200 OK (com dados)**: Retorna estrutura completa com `torre`, `kpis`, `saturacao`, `series` e `processos`.
  * **200 OK (aguardando Gold)**: Retorna `{ semDados: true, aguardandoGold: true, mensagem: "..." }`.
  * **400 Bad Request**: Parâmetro inválido (idTorre não inteiro, parâmetros fora do padrão).
  * **403 Forbidden**: Usuário sem permissão (verificado na tabela `permissionamento` ou `Administrador`).
  * **404 Not Found**: Torre ou PC Industrial inexistente.

---

## 4. Variáveis de Ambiente

Configure no arquivo `.env` (ou `.env.dev`):

| Variável | Descrição | Padrão / Exemplo |
| :--- | :--- | :--- |
| `PREDITIVA_FONTE` | Fonte da telemetria Gold (`s3` ou `local`) | `s3` em produção, `local` em dev |
| `PREDITIVA_PASTA_GOLD` | Caminho local para JSON Gold (modo local) | `./fixtures/gold-dev` |
| `S3_BUCKET_OURO` | Bucket S3 da camada Gold (modo s3) | *(obrigatório no modo s3)* |
| `S3_PREFIXO_OURO` | Prefixo do objeto no bucket; alinhado ao ETL | `ouro/` |
| `AWS_REGION` | Região AWS do bucket | `us-east-1` |
| `DB_HOST` | Host do banco de dados MySQL | `localhost` |
| `DB_PORT` | Porta do banco de dados MySQL | `3306` |
| `DB_DATABASE` | Nome do schema do banco | `monitore` |
| `DB_USER` | Usuário do MySQL | `root` |
| `DB_PASSWORD` | Senha do MySQL | *(definir no .env local)* |

---

## 5. Como Testar e Executar

1. **Executar a suíte de testes unitários e de ingestão Gold JSON:**
   ```bash
   node test/preditivaServices-isaac.test.js
   ```

2. **Simular ingestão manual via curl ou Postman:**
   ```bash
   curl -X POST http://localhost:3333/preditiva/ingestao \
     -H "Content-Type: application/json" \
     -d @fixtures/gold/telemetria_gold.json
   ```

3. **Iniciar a aplicação web:**
   ```bash
   node app.js
   ```
   Abra no navegador: `http://localhost:3333/dashboard-processos.html`.

---

## 6. O que Falta para Migrar para o AWS S3 (Camada Ouro)

O model `src/models/preditivaMetricasModel-isaac.js` está desacoplado das demais camadas:
1. Instalar `@aws-sdk/client-s3`.
2. Configurar `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` e `S3_BUCKET_OURO`.
3. Substituir a leitura de arquivos em `fixtures/gold` por `GetObjectCommand` diretamente do S3 ou manter o endpoint `POST /preditiva/ingestao` acionado via AWS Lambda quando um novo arquivo Gold JSON for gerado. O controller, serviços e frontend permanecerão exatamente os mesmos.
