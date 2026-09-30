#logo Monit Ore
# Sistema Inteligente de Monitoramento de Infraestrutura de computadores industriais
Projeto do 2º Semestre (2026.2) — Desenvolvimento de uma aplicação client e web voltada ao monitoramento de hardware e processos.


Integrantes:
Maria Eduarda Nogueiro
Jefferson Palma
Isaac Azevedo
Arthur Martins
Amanda Tavares
Guilherme Lima


⛏️ Monit Ore - Torres de Extração de Minério
Sistema de telemetria e monitoramento em tempo real para Computadores Industriais (IPCs) responsáveis pelo controle e supervisão de torres de extração mineral.

📌 Visão Geral
Nas operações de mineração, a disponibilidade contínua dos IPCs que controlam as torres de extração é crítica. Falhas causadas por superaquecimento, estouro de memória ou gargalos de processamento podem gerar paradas não planejadas (downtime).

Este projeto fornece uma solução de monitoramento leve e resiliente, projetada para rodar em ambientes industriais severos com conectividade instável, realizando a coleta de dados do sistema operacional e emitindo alertas preventivos para a equipe de automação e manutenção.


🛠️️ Tecnologias Utilizadas.
🐍 Captura & ETL (Python)
Python: Escolhido pela facilidade de integração com o sistema operacional do IPC e bibliotecas robustas de dados.

psutil: Utilizado no script residente do IPC para leitura contínua de métricas de hardware (CPU, temperatura, RAM, disco e rede).

boto3: SDK oficial da AWS para envio seguro e automático dos arquivos de telemetria bruta para o bucket S3.

Pandas: Utilizados nos scripts ETL hospedados no S3 para limpeza, agregação e estruturação dos dados históricos.

📦 Armazenamento em Nuvem (AWS S3)
AWS Simple Storage Service (S3):

Data Lake de Telemetria: Recebe e armazena os arquivos de dados brutos gerados pelos IPCs das torres.


🟢 Servidor & Regras de Negócio (Node.js)
Node.js + Express:

Responsável pelo servidor de aplicação e API REST hospedado na nuvem.

Gerencia os dados de negócio da operação: cadastro de torres, turnos de trabalho, histórico de operadores e registro de alertas operacionais.

Processa requisições assíncronas do dashboard web com alta concorrência e baixa latência.

☁️ Infraestrutura (AWS EC2)
AWS Elastic Compute Cloud (EC2):


Repositório de ETL: Hospeda os scripts em Python encarregados do processamento e consolidação das métricas.

Instância Linux dedicada a hospedar o servidor Node.js e a interface web.


🎨 Interface do Usuário (Frontend)
HTML5: Estruturação semântica do site institucional e da dashboard visual.

CSS3: Estilização responsiva em formato de painel industrial de alto contraste.

JavaScript: Consumo da API Node.js para atualização dinâmica de status e métricas sem necessidade de recarregar a página.


