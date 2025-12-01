interface PricingPlan {
  id: string;
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  description: string;
  features: string[];
  recommended?: boolean;
  stripePriceIdMonthly: string;
  stripePriceIdYearly: string;
}

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: "trial",
    name: "Free Trial",
    monthlyPrice: 0,
    yearlyPrice: 0,
    description: "Experience the full power risk-free",
    features: [
      "Complete access to all premium features",
      "Up to 1,000 AI-powered conversations",
      "Advanced analytics dashboard",
      "Email & chat support",
      "Multi-channel integration",
      "No credit card required",
    ],
    stripePriceIdMonthly: "price_1RyxWWFS3P7wS29bZsXvMCOR",
    stripePriceIdYearly: "price_1RyxWWFS3P7wS29bZsXvMCOR",
  },
  {
    id: "professional",
    name: "Professional",
    monthlyPrice: 49,
    yearlyPrice: 499,
    description: "Ideal for growing businesses",
    features: [
      "Unlimited AI-powered conversations",
      "Real-time analytics & insights",
      "Priority email & chat support",
      "Advanced customization options",
      "CRM & tool integrations",
      "Custom branding & themes",
    ],
    recommended: true,
    stripePriceIdMonthly: "price_1RyxVtFS3P7wS29b940JDA7E",
    stripePriceIdYearly: "price_1SRPfGFS3P7wS29b1LEGA6HR",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    monthlyPrice: 99,
    yearlyPrice: 999,
    description: "Maximum value for committed teams",
    features: [
      "Everything in Professional plan",
      "Save 2 months with annual billing",
      "Unlimited conversations & users",
      "Dedicated account manager",
      "Custom AI model training",
      "Premium API access & webhooks",
    ],
    stripePriceIdMonthly: "price_1RyxUsFS3P7wS29bjiaTZag4",
    stripePriceIdYearly: "price_1SRPh0FS3P7wS29bfAjG9QGZ",
  },
];

export const getPriceId = (planId: string, interval: "month" | "year") => {
  const plan = PRICING_PLANS.find((p) => p.id === planId);
  if (!plan) return null;
  return interval === "year" ? plan.stripePriceIdYearly : plan.stripePriceIdMonthly;
};

export const getPlanFromPriceId = (priceId: string) => {
  for (const plan of PRICING_PLANS) {
    if (plan.stripePriceIdMonthly === priceId || plan.stripePriceIdYearly === priceId) {
      return plan.id;
    }
  }
  return "unknown";
};
