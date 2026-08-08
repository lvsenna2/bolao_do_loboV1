# Sincronizacao da API-Football

As paginas do usuario leem exclusivamente os dados salvos no PostgreSQL. A chave da
API-Football permanece no servidor e nunca e enviada ao navegador.

## Variaveis de ambiente

Configure na Vercel para Production, Preview e Development quando aplicavel:

```env
API_FOOTBALL_KEY=...
API_FOOTBALL_BASE_URL=https://v3.football.api-sports.io
API_FOOTBALL_TIMEOUT_MS=8000
API_FOOTBALL_RETRIES=1
API_FOOTBALL_DAILY_RESERVE=250
FOOTBALL_MANUAL_SYNC_COOLDOWN_HOURS=12
CRON_SECRET=gere-um-segredo-longo-e-aleatorio
```

Depois de adicionar as variaveis, faca um novo deploy. A migration
`20260716000100_api_football_automation` precisa ser aplicada com `pnpm prisma:deploy` no
build/deploy antes da primeira execucao.

## Sincronizacao automatica na Vercel Pro

O arquivo `vercel.json` agenda duas rotinas, executadas apenas em deploys de producao:

- `/api/cron/football-sync`: a cada minuto, identifica partidas relevantes e atualiza em lote;
- `/api/cron/football-catalog`: a cada seis horas, verifica se algum catalogo esta desatualizado.

A Vercel envia `Authorization: Bearer <CRON_SECRET>` automaticamente. As rotas recusam
requisicoes sem esse segredo e o servico usa lock no PostgreSQL para impedir execucoes
simultaneas. Configure `CRON_SECRET` apenas no servidor e nunca como `NEXT_PUBLIC_*`.

O agendamento por minuto nao significa uma chamada externa por minuto quando nao ha jogo. A
decisao usa os horarios e os carimbos de sincronizacao salvos no banco. Partidas conhecidas sao
consultadas em lotes de ate 20 IDs; dados completos ja finalizados deixam de ser consultados.

## Sincronizacao manual de contingencia

O painel `/admin/sincronizacao` permite escolher uma competicao e iniciar a sincronizacao
manual. O processo atualiza catalogo, rodadas, partidas e os detalhes disponiveis, replica as
rodadas para as ligas vinculadas e salva o progresso em lotes.

Os botoes manuais permanecem apenas para contingencia e diagnostico. O fluxo normal nao depende
de acesso ao painel administrativo.

## Estrategia de consumo

- jogos ao vivo sao buscados juntos quando a API oferece consulta em lote;
- partidas conhecidas sao agrupadas para evitar uma chamada por jogo;
- eventos embutidos na resposta sao reaproveitados;
- escalacoes sao tentadas proximo do inicio;
- detalhes finais, tabela e historico usam a cota restante;
- partidas completas nao voltam a ser consultadas sem necessidade;
- dados de baixa prioridade param antes da reserva definida em
  `API_FOOTBALL_DAILY_RESERVE`.

A camada de requisicoes registra endpoint, duracao, status HTTP e os headers de limite retornados
pela API. Tarefas secundarias param primeiro; placares ao vivo conservam uma reserva minima de
seguranca. Um limitador central espacando o inicio das requisicoes mantem cada Function abaixo de
5 chamadas por segundo. As paginas do usuario consultam o PostgreSQL e a rota interna de placares,
nunca a API-Football diretamente.

O painel administrativo mostra execucoes, jogos acompanhados, cota e erros recentes. As tabelas
`football_api_request_logs`, `football_automation_logs` e `football_sync_states` mantem o
diagnostico sem registrar a chave da API.
