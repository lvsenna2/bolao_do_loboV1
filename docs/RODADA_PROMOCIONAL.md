# Rodada Especial Promocional de Selecao Unica

Formato novo **dentro** das Rodadas Especiais, feito para campanhas de aquisicao e trafego pago.
Nao e uma funcionalidade paralela: usa as mesmas tabelas, a mesma apuracao automatica e o mesmo
painel admin da Rodada Especial comum. O que muda e o campo `SpecialRound.format`.

| | Rodada Especial comum | Rodada Promocional |
| --- | --- | --- |
| `format` | `STANDARD` | `PROMO_SINGLE_SELECTION` |
| Mercados | varios, palpite montado pelo usuario | um so (`TEAM_TO_SCORE`), ja escolhido |
| Entrada | inscricao de valor fixo | aposta de valor livre ate o limite |
| Premiacao | bolo dividido por ranking | retorno da propria aposta (`valor x odd`) |
| Premio cai como | saldo normal | valor apostado de volta + **lucro em saldo bonus** |
| Encerramento | fluxo normal de apuracao | mesmo fluxo, disparado pelo fim da partida |

## Fluxo do usuario

1. Cai em `/rodadas-especiais/<slug>` pelo anuncio (ex.: `/rodadas-especiais/flamengo-cruzeiro`).
2. Se nao estiver logado, o middleware manda para `/login?callbackUrl=<caminho + query>`. A UTM
   viaja no `callbackUrl` e sobrevive tambem ao cadastro (`/register?callbackUrl=...`).
3. Ve a oferta (selecao, odd, teto), digita o valor e confirma. Nada de montar palpite.
4. Se a selecao bater, recebe o valor apostado de volta e o lucro como saldo bonus.

## Regras de dinheiro (todas validadas no backend)

- **Odd, limite e selecao** sao lidos do banco em `placePromoBetAction`; o cliente so envia o
  valor em centavos.
- **Limite por usuario** vale para a SOMA das apostas na promocao. Aposta de R$ 6 deixa R$ 4
  disponiveis; depois disso o backend recusa (`checkPromoStake`).
- **Aposta paga com saldo**: o debito consome saldo bonus primeiro e o restante do saldo normal.
  A parte paga com bonus fica registrada em `SpecialRoundEntry.bonusAmount`.
- **Premio** = `valor apostado x odd`. Na hora de creditar (`splitPromoPayout`), a parte da
  aposta paga com dinheiro real volta para o saldo normal, a parte paga com bonus volta para o
  bonus, e **todo o lucro vira bonus**. Sem isso daria para lavar bonus em saldo sacavel.
- **Idempotencia**: a `uniqueKey` do debito carrega o total acumulado
  (`wallet:promo-round:<round>:user:<user>:total:<centavos>`) e o credito do premio usa a chave
  do premio. Reenviar o formulario ou reprocessar a rodada nao cobra nem paga duas vezes.
- **Cancelamento**: `updateSpecialRoundStatusAction` com status `CANCELLED` estorna
  automaticamente (`refundPromoRoundEntries`), cada parte para o balde de origem e sem bonus.

## Saldo normal x saldo bonus

`Wallet` passou a ter dois baldes:

- `balanceCents` — saldo normal. **E o unico que pode ser sacado.**
- `bonusBalanceCents` — saldo bonus. Aparece no saldo total, pode ser gasto em qualquer aposta
  ou bolao, mas o saque nao enxerga (`debitWalletInTransaction` com `source: "REAL_ONLY"`).

No extrato, `balanceBeforeCents`/`balanceAfterCents` guardam o saldo **total** e
`bonusAmountCents` guarda a parte do movimento que tocou o bonus.

Exemplo: saldo normal R$ 30 + bonus R$ 10 = total R$ 40 exibido, R$ 30 disponiveis para saque.

## Apuracao

O mercado unico e do tipo `TEAM_TO_SCORE`. A unica opcao do mercado guarda o lado cobrado
(`HOME`/`AWAY`) e `deriveCatalogResults` responde "esse time marcou?" a partir do placar final.
Dai para frente e o fluxo padrao: `calculateSpecialRound` pontua, e a branch promocional cria um
premio por aposta certa em vez de dividir bolo. A varredura automatica
(`settleFinishedSpecialRounds`) inclui a promocao ja a partir de `REGISTRATION_OPEN`, porque ela
nao passa pelas fases de palpite.

## Painel administrativo

- `/admin/rodadas-especiais/promocional` cria a promocao (titulo, confronto, selecao unica, odd,
  minimo, limite por usuario, janela de apostas, link da campanha, banner, chamada, regulamento).
- `/admin/rodadas-especiais/<id>` mostra o painel de leitura da promocao (link, total apostado,
  quanto veio de bonus, exposicao em bonus se todos ganharem) acima do workspace de sempre.
- `/admin/rodadas-especiais/<id>/editar` abre o formulario promocional. **Depois da primeira
  aposta, selecao, odd e limite ficam travados** — sao contrato com quem ja apostou.
- Status, resultado, apuracao e cancelamento seguem os mesmos botoes da Rodada Especial comum.

## Primeira campanha

| Campo | Valor |
| --- | --- |
| Confronto | Flamengo x Cruzeiro |
| Selecao | Flamengo marcar pelo menos 1 gol |
| Odd | 2.00 |
| Limite por usuario | R$ 10,00 |
| Link | `/rodadas-especiais/flamengo-cruzeiro` |
