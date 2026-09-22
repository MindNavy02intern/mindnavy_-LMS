// Instructor "My Earnings" domain types — source of truth:
// backend/src/services/instructorEarnings.service.js.
// Every amount is a real, live-computed value — genuinely $0 until a payment
// gateway is connected (documented truthful zero, not a bug).

export interface MyEarningsSummary {
  lifetimeEarnings:    number;
  pendingPayout:       number;
  lastPayoutDate:      string | null;
  revenueSharePercent: number | null;
  currency:            string;
}

export type PayoutStatus = 'PENDING' | 'APPROVED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'HELD';

export interface MyPayoutRow {
  id:              string;
  amount:          number;
  currency:        string;
  status:          PayoutStatus;
  revenueShareBps: number;
  periodStart:     string;
  periodEnd:       string;
  approvedAt:      string | null;
  completedAt:     string | null;
  createdAt:       string;
}

export interface Pagination {
  total: number;
  page:  number;
  limit: number;
  pages: number;
}

export interface ListMyPayoutsResult {
  payouts:    MyPayoutRow[];
  pagination: Pagination;
}
