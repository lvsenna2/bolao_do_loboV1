import {
  CalendarDays,
  ClipboardList,
  Crown,
  Dices,
  FileText,
  Flag,
  GitCompareArrows,
  History,
  LayoutDashboard,
  Medal,
  RefreshCw,
  Settings,
  ShieldCheck,
  Sparkles,
  Swords,
  Trophy,
  Users,
  WalletCards
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type NavigationItem = {
  href: string;
  icon: LucideIcon;
  label: string;
};

export const mainNavigationItems: NavigationItem[] = [
  {
    href: "/dashboard",
    icon: LayoutDashboard,
    label: "Dashboard"
  },
  {
    href: "/ligas",
    icon: Users,
    label: "Ligas"
  },
  {
    href: "/rodadas",
    icon: CalendarDays,
    label: "Jogos"
  },
  {
    href: "/palpites",
    icon: ClipboardList,
    label: "Palpites"
  },
  {
    href: "/rodadas-especiais",
    icon: Swords,
    label: "Rodada Especial"
  },
  {
    href: "/comparar-palpites",
    icon: GitCompareArrows,
    label: "Comparar"
  },
  {
    href: "/ranking",
    icon: Trophy,
    label: "Ranking"
  },
  {
    href: "/xp-ranking",
    icon: Sparkles,
    label: "Ranking XP"
  },
  {
    href: "/planos",
    icon: Crown,
    label: "Planos"
  },
  {
    href: "/carteira",
    icon: WalletCards,
    label: "Carteira"
  },
  {
    href: "/roleta-diaria",
    icon: Dices,
    label: "Roleta Diaria"
  }
];

const mobileNavigationHrefs = new Set([
  "/dashboard",
  "/ligas",
  "/palpites",
  "/rodadas-especiais",
  "/comparar-palpites",
  "/roleta-diaria",
  "/planos"
]);

export const mobileNavigationItems = mainNavigationItems.filter((item) =>
  mobileNavigationHrefs.has(item.href)
);

export const adminNavigationItems: NavigationItem[] = [
  {
    href: "/admin",
    icon: ShieldCheck,
    label: "Visao geral"
  },
  {
    href: "/admin/usuarios",
    icon: Users,
    label: "Usuarios"
  },
  {
    href: "/admin/campeonatos",
    icon: Medal,
    label: "Campeonatos"
  },
  {
    href: "/admin/times",
    icon: Flag,
    label: "Times"
  },
  {
    href: "/admin/sincronizacao",
    icon: RefreshCw,
    label: "Sincronizacao"
  },
  {
    href: "/admin/rodadas",
    icon: CalendarDays,
    label: "Rodadas"
  },
  {
    href: "/admin/rodadas-especiais",
    icon: Swords,
    label: "Rodadas Especiais"
  },
  {
    href: "/admin/ligas",
    icon: Trophy,
    label: "Ligas"
  },
  {
    href: "/admin/rankings",
    icon: Medal,
    label: "Rankings"
  },
  {
    href: "/admin/xp",
    icon: Sparkles,
    label: "XP"
  },
  {
    href: "/admin/pagamentos",
    icon: WalletCards,
    label: "Pagamentos"
  },
  {
    href: "/admin/palpites",
    icon: ClipboardList,
    label: "Palpites"
  },
  {
    href: "/admin/relatorios",
    icon: FileText,
    label: "Relatorios"
  },
  {
    href: "/admin/auditoria",
    icon: History,
    label: "Auditoria"
  },
  {
    href: "/admin/configuracoes",
    icon: Settings,
    label: "Configuracoes"
  }
];
