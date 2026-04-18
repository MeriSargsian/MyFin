type Props = {
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
  fmtMoney: (v: number) => string
}

export default function SubscriptionsCard({ subscriptions, subsLoading, subsError, fmtMoney }: Props) {
  return (
    <div className="card">
      <div className="panelTitle">Subscriptions</div>
      {subsLoading ? <div className="muted" style={{ marginTop: 10 }}>Loading...</div> : null}
      {subsError ? <div className="error">{subsError}</div> : null}
      {!subsLoading && !subsError ? (
        subscriptions.length > 0 ? (
          <div className="subscriptionsWrap">
            {subscriptions.map((s) => (
              <div key={s.merchant} className="subscriptionCard">
                <div className="subscriptionLeft">
                  <div className="subscriptionTitle">{s.merchant}</div>
                  <div className="muted">
                    {s.count} payments · {s.cadenceType} · ~{s.cadenceDays}d · Last: {s.last}
                  </div>
                </div>
                <div className="subscriptionMetrics">
                  <div className="subscriptionYearly">{fmtMoney(s.total)}</div>
                  <div className="muted">~{fmtMoney(s.monthlyCost)} / month</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="muted" style={{ marginTop: 10 }}>No recurring spendings found</div>
        )
      ) : null}
    </div>
  )
}
