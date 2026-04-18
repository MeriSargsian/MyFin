import type { Account, Category } from '../api'

import BalanceCard from './dashboard/BalanceCard'
import MonthlySpendingsCard from './dashboard/MonthlySpendingsCard'
import SubscriptionsCard from './dashboard/SubscriptionsCard'
import TrendsCard from './dashboard/TrendsCard'

type Props = {
  accounts: Account[]
  accountsLoading: boolean
  accountsError: string
  dashNet: number
  dashTotals: { income: number; expense: number }
  dashLoading: boolean
  dashError: string
  dashAccount: number | ''
  dashCategory: number | ''
  dashPeriod: '7d' | '1m' | '3m' | '6m' | '1y'
  dashCategories: Category[]
  catsLoading: boolean
  catsError: string
  onChangeDashAccount: (v: number | '') => void
  onChangeDashCategory: (v: number | '') => void
  onChangeDashPeriod: (v: Props['dashPeriod']) => void
  pie: { total: number; slices: Array<{ label: string; value: number; color: string; a0: number; a1: number }> }
  fmtMoney: (v: number) => string
  accountTypeLabel: (type: string, brand: string) => string
  subscriptions: Array<{
    merchant: string
    total: number
    count: number
    last: string
    cadenceDays: number
    cadenceType: 'monthly' | 'weekly'
    typicalAmount: number
    avgMonthly: number
    monthlyCost: number
  }>
  subsLoading: boolean
  subsError: string
  trendsMode: 'income' | 'spendings'
  trendsYear: number
  trendsYearsAvailable: number[]
  onChangeTrendsMode: (m: 'income' | 'spendings') => void
  onChangeTrendsYear: (y: number) => void
  trendsLoading: boolean
  trendsError: string
  monthly: {
    year: number
    income: number[]
    spendings: number[]
  }
  trendSeries: {
    max: number
  }
  trendsMetrics: {
    revenue: number
    expenses: number
    profit: number
    estimatedTaxes: number
    label: string
  }
  monthShort: (i: number) => string
  arcPath: (cx: number, cy: number, r: number, startAngle: number, endAngle: number) => string
}

export default function DashboardPage(props: Props) {
  const {
    accounts,
    accountsLoading,
    accountsError,
    dashNet,
    dashTotals,
    dashLoading,
    dashError,
    dashAccount,
    dashCategory,
    dashPeriod,
    dashCategories,
    catsLoading,
    catsError,
    onChangeDashAccount,
    onChangeDashCategory,
    onChangeDashPeriod,
    pie,
    fmtMoney,
    accountTypeLabel,
    subscriptions,
    subsLoading,
    subsError,
    trendsMode,
    trendsYear,
    trendsYearsAvailable,
    onChangeTrendsMode,
    onChangeTrendsYear,
    trendsLoading,
    trendsError,
    monthly,
    trendSeries,
    trendsMetrics,
    monthShort,
    arcPath,
  } = props

  return (
    <div className="dashPage">
      <h1>Dashboard</h1>
      <div className="grid">
        <div>
          <BalanceCard
            accounts={accounts}
            accountsLoading={accountsLoading}
            accountsError={accountsError}
            dashNet={dashNet}
            fmtMoney={fmtMoney}
            accountTypeLabel={accountTypeLabel}
          />
        </div>
        <div className="rightCol">
          <MonthlySpendingsCard
            accounts={accounts}
            dashTotals={dashTotals}
            dashLoading={dashLoading}
            dashError={dashError}
            dashAccount={dashAccount}
            dashCategory={dashCategory}
            dashPeriod={dashPeriod}
            dashCategories={dashCategories}
            catsLoading={catsLoading}
            catsError={catsError}
            onChangeDashAccount={onChangeDashAccount}
            onChangeDashCategory={onChangeDashCategory}
            onChangeDashPeriod={onChangeDashPeriod}
            pie={pie}
            fmtMoney={fmtMoney}
            arcPath={arcPath}
          />
        </div>
        <div className="thirdPanel">
          <TrendsCard
            trendsMode={trendsMode}
            trendsYear={trendsYear}
            trendsYearsAvailable={trendsYearsAvailable}
            onChangeTrendsMode={onChangeTrendsMode}
            onChangeTrendsYear={onChangeTrendsYear}
            trendsLoading={trendsLoading}
            trendsError={trendsError}
            monthly={monthly}
            trendSeries={trendSeries}
            trendsMetrics={trendsMetrics}
            monthShort={monthShort}
            fmtMoney={fmtMoney}
          />
        </div>
      </div>
      <SubscriptionsCard subscriptions={subscriptions} subsLoading={subsLoading} subsError={subsError} fmtMoney={fmtMoney} />

    </div>
  )
}
