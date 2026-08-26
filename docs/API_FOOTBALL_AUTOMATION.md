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

- `/api/cron/football-sync`: a cada 30 minutos, identifica partidas relevantes e atualiza em lote;
- `/api/cron/football-catalog`: a cada seis horas, verifica se algum catalogo esta desatualizado.

A Vercel envia `Authorization: Bearer <CRON_SECRET>` automaticamente. As rotas recusam
requisicoes sem esse segredo e o servico usa lock no PostgreSQL para impedir execucoes
simultaneas. Configure `CRON_SECRET` apenas no servidor e nunca como `NEXT_PUBLIC_*`.

Cada execucao consulta o PostgreSQL mesmo quando nao ha chamada externa. O intervalo de 30 minutos
permite que bancos com scale-to-zero sejam suspensos entre execucoes. A
decisao usa os horarios e os carimbos de sincronizacao salvos no banco. Placar e status de ate 20
partidas sao consultados em lote. Na janela critica do kickoff (15 minutos antes ate 10 minutos
depois), a fixture e atualizada em toda execucao do cron, sem cooldown, para que a transicao
SCHEDULED -> LIVE aconteca na mesma execucao em que a API reporta a partida em andamento. O
endpoint `fixtures?live` tambem e consultado quando existe partida conhecida com kickoff ja
iniciado, reconciliando o retorno com os candidatos locais mesmo que o banco ainda os considere
SCHEDULED; fixtures obtidas pelo live nao entram novamente na consulta por ids na mesma execucao.
Dados completos ja finalizados deixam de ser consultados.

Os detalhes mais caros usam budgets independentes por categoria a cada execucao: ao vivo
(prioridade maxima), pre-jogo (escalacoes de partidas prestes a comecar) e consolidacao de
partidas encerradas. Assim, muitos jogos simultaneos ao vivo nao bloqueiam a escalacao de uma
partida que comeca em poucos minutos. A atualizacao basica da fixture (status, placar, elapsed,
kickoff e demais campos) nao depende desses budgets.

Enquanto um usuario acompanha uma partida proxima ou ao vivo, o polling de `/api/football/live-scores`
aciona a mesma automacao apenas quando a decisao de sincronizacao indica dados vencidos. Isso mantem
placares frequentes durante uso ativo sem despertar o PostgreSQL continuamente quando nao ha audiencia.

As escalacoes entram na fila 30 minutos antes do inicio. Enquanto estiverem incompletas,
o sistema tenta novamente a cada 5 minutos e reduz o intervalo para 2 minutos nos 10
minutos finais. Partidas ao vivo e escalacoes urgentes passam na frente do backlog de
detalhes. Rodadas Especiais vinculadas ao mesmo `Match` reutilizam automaticamente a
escalacao, os eventos e as estatisticas persistidos pelo sincronizador.

Partidas encerradas buscam cada conjunto de detalhes apenas enquanto ele ainda nao foi salvo.
O preenchimento do backlog de historico libera no maximo um lote a cada 30 minutos e a tabela
de uma mesma competicao tambem respeita um intervalo minimo de 30 minutos. O Cron encerra
rapidamente sem chamada externa quando nao existe trabalho devido.

### Jogadores das Rodadas Especiais

O endpoint `fixtures/lineups` publica somente a escalacao oficial, normalmente perto do
inicio da partida. Antes disso, o mercado "Primeiro jogador a marcar" usa os elencos atuais
obtidos por `players/squads`, separados entre mandante e visitante. A lista fica salva no
banco e nao gera chamadas quando o participante abre a pagina. Quando a escalacao oficial
estiver disponivel, a atualizacao administrativa prioriza titulares e reservas, preservando
palpites que ja tenham sido enviados.

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

O painel administrativo mostra execucoes, jogos acompanhados, cota, consumo por endpoint,
duracao media, falhas e repeticoes de parametros em uma amostra recente. As tabelas
`football_api_request_logs`, `football_automation_logs` e `football_sync_states` mantem o
diagnostico sem registrar a chave da API.
