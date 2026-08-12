# Carteira e Roleta Diaria

Valores monetarios da carteira sao armazenados em centavos. Toda alteracao passa pelos servicos em
`src/features/wallet/services` e gera uma linha imutavel em `wallet_transactions`.

As probabilidades e premios da roleta ficam centralizados em
`src/features/roulette/roulette-config.ts`. A tabela principal possui 100.000 unidades, portanto uma
unidade representa 0,001%. O sorteio usa `node:crypto` no servidor e o premio e entregue na mesma
transacao serializavel que registra o giro.

## Custo financeiro esperado

Considerando apenas dinheiro creditado diretamente na carteira:

- R$ 2,00 com 10%: R$ 0,20 por giro.
- R$ 50,00 com 0,001%: R$ 0,0005 por giro.
- Total esperado direto: **R$ 0,2005 por giro diario**.

Vales e desconto promocional possuem custo condicionado a uma participacao futura e nao entram nesse
calculo direto. Alterar premios exige revisar tambem essa estimativa.
