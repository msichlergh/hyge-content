export type HistoricalChangelogItem = {
  area: string
  body?: string
  title: string
}

export type HistoricalChangelogRelease = {
  /** Committed image under src/seed/assets, uploaded to the tenant's media. */
  coverImage?: { alt: string; file: string }
  coverType: 'affiliate' | 'copier' | 'payments' | 'security'
  features: HistoricalChangelogItem[]
  fixes: HistoricalChangelogItem[]
  flagship?: {
    body: string
    label: string
    surface?: 'affiliate' | 'copier'
    title: string
  }
  headline: string
  improvements: HistoricalChangelogItem[]
  kicker?: string
  releaseDate: string
  slug: string
}

export const yourPropFirmChangelog: HistoricalChangelogRelease[] = [
  // Published from Linear (July–August 2026), imported for the changelog cutover.
  {
    coverType: 'security',
    features: [
      {
        area: 'Certificates',
        title: 'Manual Certificate Generation',
        body: 'Generate achievement and payout certificates on demand using templates, previews, and custom details.',
      },
      {
        area: 'Risk Controls',
        title: 'Trade Max Loss',
        body: 'Set floating-loss limits for individual open positions and monitor the rule directly in account statistics.',
      },
      {
        area: 'Webhook',
        title: 'Lifecycle Events',
        body: 'Use new order-created, order-updated, and birthday events to power more timely customer campaigns.',
      },
      {
        area: 'UI Design',
        title: 'Flexible Application Builder',
        body: 'Create multi-step forms with configurable text, date, country, number, radio-button, and checkbox fields.',
      },
    ],
    fixes: [],
    flagship: {
      body: 'Admins can now fully tailor the trader sidebar to match their brand and community needs. Add links, images, and sections; rename and reorder items; manage translations; and safely preview, publish, or restore changes.',
      label: 'Featured',
      title: 'Customizable Trader Navigation',
    },
    headline: 'Product updates - August 18, 2026',
    improvements: [
      {
        area: 'Account Resets',
        title: 'Program Selection',
        body: 'Route reset accounts to a chosen program instead of always returning them to their original program.',
      },
      {
        area: 'Admin Workspace',
        title: 'Personalized Tables',
        body: 'Customize table columns to focus daily workflows on the information most relevant to each user.',
      },
      {
        area: 'Affiliate Management',
        title: 'Referral Visibility',
        body: 'View referring-affiliate details directly from customer profiles.',
      },
    ],
    releaseDate: '2026-08-18',
    slug: 'r-2026-08-18',
  },
  {
    coverType: 'security',
    features: [
      {
        area: 'Accounts',
        title: 'Connection status view',
        body: 'See trade server connection status and past interruptions in one place, so you can spot and understand platform health issues quickly.',
      },
      {
        area: 'Accounts',
        title: 'Trader-initiated upgrades',
        body: 'Traders can now trigger an account upgrade themselves with a clear button, in addition to automatic upgrades, with new statuses shown across filters and tables.',
      },
      {
        area: 'Products',
        title: 'Reset-mode options',
        body: 'Program setup now includes a reset-mode selector and a new "reset only before payout" option, giving more control over how account resets work.',
      },
      {
        area: 'Admin',
        title: 'Export by email',
        body: 'Log and user data exports can now be delivered straight to your email, with a verification summary report available to download.',
      },
    ],
    fixes: [
      {
        area: 'Trading',
        title: 'Breach and profit accuracy',
        body: 'Corrected false breaches on non-trading weekends, rules that failed to breach as expected, and profit calculations affected by swap handling and held assets.',
      },
      {
        area: 'Payouts',
        title: 'Reliability issues',
        body: 'Resolved payout errors, eligible profit adjustments, account count discrepancies, and accounts showing outdated update times.',
      },
      {
        area: 'Platform',
        title: 'Stability under load',
        body: 'Fixed processing backlogs and update failures that could delay trade, balance, and profit updates during busy periods.',
      },
      {
        area: 'Checkout',
        title: 'Customer-facing polish',
        body: 'Fixed referral code use at checkout, cancelled-payment redirects, email content glitches, mobile language selector scrolling, and certificate date and character display.',
      },
    ],
    flagship: {
      body: 'This release makes the most important account actions far more reliable. Payout requests, approvals, upgrades, and reactivations now complete smoothly even when a trade server connection drops, so you are no longer left stuck partway through a critical action. A new connection status view adds live visibility into platform health, showing the current state and a history of any interruptions at a glance.',
      label: 'Featured',
      title: 'Payouts and accounts that keep working through connection issues',
    },
    headline: 'Product updates - August 2, 2026',
    improvements: [
      {
        area: 'Checkout',
        title: 'Faster, smoother checkout',
        body: 'Checkout pages now load faster through preloading and edge delivery, with expanded payment options for a more reliable buying experience.',
      },
      {
        area: 'Admin',
        title: 'Management page refinements',
        body: 'Roles, email templates, subscriptions, webhook logs, and certificate template pages were polished for smoother day-to-day use.',
      },
      {
        area: 'Trading Rules',
        title: 'Clearer objectives',
        body: 'Profit target rules now account for both balance and equity, and eligible trades appear in objectives even before a target is reached, making progress easier to follow.',
      },
      {
        area: 'Dashboard',
        title: 'Visual and navigation polish',
        body: 'Cleaner stats and balance graphs, logo-to-homepage linking, active-account redirect, and a tidier side navigation improve the everyday experience.',
      },
    ],
    releaseDate: '2026-08-14',
    slug: 'r-2026-08-14',
    coverImage: {
      alt: 'YourPropFirm Create Product screen with variants and sub-variants enabled, showing a 1 Step 5K product with per-platform price overrides',
      file: 'yourpropfirm/r-2026-08-14-cover.png',
    },
  },
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
