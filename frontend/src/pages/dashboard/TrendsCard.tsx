type Props = {
  trendsMode: 'income' | 'spendings'
  trendsYear: number
  trendsYearsAvailable: number[]
  onChangeTrendsMode: (m: 'income' | 'spendings') => void
  onChangeTrendsYear: (y: number) => void
  trendsLoading: boolean
  trendsError: string
  monthly: { year: number; income: number[]; spendings: number[] }
  trendSeries: { max: number }
  trendsMetrics: { revenue: number; expenses: number; profit: number; estimatedTaxes: number; label: string }
  monthShort: (i: number) => string
  fmtMoney: (v: number) => string
}

export default function TrendsCard({
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
  fmtMoney,
}: Props) {
  return (
    <div className="card">
      <div className="panelTitle">Trends</div>
      <div className="trendTop">
        <div className="pillRow">
          <button
            type="button"
            className={`pillButton ${trendsMode === 'income' ? 'pillButtonActive' : ''}`}
            onClick={() => onChangeTrendsMode('income')}
          >
            Income
          </button>
          <button
            type="button"
            className={`pillButton ${trendsMode === 'spendings' ? 'pillButtonActive' : ''}`}
            onClick={() => onChangeTrendsMode('spendings')}
          >
            Spendings
          </button>
        </div>
        <select className="select pillSelect" value={String(trendsYear)} onChange={(e) => onChangeTrendsYear(Number(e.target.value))}>
          {(trendsYearsAvailable.length > 0 ? trendsYearsAvailable : [new Date().getFullYear()]).map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      {trendsLoading ? <div className="muted" style={{ marginTop: 10 }}>Loading...</div> : null}
      {trendsError ? <div className="error">{trendsError}</div> : null}

      <div className="chartBox">
        <svg width="100%" height="220" viewBox="0 0 760 220" aria-label="Trends chart">
          <rect x="0" y="0" width="760" height="220" fill="transparent" />
          {Array.from({ length: 5 }).map((_, i) => {
            const y = 20 + i * 40
            return <line key={i} x1="42" y1={y} x2="750" y2={y} stroke="rgba(17,24,39,0.08)" />
          })}

          {monthly.income.map((_, i) => {
            const x = 60 + i * 56
            const hIncome = (monthly.income[i] / trendSeries.max) * 160
            const hSpend = (monthly.spendings[i] / trendSeries.max) * 160
            const yIncome = 180 - hIncome
            const ySpend = 180 - hSpend
            return (
              <g key={i}>
                <rect x={x} y={yIncome} width={20} height={hIncome} rx={4} fill="#60a5fa" opacity={trendsMode === 'income' ? 0.95 : 0.35} />
                <rect x={x + 24} y={ySpend} width={20} height={hSpend} rx={4} fill="#a78bfa" opacity={trendsMode === 'spendings' ? 0.95 : 0.35} />
                <text x={x + 20} y={206} textAnchor="middle" fontSize="11" fill="rgba(17,24,39,0.55)">
                  {monthShort(i)}
                </text>
              </g>
            )
          })}
          <text x="42" y="16" fontSize="11" fill="rgba(17,24,39,0.55)">
            {monthly.year}
          </text>
        </svg>
      </div>

      <div className="dashRow trendMetrics">
        <div className="stat">
          <div className="muted">Revenue</div>
          <div className="statValue">{fmtMoney(trendsMetrics.revenue)}</div>
          <div className="muted">{trendsMetrics.label}</div>
        </div>
        <div className="stat">
          <div className="muted">Expenses</div>
          <div className="statValue">{fmtMoney(trendsMetrics.expenses)}</div>
          <div className="muted">{trendsMetrics.label}</div>
        </div>
        <div className="stat">
          <div className="muted">Profit</div>
          <div className="statValue">{fmtMoney(trendsMetrics.profit)}</div>
          <div className="muted">Revenue - Expenses</div>
        </div>
        <div className="stat">
          <div className="muted">Estimated Taxes</div>
          <div className="statValue">{fmtMoney(trendsMetrics.estimatedTaxes)}</div>
          <div className="muted">Est. tax liability</div>
        </div>
      </div>
    </div>
  )
}
