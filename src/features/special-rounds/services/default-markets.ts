import type { SpecialRoundAnswerType, SpecialRoundMarketKind } from "@prisma/client";

export type AutomaticMarketOption = {
  label: string;
  value: string;
};

export type AutomaticSpecialRoundMarket = {
  active: boolean;
  answerType: SpecialRoundAnswerType;
  description: string;
  kind: SpecialRoundMarketKind;
  line: number | null;
  options: AutomaticMarketOption[];
  points: number;
  required: boolean;
  sortOrder: number;
  title: string;
};

type PlayerOption = {
  id: string;
  name: string;
};

export function buildGoalScorerOptions(players: PlayerOption[]): AutomaticMarketOption[] {
  return [
    ...players
      .filter(
        (player, index, list) => list.findIndex((candidate) => candidate.id === player.id) === index
      )
      .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"))
      .map((player) => ({ label: player.name, value: `PLAYER:${player.id}` })),
    { label: "Nenhum jogador (sem gols)", value: "NO_GOAL" }
  ];
}

export function buildAutomaticSpecialRoundMarkets(
  homeTeamName: string,
  awayTeamName: string,
  players: PlayerOption[]
): AutomaticSpecialRoundMarket[] {
  const playerOptions = buildGoalScorerOptions(players);
  const teamComparisonOptions = [
    { label: homeTeamName, value: "HOME" },
    { label: "Empate", value: "DRAW" },
    { label: awayTeamName, value: "AWAY" }
  ];

  return [
    {
      active: true,
      answerType: "SCORE",
      description: "Informe o placar final da partida.",
      kind: "EXACT_SCORE",
      line: null,
      options: [],
      points: 6,
      required: true,
      sortOrder: 1,
      title: "Placar exato"
    },
    {
      active: true,
      answerType: "SINGLE_CHOICE",
      description: "Escolha o resultado ao fim do tempo regulamentar.",
      kind: "MATCH_RESULT",
      line: null,
      options: [
        { label: homeTeamName, value: "HOME" },
        { label: "Empate", value: "DRAW" },
        { label: awayTeamName, value: "AWAY" }
      ],
      points: 3,
      required: true,
      sortOrder: 2,
      title: "Resultado da partida"
    },
    {
      active: true,
      answerType: "SINGLE_CHOICE",
      description: "Total de gols acima ou abaixo de 2,5.",
      kind: "TOTAL_GOALS",
      line: 2.5,
      options: [
        { label: "Acima de 2,5", value: "OVER" },
        { label: "Abaixo de 2,5", value: "UNDER" }
      ],
      points: 2,
      required: true,
      sortOrder: 3,
      title: "Total de gols"
    },
    {
      active: true,
      answerType: "SINGLE_CHOICE",
      description: "Total de escanteios acima ou abaixo de 9,5.",
      kind: "TOTAL_CORNERS",
      line: 9.5,
      options: [
        { label: "Acima de 9,5", value: "OVER" },
        { label: "Abaixo de 9,5", value: "UNDER" }
      ],
      points: 2,
      required: true,
      sortOrder: 4,
      title: "Total de escanteios"
    },
    {
      active: true,
      answerType: "BOOLEAN",
      description: "Os dois times marcam pelo menos um gol?",
      kind: "BOTH_TEAMS_SCORE",
      line: null,
      options: [],
      points: 2,
      required: true,
      sortOrder: 5,
      title: "Ambas as equipes marcam"
    },
    {
      active: true,
      answerType: "SINGLE_CHOICE",
      description: "Total de cartões amarelos e vermelhos acima ou abaixo de 4,5.",
      kind: "TOTAL_CARDS",
      line: 4.5,
      options: [
        { label: "Acima de 4,5", value: "OVER" },
        { label: "Abaixo de 4,5", value: "UNDER" }
      ],
      points: 2,
      required: true,
      sortOrder: 6,
      title: "Total de cartões"
    },
    {
      active: true,
      answerType: "SINGLE_CHOICE",
      description: "Qual time marca o primeiro gol da partida?",
      kind: "FIRST_TEAM_TO_SCORE",
      line: null,
      options: [
        { label: homeTeamName, value: "HOME" },
        { label: awayTeamName, value: "AWAY" },
        { label: "Partida sem gols", value: "NO_GOAL" }
      ],
      points: 2,
      required: true,
      sortOrder: 7,
      title: "Primeiro time a marcar"
    },
    {
      active: true,
      answerType: "OPTION_LIST",
      description: players.length
        ? "Escolha quem marcará o primeiro gol da partida."
        : "A lista de jogadores sera preenchida quando a escalacao for sincronizada.",
      kind: "GOAL_SCORER",
      line: null,
      options: playerOptions,
      points: 3,
      required: true,
      sortOrder: 8,
      title: "Primeiro jogador a marcar"
    },
    {
      active: true,
      answerType: "SINGLE_CHOICE",
      description: "Qual time termina a partida com mais chutes no gol?",
      kind: "TEAM_MOST_SHOTS_ON_GOAL",
      line: null,
      options: teamComparisonOptions,
      points: 2,
      required: true,
      sortOrder: 9,
      title: "Time com mais chutes no gol"
    },
    {
      active: true,
      answerType: "SINGLE_CHOICE",
      description: "Qual time termina a partida com mais escanteios?",
      kind: "TEAM_MOST_CORNERS",
      line: null,
      options: teamComparisonOptions,
      points: 2,
      required: true,
      sortOrder: 10,
      title: "Time com mais escanteios"
    },
    {
      active: true,
      answerType: "SINGLE_CHOICE",
      description: "Qual time recebe mais cartoes amarelos e vermelhos?",
      kind: "TEAM_MOST_CARDS",
      line: null,
      options: teamComparisonOptions,
      points: 2,
      required: true,
      sortOrder: 11,
      title: "Time com mais cartoes"
    },
    {
      active: true,
      answerType: "SINGLE_CHOICE",
      description: "Qual time termina a partida com mais finalizacoes?",
      kind: "TEAM_MOST_SHOTS",
      line: null,
      options: teamComparisonOptions,
      points: 2,
      required: true,
      sortOrder: 12,
      title: "Time com mais finalizacoes"
    }
  ];
}
