import type { Account } from '../../api'

type Props = {
  accounts: Account[]
  accountsLoading: boolean
  accountsError: string
  dashNet: number
  fmtMoney: (v: number) => string
  accountTypeLabel: (type: string, brand: string) => string
}

export default function BalanceCard({ accounts, accountsLoading, accountsError, dashNet, fmtMoney, accountTypeLabel }: Props) {
  return (
    <div className="balanceCard">
      <div className="balanceHeader">
        <div className="balanceLabel">BALANCE</div>
        <div className="balanceValue">{fmtMoney(dashNet)}</div>
      </div>
      <div className="balanceBody">
        {accountsLoading ? <div className="muted">Loading...</div> : null}
        {accountsError ? <div className="error">{accountsError}</div> : null}
        <div className="acctList">
          {accounts.map((a) => {
            const net = Number(a.balance)
            const typeLabel = accountTypeLabel(a.type, a.brand)
            const masked = a.last4 ? `**${a.last4}` : ''
            const line2 = `${masked}${masked ? ' | ' : ''}${a.name}`
            return (
              <div key={a.id} className="acctRow">
                <div>
                  <div className="acctType">{typeLabel}</div>
                  <div className="acctTitle">{line2}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <div className="acctAmount">{fmtMoney(net)}</div>
                </div>
              </div>
            )
          })}
        </div>
        <button type="button" className="addCardBtn">
          + Add a card
        </button>
      </div>
    </div>
  )
}
