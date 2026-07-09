export type TeamPresetId = "national-teams" | "brazil-clubs";

export type PresetTeam = {
  country: string;
  logo?: string;
  name: string;
  shortName: string;
};

export const teamPresetOptions: Array<{
  description: string;
  id: TeamPresetId;
  label: string;
}> = [
  {
    description: "Selecoes populares com bandeira preenchida.",
    id: "national-teams",
    label: "Selecoes principais"
  },
  {
    description: "Clubes brasileiros mais usados em boloes nacionais.",
    id: "brazil-clubs",
    label: "Clubes do Brasil"
  }
];

const nationalTeams: PresetTeam[] = [
  { country: "Brasil", logo: "https://flagcdn.com/w80/br.png", name: "Brasil", shortName: "BRA" },
  { country: "Argentina", logo: "https://flagcdn.com/w80/ar.png", name: "Argentina", shortName: "ARG" },
  { country: "Uruguai", logo: "https://flagcdn.com/w80/uy.png", name: "Uruguai", shortName: "URU" },
  { country: "Chile", logo: "https://flagcdn.com/w80/cl.png", name: "Chile", shortName: "CHI" },
  { country: "Colombia", logo: "https://flagcdn.com/w80/co.png", name: "Colombia", shortName: "COL" },
  { country: "Equador", logo: "https://flagcdn.com/w80/ec.png", name: "Equador", shortName: "ECU" },
  { country: "Peru", logo: "https://flagcdn.com/w80/pe.png", name: "Peru", shortName: "PER" },
  { country: "Paraguai", logo: "https://flagcdn.com/w80/py.png", name: "Paraguai", shortName: "PAR" },
  { country: "Venezuela", logo: "https://flagcdn.com/w80/ve.png", name: "Venezuela", shortName: "VEN" },
  { country: "Bolivia", logo: "https://flagcdn.com/w80/bo.png", name: "Bolivia", shortName: "BOL" },
  { country: "Estados Unidos", logo: "https://flagcdn.com/w80/us.png", name: "Estados Unidos", shortName: "USA" },
  { country: "Canada", logo: "https://flagcdn.com/w80/ca.png", name: "Canada", shortName: "CAN" },
  { country: "Mexico", logo: "https://flagcdn.com/w80/mx.png", name: "Mexico", shortName: "MEX" },
  { country: "Costa Rica", logo: "https://flagcdn.com/w80/cr.png", name: "Costa Rica", shortName: "CRC" },
  { country: "Japao", logo: "https://flagcdn.com/w80/jp.png", name: "Japao", shortName: "JPN" },
  { country: "Coreia do Sul", logo: "https://flagcdn.com/w80/kr.png", name: "Coreia do Sul", shortName: "KOR" },
  { country: "Alemanha", logo: "https://flagcdn.com/w80/de.png", name: "Alemanha", shortName: "GER" },
  { country: "Franca", logo: "https://flagcdn.com/w80/fr.png", name: "Franca", shortName: "FRA" },
  { country: "Espanha", logo: "https://flagcdn.com/w80/es.png", name: "Espanha", shortName: "ESP" },
  { country: "Portugal", logo: "https://flagcdn.com/w80/pt.png", name: "Portugal", shortName: "POR" },
  { country: "Inglaterra", logo: "https://flagcdn.com/w80/gb-eng.png", name: "Inglaterra", shortName: "ENG" },
  { country: "Italia", logo: "https://flagcdn.com/w80/it.png", name: "Italia", shortName: "ITA" },
  { country: "Holanda", logo: "https://flagcdn.com/w80/nl.png", name: "Holanda", shortName: "NED" },
  { country: "Belgica", logo: "https://flagcdn.com/w80/be.png", name: "Belgica", shortName: "BEL" },
  { country: "Croacia", logo: "https://flagcdn.com/w80/hr.png", name: "Croacia", shortName: "CRO" },
  { country: "Marrocos", logo: "https://flagcdn.com/w80/ma.png", name: "Marrocos", shortName: "MAR" },
  { country: "Africa do Sul", logo: "https://flagcdn.com/w80/za.png", name: "Africa do Sul", shortName: "RSA" },
  { country: "Senegal", logo: "https://flagcdn.com/w80/sn.png", name: "Senegal", shortName: "SEN" },
  { country: "Egito", logo: "https://flagcdn.com/w80/eg.png", name: "Egito", shortName: "EGY" },
  { country: "Australia", logo: "https://flagcdn.com/w80/au.png", name: "Australia", shortName: "AUS" }
];

const brazilClubs: PresetTeam[] = [
  { country: "Brasil", name: "Flamengo", shortName: "FLA" },
  { country: "Brasil", name: "Palmeiras", shortName: "PAL" },
  { country: "Brasil", name: "Corinthians", shortName: "COR" },
  { country: "Brasil", name: "Sao Paulo", shortName: "SAO" },
  { country: "Brasil", name: "Santos", shortName: "SAN" },
  { country: "Brasil", name: "Gremio", shortName: "GRE" },
  { country: "Brasil", name: "Internacional", shortName: "INT" },
  { country: "Brasil", name: "Atletico-MG", shortName: "CAM" },
  { country: "Brasil", name: "Cruzeiro", shortName: "CRU" },
  { country: "Brasil", name: "Botafogo", shortName: "BOT" },
  { country: "Brasil", name: "Fluminense", shortName: "FLU" },
  { country: "Brasil", name: "Vasco", shortName: "VAS" },
  { country: "Brasil", name: "Bahia", shortName: "BAH" },
  { country: "Brasil", name: "Fortaleza", shortName: "FOR" },
  { country: "Brasil", name: "Ceara", shortName: "CEA" },
  { country: "Brasil", name: "Sport", shortName: "SPT" },
  { country: "Brasil", name: "Athletico", shortName: "CAP" },
  { country: "Brasil", name: "Coritiba", shortName: "CFC" },
  { country: "Brasil", name: "Vitoria", shortName: "VIT" },
  { country: "Brasil", name: "Red Bull Bragantino", shortName: "RBB" }
];

export function getTeamPreset(id: TeamPresetId) {
  return id === "national-teams" ? nationalTeams : brazilClubs;
}
