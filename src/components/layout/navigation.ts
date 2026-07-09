import {
  CalendarDays,
  ClipboardList,
  FileText,
  Flag,
  GitCompareArrows,
  History,
  LayoutDashboard,
  Medal,
  Settings,
  ShieldCheck,
  Trophy,
  UserRound,
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
    href: "/perfil",
    icon: UserRound,
    label: "Perfil"
  }
];

export const mobileNavigationItems: NavigationItem[] = [
  mainNavigationItems[0],
  mainNavigationItems[1],
  mainNavigationItems[3],
  mainNavigationItems[4],
  mainNavigationItems[6]
];

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
    href: "/admin/rodadas",
    icon: CalendarDays,
    label: "Rodadas"
  },
  {
    href: "/admin/ligas",
    icon: Trophy,
    label: "Ligas"
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
