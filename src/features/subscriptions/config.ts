import type { SubscriptionPlan } from "@prisma/client";

export type SubscriptionBenefits = {
  badge: string;
  canChooseSpecialRound: boolean;
  canCreateSpecialRound: boolean;
  discountPercent: number;
  freeLeagues: boolean;
};

export const SUBSCRIPTION_PLANS: Record<
  SubscriptionPlan,
  {
    benefits: SubscriptionBenefits;
    description: string;
    name: string;
    price: number;
  }
> = {
  PRATA: {
    benefits: {
      badge: "Prata",
      canChooseSpecialRound: false,
      canCreateSpecialRound: false,
      discountPercent: 25,
      freeLeagues: false
    },
    description: "Economia para participar de mais ligas.",
    name: "Prata",
    price: 4.99
  },
  OURO: {
    benefits: {
      badge: "Ouro",
      canChooseSpecialRound: false,
      canCreateSpecialRound: false,
      discountPercent: 50,
      freeLeagues: false
    },
    description: "Metade do valor em todas as ligas pagas.",
    name: "Ouro",
    price: 9.99
  },
  PLATINUM: {
    benefits: {
      badge: "Platinum",
      canChooseSpecialRound: true,
      canCreateSpecialRound: true,
      discountPercent: 100,
      freeLeagues: true
    },
    description: "Acesso completo e autonomia nas Rodadas Especiais.",
    name: "Platinum",
    price: 19.99
  }
};

export const SUBSCRIPTION_PLAN_ORDER: SubscriptionPlan[] = ["PLATINUM", "OURO", "PRATA"];

export const NO_SUBSCRIPTION_BENEFITS: SubscriptionBenefits = {
  badge: "",
  canChooseSpecialRound: false,
  canCreateSpecialRound: false,
  discountPercent: 0,
  freeLeagues: false
};

export function getPlanConfig(plan: SubscriptionPlan) {
  return SUBSCRIPTION_PLANS[plan];
}
