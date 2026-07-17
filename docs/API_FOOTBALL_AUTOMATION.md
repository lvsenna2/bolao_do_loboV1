# Automacao da API-Football

O aplicativo expoe `POST /api/cron/football-sync`. A rota consulta primeiro o PostgreSQL,
decide o que esta vencido e somente entao chama a API-Football. Nenhuma pagina do usuario
consulta a API externa.

## Variaveis de ambiente

Configure na Vercel para Production, Preview e Development quando aplicavel:

```env
API_FOOTBALL_KEY=...
API_FOOTBALL_BASE_URL=https://v3.football.api-sports.io
API_FOOTBALL_TIMEOUT_MS=8000
API_FOOTBALL_RETRIES=1
API_FOOTBALL_DAILY_RESERVE=250
CRON_SECRET=uma-chave-aleatoria-com-pelo-menos-32-caracteres
```

Depois de adicionar as variaveis, faca um novo deploy. A migration
`20260716000100_api_football_automation` precisa ser aplicada com `pnpm prisma:deploy` no
build/deploy antes da primeira execucao.

## Agendamento com QStash

O Vercel Hobby aceita cron apenas uma vez por dia. Para executar a cada minuto sem trocar de
plano, crie um Schedule no QStash:

- Destination: `https://SEU-DOMINIO/api/cron/football-sync`
- Method: `POST`
- Cron: `* * * * *`
- Header: `Authorization: Bearer O_MESMO_CRON_SECRET`
- Retries: `1`

O QStash apenas desperta a rota. Uma chamada ao cron nao significa uma chamada a API-Football:
o motor pode encerrar sem consumo quando nenhuma partida precisa de atualizacao.

No Vercel Pro, a mesma rota pode ser cadastrada em `vercel.json` com intervalo de um minuto.
Este repositorio nao inclui esse cron por padrao para que deploys no plano Hobby nao falhem.

## Estrategia de consumo

- jogos ao vivo sao buscados juntos com `fixtures?live=...`;
- partidas conhecidas sao agrupadas em lotes de ate 20 com `fixtures?ids=...`;
- eventos embutidos na resposta sao reaproveitados;
- escalacoes sao tentadas na janela de uma hora antes do inicio;
- detalhes finais, tabela e historico usam a cota restante;
- partidas com `fullySyncedAt` nao voltam a ser consultadas;
- quando a cota diaria cai, o intervalo ao vivo aumenta gradualmente para preservar o placar;
- dados de baixa prioridade param antes da reserva definida em `API_FOOTBALL_DAILY_RESERVE`.

Com o plano Pro de 7.500 chamadas por dia, a reserva sugerida e de 250 chamadas. O placar ao
vivo permanece com intervalo de um minuto enquanto houver cota, e o motor continua evitando
consultas quando nenhuma partida ou detalhe estiver vencido.

## Seguranca e diagnostico

Chamadas sem `Authorization: Bearer CRON_SECRET` recebem HTTP 401. O painel
`/admin/sincronizacao` mostra a ultima execucao, proxima prevista, jogos acompanhados, cota e
erros recentes. As tabelas `football_api_request_logs`, `football_automation_logs` e
`football_sync_states` guardam o diagnostico sem registrar a chave da API.
