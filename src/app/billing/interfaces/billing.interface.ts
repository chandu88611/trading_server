import { WithdrawalRequestStatus } from "../../../entity/WithdrawalRequest";

export type BillingWalletSummary = {
  currency: "INR";
  totalEarned: number;
  pendingRewards: number;
  withdrawableAmount: number;
  lockedWithdrawalAmount: number;
  totalWithdrawn: number;
  minWithdrawalAmount: number;
  holdDays: number;
};

export type UserWithdrawalListItem = {
  id: number;
  amountInr: number;
  status: WithdrawalRequestStatus;
  adminReviewNotes: string | null;
  failureCode: string | null;
  failureDescription: string | null;
  createdAt: Date;
  updatedAt: Date;
  approvedAt: Date | null;
  rejectedAt: Date | null;
  queuedAt: Date | null;
  processedAt: Date | null;
  failedAt: Date | null;
  reversedAt: Date | null;
};

export type AdminWithdrawalListItem = UserWithdrawalListItem & {
  user: {
    id: number;
    email: string;
    name: string | null;
  };
};

export type WithdrawalSettingsResponse = {
  minWithdrawalAmountInr: number;
  holdDays: number;
};
