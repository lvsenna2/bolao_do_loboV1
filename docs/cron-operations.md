# Agendamento de futebol

O workflow `.github/workflows/football-cron.yml` substitui os crons nativos da Vercel.
As rotas continuam hospedadas na Vercel. O GitHub autentica cada chamada com um token
OIDC temporário assinado; não é necessário configurar segredos no Actions.

| Tarefa   | Horário UTC                  | Rota                         |
| -------- | ---------------------------- | ---------------------------- |
| Jogos    | Minutos 07 e 37 de cada hora | `/api/cron/football-sync`    |
| Catálogo | 00:17, 06:17, 12:17 e 18:17  | `/api/cron/football-catalog` |

A API verifica assinatura RS256, emissor do GitHub, audiência específica, validade,
ID do repositório e do proprietário, branch `main`, caminho exato do workflow e eventos
`schedule` ou `workflow_dispatch`. Tokens de forks, outros workflows e pull requests são rejeitados.
O `CRON_SECRET` existente continua aceito para chamadas legadas; ele não foi alterado.

Para executar manualmente: **Actions > Football cron > Run workflow**, na branch `main`.
Escolha `sync`, `catalog` ou `both`. Confira os logs de cada execução nessa mesma página.
Falhas HTTP, respostas sem `ok: true` e bloqueios de concorrência deixam a execução vermelha.
Não há repetição automática de chamadas que possam já ter gravado dados.

As execuções são serializadas. Cada chamada espera até 310 segundos; o job tem limite de
12 minutos. O workflow não instala dependências, não faz checkout e não armazena artefatos.

## Custo e limites

- Runners padrão são gratuitos em repositórios públicos. Este workflow não roda se o
  repositório passar a privado. Ele não altera limites de gastos nem contrata serviços.
- O GitHub pode atrasar ou descartar agendamentos sob carga. Não há garantia de horário exato.
- Em repositórios públicos, os agendamentos são desativados após 60 dias sem atividade.
  Se isso ocorrer, reative o workflow na aba Actions.
- Os consumos da Vercel, do banco e da API de futebol continuam sujeitos aos próprios limites.
- O agendador externo não altera a restrição do Vercel Hobby a uso pessoal não comercial.

Referências: [custos do Actions](https://docs.github.com/en/billing/concepts/product-billing/github-actions),
[agendamentos](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).
