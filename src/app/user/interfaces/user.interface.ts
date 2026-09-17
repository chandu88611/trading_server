export type DashboardTradeCounts = {
  active: number;
  closed: number;
  failed: number;
  total: number;
};

export type ReferralTreeNode = {
  id: number;
  name: string | null;
  createdAt: Date;
  email?: string;
  maskedEmail?: string;
};

export type ReferralUpline = ReferralTreeNode | null;

export type ReferralSummary = {
  user: {
    id: number;
    referralCode: string | null;
  };
  upline: {
    level1: ReferralUpline;
    level2: ReferralUpline;
  };
  counts: {
    level1: number;
    level2: number;
    total: number;
  };
  downline: {
    level1: ReferralTreeNode[];
    level2: ReferralTreeNode[];
  };
};

export type AdminUserListItem = {
  id: number;
  email: string;
  name: string | null;
  isEmailVerified: boolean;
  isActive: boolean;
  isAdmin: boolean;
  allowTrade: boolean;
  allowCopyTrade: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
  referralCode: string | null;
  referredByUserId: number | null;
  level1ReferralCount: number;
  level2ReferralCount: number;
};

export type UserSettingsTrade = {
  allowTrade: boolean;
};

export type UserSettingsCopyTrade = {
  allowCopyTrade: boolean;
};

export type UserSettingsEdging = {
  isEnabled: boolean;
  notes: string | null;
  updatedAt: Date;
};

export type UserSettingsRiskLimits = {
  configuration?: Record<string, any>;
  isEnabled: boolean;
  dailyLossLimit: number | null;
  dailyProfitTarget: number | null;
  maxTradesPerDay: number | null;
  cooldownAfterLossMins: number | null;
  updatedAt: Date;
};

export type AdminStrategyTradeScheduleWindow = {
  id: string;
  label: string | null;
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  isEnabled: boolean;
};

export type AdminStrategyTradeScheduleSettings = {
  isEnabled: boolean;
  timezone: string;
  windows: AdminStrategyTradeScheduleWindow[];
  updatedAt: Date;
};

export type AdminStrategyTradeScheduleEvaluation = {
  isBlocked: boolean;
  matchingWindowIds: string[];
  evaluatedAt: Date;
};

export type TradingSettingsAccount = {
  id: number;
  accountId: string;
  accountLabel: string | null;
  isEnabled: boolean;
  isMaster: boolean;
  status: string;
  lastVerifiedAt: Date | null;
  broker: {
    id: number;
    code: string;
    name: string;
    marketCategory: string;
  };
  subscription: {
    id: number | null;
    planId: number | null;
    planName: string | null;
    status: string | null;
  } | null;
};

export type UserSettingsWallet = {
  currency: "INR";
  totalEarned: number;
  pendingRewards: number;
  withdrawableAmount: number;
  lockedWithdrawalAmount: number;
  totalWithdrawn: number;
  minWithdrawalAmount: number;
  holdDays: number;
};

export type UserSettingsResponse = {
  trade: UserSettingsTrade;
  copyTrade: UserSettingsCopyTrade;
  edging: UserSettingsEdging;
  riskLimits: UserSettingsRiskLimits;
  wallet: UserSettingsWallet;
  accounts: TradingSettingsAccount[];
};

export type DashboardTradeCountRow = DashboardTradeCounts & {
  tradingAccountId: number;
};

export type DashboardSubscription = {
  id: number;
  userId: number;
  planId: number;
  status: string | null;
  autoRenew: boolean;
  executionEnabled: boolean;
  isWebhookEnabled: boolean;
  startDate: Date;
  endDate: Date | null;
  cancelAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  strategy: {
    instanceId: number;
    status: string;
    volume: number;
    definition: {
      id: number;
      strategyCode: string;
      name: string;
      isActive: boolean;
    };
    managedByAdminWebhook: true;
  } | null;
  plan: {
    id: number;
    name: string;
    description: string | null;
    isActive: boolean;
    market: {
      id: number;
      code: string;
      name: string;
    } | null;
    planType: {
      id: string;
      code: string;
      name: string;
    };
    pricing: {
      priceInr: number;
      currency: string;
      interval: string;
      isFree: boolean;
    } | null;
  };
};

export type DashboardAccount = {
  id: number;
  subscriptionId: number | null;
  accountId: string;
  accountLabel: string | null;
  isMaster: boolean;
  isEnabled: boolean;
  status: string;
  lastVerifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  broker: {
    id: number;
    code: string;
    name: string;
    marketCategory: string;
    isActive: boolean;
  };
  market: {
    code: string | null;
    name: string | null;
    brokerCategory: string | null;
  };
  subscription: {
    id: number | null;
    status: string | null;
    planId: number | null;
    planName: string | null;
  };
  tradeCounts: DashboardTradeCounts;
};

export type DashboardUserProfile = {
  id: number;
  email: string;
  name: string | null;
  isEmailVerified: boolean;
  isActive: boolean;
  isAdmin: boolean;
  allowTrade: boolean;
  allowCopyTrade: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
};

export type DashboardResponse = {
  message: "Dashboard fetched successfully";
  data: {
    user: DashboardUserProfile;
    stats: {
      trades: DashboardTradeCounts;
    };
    plans: {
      active: DashboardSubscription[];
      past: DashboardSubscription[];
    };
    accounts: DashboardAccount[];
  };
};
