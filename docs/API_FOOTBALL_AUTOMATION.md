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
```

Depois de adicionar as variaveis, faca um novo deploy. A migration
`20260716000100_api_football_automation` precisa ser aplicada com `pnpm prisma:deploy` no
build/deploy antes da primeira execucao.

## Sincronizacao manual

O painel `/admin/sincronizacao` permite escolher uma competicao e iniciar a sincronizacao
manual. O processo atualiza catalogo, rodadas, partidas e os detalhes disponiveis, replica as
rodadas para as ligas vinculadas e salva o progresso em lotes.

A atualizacao automatica esta desativada. A rota `/api/cron/football-sync` permanece publicada
temporariamente como uma resposta neutra e nao executa a API-Football. Isso evita erros enquanto
eventuais agendamentos externos antigos sao excluidos no proprio servico onde foram criados.

## Estrategia de consumo manual

- jogos ao vivo sao buscados juntos quando a API oferece consulta em lote;
- partidas conhecidas sao agrupadas para evitar uma chamada por jogo;
- eventos embutidos na resposta sao reaproveitados;
- escalacoes sao tentadas proximo do inicio;
- detalhes finais, tabela e historico usam a cota restante;
- partidas completas nao voltam a ser consultadas sem necessidade;
- dados de baixa prioridade param antes da reserva definida em
  `API_FOOTBALL_DAILY_RESERVE`.

O painel administrativo mostra execucoes, jogos acompanhados, cota e erros recentes. As tabelas
`football_api_request_logs`, `football_automation_logs` e `football_sync_states` mantem o
diagnostico sem registrar a chave da API.
