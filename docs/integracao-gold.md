# Integração da camada Gold

Fluxo: tratamento.py → JSONs da Gold → backend Node → GET /dashboard/capacidade → Panorama Operacional.
Não há billing. O tratamento continua responsável por médias, variação em pontos percentuais,
status, crescimento, pressão, prioridade e previsões. O navegador apenas apresenta esses resultados.

## Configuração

Instale as dependências com `npm install`. Acrescente as variáveis de
`config/gold.env.example` ao `.env.dev`, que é carregado pela configuração atual de `app.js`.
Não substitua as configurações existentes do MySQL e da sessão.

Para S3, configure `GOLD_FONTE=s3`, `AWS_REGION` com a região real do bucket,
`GOLD_S3_BUCKET=monitore-ouro-2026` e, se necessário, `GOLD_S3_PREFIXO` com a pasta dos objetos.
O prefixo não deve conter o nome do bucket nem `s3://`.

O bucket precisa conter os dois arquivos completos gerados na mesma execução do tratamento:

- `PANORAMA_TORRES.json`
- `PANORAMA_ANALISE_COMPONENTES.json`

Os arquivos ficam na raiz por padrão. O backend usa o SDK oficial da AWS e as credenciais
do ambiente (perfil AWS, role da instância ou variáveis de ambiente). O bucket pode continuar
privado. A identidade do backend precisa de `s3:GetObject` apenas para esses objetos.
Não é necessário acesso público, CORS no bucket, `ListBucket` ou permissão de escrita para a dashboard.

Exemplo de política de leitura para objetos na raiz:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": "s3:GetObject",
    "Resource": [
      "arn:aws:s3:::monitore-ouro-2026/PANORAMA_TORRES.json",
      "arn:aws:s3:::monitore-ouro-2026/PANORAMA_ANALISE_COMPONENTES.json"
    ]
  }]
}
```

Se houver prefixo, inclua-o nos dois ARNs. Objetos criptografados com chave KMS própria
também exigem permissão de descriptografia nessa chave.

Para testar com os arquivos locais, configure:

```dotenv
GOLD_FONTE=local
GOLD_PASTA_LOCAL=D:/FACULDADE/PI/MonitOre-python/ouro
GOLD_FUSO=-03:00
```

Reinicie o Node após mudar as variáveis. Entre no site e abra o Panorama Operacional.
Cada atualização da página consulta os dois arquivos novamente; não há polling automático.
O tratamento fornecido grava os arquivos locais: esta integração apenas lê o S3 e não os publica.
O envio ao bucket deve fazer parte da execução do pipeline ou ser feito manualmente.

## Contrato e acesso

As duas entradas são arrays JSON tipados, com números, booleanos e `null`, conforme o
`tratamento.py` fornecido. O backend cruza `ID_TORRE`, `ID_PC` e `COMPONENTE` com os cadastros
autorizados no MySQL. Nomes dos componentes cadastrados são normalizados para CPU, RAM e DISCO.
Nomes de torres e PCs exibidos vêm do cadastro autorizado. Torres com monitoramento desativado
não recebem leituras da Gold. Em torres com vários PCs, cada recurso mantém a identificação do PC;
os indicadores contam torres únicas e usam a situação mais grave dos resumos dos PCs cadastrados.

`VARIACAO_PP` é exibida diretamente: média da semana atual menos média das quatro semanas anteriores.
`null` aparece como `—`, sem inventar histórico. `EXIBIR_TABELA` e `PRIORIDADE` controlam a tabela;
os filtros incluem crescimento preocupante e pressão. Datas sem offset são interpretadas
com `GOLD_FUSO` e retornadas à página em ISO com fuso explícito.

Sem sessão, a API responde 401; sem torres autorizadas, retorna lista vazia sem consultar a Gold.
Arquivo ausente, JSON inválido ou falha no S3 responde 503 com mensagem de indisponibilidade.
Não há fallback automático para arquivos locais ou dados simulados.

Publique os arquivos da mesma execução juntos antes de atualizar a página. Como o formato atual
não inclui um identificador de execução, ainda não é possível garantir que dois objetos baixados
durante uma publicação simultânea pertençam à mesma execução. Para atualização contínua, a evolução
indicada é publicar em uma pasta por execução e trocar um manifesto após concluir os dois uploads.

## Validação

Execute `node --test test/gold.test.js`. Os testes usam arquivos temporários e S3 simulado;
não acessam o banco nem a AWS. O acesso real exige objetos, região e credenciais configurados.

Referência: [GetObject no SDK oficial da AWS](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/javascript_s3_code_examples.html).
