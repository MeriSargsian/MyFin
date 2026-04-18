import type { Account, Category } from '../../api'

type Props = {
  title?: string
  accounts: Account[]
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
  arcPath: (cx: number, cy: number, r: number, startAngle: number, endAngle: number) => string
}

export default function MonthlySpendingsCard({
  title = 'Monthly Spendings',
  accounts,
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
  arcPath,
}: Props) {
  return (
    <div className="card">
      <div className="panelTitle">{title}</div>
      <div className="dashRow">
        <div className="stat">
          <div className="muted">Monthly Income</div>
          <div className="statValue">{fmtMoney(dashTotals.income)}</div>
          <div style={{ height: 10 }} />
          <div className="muted">Total Monthly Spendings</div>
          <div className="statValue">{fmtMoney(dashTotals.expense)}</div>
          <div style={{ height: 14 }} />
          <div className="field">
            <select
              className="select pillSelect"
              value={dashAccount === '' ? '' : String(dashAccount)}
              onChange={(e) => onChangeDashAccount(e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">All Accounts</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <select
              className="select pillSelect"
              value={dashCategory === '' ? '' : String(dashCategory)}
              onChange={(e) => onChangeDashCategory(e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">All Categories</option>
              {dashCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {catsLoading ? <div className="muted">Loading...</div> : null}
            {catsError ? <div className="error">{catsError}</div> : null}
          </div>
          <div className="field">
            <select className="select pillSelect" value={dashPeriod} onChange={(e) => onChangeDashPeriod(e.target.value as any)}>
              <option value="7d">7 Days</option>
              <option value="1m">1 Month</option>
              <option value="3m">3 Months</option>
              <option value="6m">6 Months</option>
              <option value="1y">1 Year</option>
            </select>
          </div>
        </div>

        <div>
          {dashLoading ? <div className="muted">Loading...</div> : null}
          {dashError ? <div className="error">{dashError}</div> : null}

          {pie.total > 0 ? (
            <div className="pieWrap">
              <svg width="220" height="220" viewBox="0 0 220 220" aria-label="Monthly spendings pie">
                {pie.slices.length === 1 ? (
                  <circle cx="110" cy="110" r="92" fill={pie.slices[0]!.color} />
                ) : (
                  pie.slices.map((s) => <path key={s.label} d={arcPath(110, 110, 92, s.a0, s.a1)} fill={s.color} />)
                )}
                <circle cx="110" cy="110" r="52" fill="#fff" />
                <text x="110" y="106" textAnchor="middle" fontSize="12" fill="#6b7280">
                  Total
                </text>
                <text x="110" y="128" textAnchor="middle" fontSize="14" fontWeight="700" fill="#111827">
                  {fmtMoney(pie.total)}
                </text>
              </svg>
              <div className="legend">
                {pie.slices.map((s) => (
                  <div key={s.label} className="legendItem">
                    <span className="legendLeft">
                      <span className="swatch" style={{ background: s.color }} />
                      <span className="truncate">{s.label}</span>
                    </span>
                    <span className="muted">{fmtMoney(s.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="muted">No expenses for selected period</div>
          )}
        </div>
      </div>
    </div>
  )
}
