export type HistoricalChangelogItem = {
  area: string
  body?: string
  title: string
}

export type HistoricalChangelogRelease = {
  coverType: 'affiliate' | 'copier' | 'payments' | 'security'
  features: HistoricalChangelogItem[]
  fixes: HistoricalChangelogItem[]
  flagship?: {
    body: string
    label: string
    surface: 'affiliate' | 'copier'
    title: string
  }
  headline: string
  improvements: HistoricalChangelogItem[]
  kicker: string
  releaseDate: string
  slug: string
}

export const yourPropFirmChangelog: HistoricalChangelogRelease[] = [
  {
    coverType: 'affiliate',
    features: [
      {
        area: 'Affiliate',
        body: 'Custom commission rates, payout cycles, and thresholds per tier, with auto-promotion rules.',
        title: 'Affiliate Tier System',
      },
      {
        area: 'Affiliate',
        body: 'Affiliates now go through the same verification gate as traders before first payout.',
        title: 'Payout Verification (KYC)',
      },
      {
        area: 'Programs',
        body: 'Rule-based restrictions on who can buy which account, by country, verification status, or prior-account history.',
        title: 'Program Restrictions',
      },
    ],
    fixes: [
      {
        area: 'Affiliate',
        title: 'Affiliate links now track correctly across all referrer edge cases',
      },
      { area: 'Programs', title: 'UI inconsistencies in program creation settings resolved' },
      {
        area: 'Programs',
        title: 'Account restrictions now apply correctly in a rare ordering bug',
      },
    ],
    flagship: {
      body: 'Run multiple affiliate campaigns in parallel with their own landing URLs, payout rules, tier overrides, and restrictions, without forking the whole affiliate program. Operators can freeze, swap, or retire a campaign without rebuilding links.',
      label: 'The big one',
      surface: 'affiliate',
      title: 'Affiliate Campaign Management',
    },
    headline: 'Affiliate rebuild: campaigns, tiers, and payout verification.',
    improvements: [
      { area: 'Checkout', title: 'Add-ons selection UI redesigned for clarity' },
      { area: 'Affiliate', title: 'Referral link section: clearer visibility, one-click copy' },
      { area: 'Programs', title: 'Tooltip and helper copy rewritten across program setup' },
      {
        area: 'Affiliate',
        title: 'Campaign activate / deactivate now confirms before applying',
      },
    ],
    kicker:
      'Affiliate programs ship as a first-class surface this month. Campaigns replace the old single-link model, tier rules are fully configurable, and payouts to affiliates now carry the same KYC rails as trader payouts.',
    releaseDate: '2026-03-18',
    slug: 'r-2026-03-18',
  },
  {
    coverType: 'copier',
    features: [
      { area: 'Trader', title: 'Multi-account dashboard with aggregated P&L' },
      { area: 'Trader', title: 'Custom notification preferences per trading account' },
    ],
    fixes: [
      { area: 'Risk', title: 'Drawdown calculation on weekend rollovers' },
      { area: 'Trader', title: 'Session timeout now redirects to login' },
      { area: 'Trader', title: 'CSV export of trade history includes header row' },
    ],
    flagship: {
      body: 'Funded traders can mirror trades across their accounts in real time, the same engine that powers our internal risk copier, exposed safely to end users with per-account caps.',
      label: 'Shipping',
      surface: 'copier',
      title: 'Real-time trade copier',
    },
    headline: 'Trader dashboard: copier, multi-account view, custom notifications.',
    improvements: [
      { area: 'Trader', title: 'Account overview cards redesigned, clearer metrics display' },
      { area: 'Trader', title: 'Trade history tables: pagination performance' },
      { area: 'Trader', title: 'Dark mode contrast improved across all dashboard pages' },
    ],
    kicker:
      'Real-time trade copying and a proper multi-account surface land in the trader dashboard. Your funded traders can now view, manage, and be notified on every account they hold, from one screen.',
    releaseDate: '2026-02-10',
    slug: 'r-2026-02-10',
  },
  {
    coverType: 'security',
    features: [
      { area: 'Security', title: 'Two-factor authentication via authenticator app' },
      { area: 'Trader', title: 'Leaderboard rankings for funded traders' },
      { area: 'Trader', title: 'Equity curve chart with customizable timeframes' },
    ],
    fixes: [
      { area: 'Payouts', title: 'Payout request form now validates minimum amount' },
      { area: 'Trader', title: 'Chart rendering glitch on Safari' },
      { area: 'Locale', title: 'Email notifications no longer sent in wrong language' },
    ],
    headline: 'Security, leaderboards, and a 35% faster dashboard.',
    improvements: [
      { area: 'Performance', title: 'Dashboard initial load time reduced by 35%' },
      { area: 'Locale', title: 'Trading terminology translations for 5 new locales' },
      { area: 'Trader', title: 'Mobile responsiveness on account management pages' },
    ],
    kicker:
      '2FA via authenticator app, a funded-trader leaderboard, and a full pass on dashboard initial-load performance. This release focused on the surfaces operators and traders see every day.',
    releaseDate: '2026-01-15',
    slug: 'r-2026-01-15',
  },
  {
    coverType: 'payments',
    features: [
      { area: 'Payouts', title: 'Support for multiple payment gateways' },
      { area: 'Trader', title: 'AI-powered trade journal with automated insights' },
      {
        area: 'Programs',
        title: 'Challenge progress tracker with milestone notifications',
      },
    ],
    fixes: [
      { area: 'Trader', title: 'Timezone display in trade history normalized' },
      { area: 'Payouts', title: 'Duplicate email notifications on payout approvals resolved' },
      { area: 'Trader', title: 'Pagination on mobile devices restored' },
    ],
    headline: 'Multi-gateway payments and an AI-powered trade journal.',
    improvements: [
      { area: 'Trader', title: 'Onboarding flow streamlined for new traders' },
      { area: 'Programs', title: 'Form validation error messages rewritten' },
      { area: 'Trader', title: 'Table sorting and filtering performance' },
    ],
    kicker:
      'We closed the year by expanding payment gateway support, launching an AI-assisted trade journal for traders, and adding milestone-based progress tracking to challenges.',
    releaseDate: '2025-12-20',
    slug: 'r-2025-12-20',
  },
]
