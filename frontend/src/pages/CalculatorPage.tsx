import type { Dispatch, SetStateAction } from 'react'

import type { RealEstateAppreciationResponse, VehicleValueResponse } from '../api'

type CalcCategory = 'Real Estate' | 'Car' | 'Tech' | 'Other'
type CalcPayMode = 'cash' | 'loan'
type CalcPlanMode = 'term' | 'affordable'
type HorizonYears = 5 | 10 | 15

type CalcResult =
  | {
      status: 'Safe' | 'Risky' | 'Not recommended' | 'Impossible'
      tips: string[]
      value: {
        valueToday: number
        valueAtHorizon: number
        horizonYears: number
      }
      loan: {
        payment: number
        totalPaid: number
        interestPaid: number
        termMonths: number
        downPayment?: number
      }
    }
  | null

type Props = {
  calcPrice: string
  setCalcPrice: Dispatch<SetStateAction<string>>
  calcCategory: CalcCategory
  setCalcCategory: Dispatch<SetStateAction<CalcCategory>>

  calcItemName: string
  setCalcItemName: Dispatch<SetStateAction<string>>

  calcMake: string
  setCalcMake: Dispatch<SetStateAction<string>>
  calcModel: string
  setCalcModel: Dispatch<SetStateAction<string>>
  calcYear: string
  setCalcYear: Dispatch<SetStateAction<string>>

  reZip: string
  setReZip: Dispatch<SetStateAction<string>>
  reCity: string
  setReCity: Dispatch<SetStateAction<string>>
  reState: string
  setReState: Dispatch<SetStateAction<string>>
  reType: '' | 'House' | 'Apartment'
  setReType: Dispatch<SetStateAction<'' | 'House' | 'Apartment'>>
  reSqft: string
  setReSqft: Dispatch<SetStateAction<string>>
  reBedrooms: string
  setReBedrooms: Dispatch<SetStateAction<string>>
  reBathrooms: string
  setReBathrooms: Dispatch<SetStateAction<string>>
  reTxCostPct: string
  setReTxCostPct: Dispatch<SetStateAction<string>>
  reApp: RealEstateAppreciationResponse | null
  reAppLoading: boolean

  calcPayMode: CalcPayMode
  setCalcPayMode: Dispatch<SetStateAction<CalcPayMode>>

  calcDownPayment: string
  setCalcDownPayment: Dispatch<SetStateAction<string>>
  calcApr: string
  setCalcApr: Dispatch<SetStateAction<string>>

  calcPlanMode: CalcPlanMode
  setCalcPlanMode: Dispatch<SetStateAction<CalcPlanMode>>

  calcTermMonthsText: string
  setCalcTermMonthsText: Dispatch<SetStateAction<string>>
  calcTermMonths: number
  setCalcTermMonths: Dispatch<SetStateAction<number>>

  calcAffordablePayment: string
  setCalcAffordablePayment: Dispatch<SetStateAction<string>>

  calcHorizonYears: number
  setCalcHorizonYears: Dispatch<SetStateAction<HorizonYears>>

  calcIncome: string
  setCalcIncome: Dispatch<SetStateAction<string>>
  setCalcIncomeTouched: Dispatch<SetStateAction<boolean>>

  calcExpenses: string
  setCalcExpenses: Dispatch<SetStateAction<string>>
  setCalcExpensesTouched: Dispatch<SetStateAction<boolean>>

  calcDebtBalance: number

  onCalculate: () => void | Promise<void>
  calcLoading: boolean
  calcError: string

  calcResult: CalcResult
  vehVal: VehicleValueResponse | null

  fmtMoney: (v: number) => string
  purchaseName: (x: {
    category: CalcCategory
    itemName: string
    make: string
    model: string
    year: string
    reCity: string
    reState: string
    reZip: string
  }) => string
  fmtHorizonDuration: (years: number) => string
  metricValueFontSizePx: (value: string) => number
}

function PurchaseSection(props: Pick<Props, 'calcPrice' | 'setCalcPrice' | 'calcCategory' | 'setCalcCategory' | 'calcItemName' | 'setCalcItemName' | 'calcMake' | 'setCalcMake' | 'calcModel' | 'setCalcModel' | 'calcYear' | 'setCalcYear'>) {
  const {
    calcPrice,
    setCalcPrice,
    calcCategory,
    setCalcCategory,
    calcItemName,
    setCalcItemName,
    calcMake,
    setCalcMake,
    calcModel,
    setCalcModel,
    calcYear,
    setCalcYear,
  } = props

  return (
    <>
      <div className="panelTitle calcPanelTitleBig">What are you buying?</div>
      <div className="toolbar">
        <div className="field" style={{ flex: 1, minWidth: 180 }}>
          <div className="label">Price</div>
          <input className="input" value={calcPrice} onChange={(e) => setCalcPrice(e.target.value)} placeholder="$" />
        </div>
        <div className="field" style={{ flex: 1, minWidth: 180 }}>
          <div className="label">Category</div>
          <select className="select" value={calcCategory} onChange={(e) => setCalcCategory(e.target.value as CalcCategory)}>
            <option value="Real Estate">Real Estate</option>
            <option value="Car">Vehicle</option>
            <option value="Tech">Tech</option>
            <option value="Other">Other</option>
          </select>
        </div>
      </div>
      <div style={{ height: 10 }} />

      {calcCategory === 'Tech' || calcCategory === 'Other' ? (
        <div className="toolbar">
          <div className="field" style={{ flex: 1, minWidth: 180 }}>
            <div className="label">Name</div>
            <input className="input" value={calcItemName} onChange={(e) => setCalcItemName(e.target.value)} placeholder="" />
          </div>
        </div>
      ) : null}

      {calcCategory === 'Car' ? (
        <div className="toolbar">
          <div className="field" style={{ flex: 1, minWidth: 180 }}>
            <div className="label">Make</div>
            <input className="input" value={calcMake} onChange={(e) => setCalcMake(e.target.value)} placeholder="" />
          </div>
          <div className="field" style={{ flex: 1, minWidth: 180 }}>
            <div className="label">Model</div>
            <input className="input" value={calcModel} onChange={(e) => setCalcModel(e.target.value)} placeholder="" />
          </div>
          <div className="field" style={{ width: 140 }}>
            <div className="label">Year</div>
            <input className="input" value={calcYear} onChange={(e) => setCalcYear(e.target.value)} placeholder="YYYY" />
          </div>
        </div>
      ) : null}
    </>
  )
}

function RealEstateSection(
  props: Pick<
    Props,
    | 'calcCategory'
    | 'reZip'
    | 'setReZip'
    | 'reCity'
    | 'setReCity'
    | 'reState'
    | 'setReState'
    | 'reType'
    | 'setReType'
    | 'reSqft'
    | 'setReSqft'
    | 'reBedrooms'
    | 'setReBedrooms'
    | 'reBathrooms'
    | 'setReBathrooms'
    | 'reTxCostPct'
    | 'setReTxCostPct'
    | 'reApp'
    | 'reAppLoading'
  >
) {
  const {
    calcCategory,
    reZip,
    setReZip,
    reCity,
    setReCity,
    reState,
    setReState,
    reType,
    setReType,
    reSqft,
    setReSqft,
    reBedrooms,
    setReBedrooms,
    reBathrooms,
    setReBathrooms,
    reTxCostPct,
    setReTxCostPct,
    reApp,
    reAppLoading,
  } = props

  if (calcCategory !== 'Real Estate') return null

  return (
    <>
      <div style={{ height: 14 }} />
      <div className="panelTitle">Real Estate details</div>
      <div className="toolbar">
        <div className="field" style={{ width: 160 }}>
          <div className="label">ZIP</div>
          <input className="input" value={reZip} onChange={(e) => setReZip(e.target.value)} />
        </div>
        <div className="field" style={{ flex: 1, minWidth: 180 }}>
          <div className="label">City</div>
          <input className="input" value={reCity} onChange={(e) => setReCity(e.target.value)} />
        </div>
        <div className="field" style={{ width: 120 }}>
          <div className="label">State</div>
          <input className="input" value={reState} onChange={(e) => setReState(e.target.value)} />
        </div>
      </div>

      <div style={{ height: 10 }} />
      <div className="toolbar">
        <div className="field" style={{ width: 180 }}>
          <div className="label">Property type</div>
          <select className="select" value={reType} onChange={(e) => setReType(e.target.value as 'House' | 'Apartment')}>
            <option value="House">House</option>
            <option value="Apartment">Apartment</option>
          </select>
        </div>
        <div className="field" style={{ width: 140 }}>
          <div className="label">Sqft</div>
          <input className="input" value={reSqft} onChange={(e) => setReSqft(e.target.value)} />
        </div>
        <div className="field" style={{ width: 140 }}>
          <div className="label">Bedrooms</div>
          <input className="input" value={reBedrooms} onChange={(e) => setReBedrooms(e.target.value)} />
        </div>
        <div className="field" style={{ width: 140 }}>
          <div className="label">Bathrooms</div>
          <input className="input" value={reBathrooms} onChange={(e) => setReBathrooms(e.target.value)} />
        </div>
      </div>

      <div style={{ height: 10 }} />
      <div className="toolbar">
        <div className="field" style={{ width: 220 }}>
          <div className="label">Transaction costs (%)</div>
          <input className="input" value={reTxCostPct} onChange={(e) => setReTxCostPct(e.target.value)} />
        </div>
        <div className="field" style={{ flex: 1, minWidth: 220 }}>
          <div className="label">Gemini (5y appreciation)</div>
          <div className="muted">
            {reAppLoading
              ? 'Loading…'
              : reApp?.ok
                ? `${reApp.appreciation_5y_pct.toFixed(1)}% (${reApp.source})`
                : reApp?.error
                  ? `Fallback (${reApp.error})`
                  : 'Will fetch on Calculate'}
          </div>
        </div>
      </div>
    </>
  )
}

function PaymentSection(
  props: Pick<
    Props,
    | 'calcPayMode'
    | 'setCalcPayMode'
    | 'calcDownPayment'
    | 'setCalcDownPayment'
    | 'calcApr'
    | 'setCalcApr'
    | 'calcPlanMode'
    | 'setCalcPlanMode'
    | 'calcTermMonthsText'
    | 'setCalcTermMonthsText'
    | 'setCalcTermMonths'
    | 'calcAffordablePayment'
    | 'setCalcAffordablePayment'
    | 'calcHorizonYears'
    | 'setCalcHorizonYears'
  >
) {
  const {
    calcPayMode,
    setCalcPayMode,
    calcDownPayment,
    setCalcDownPayment,
    calcApr,
    setCalcApr,
    calcPlanMode,
    setCalcPlanMode,
    calcTermMonthsText,
    setCalcTermMonthsText,
    setCalcTermMonths,
    calcAffordablePayment,
    setCalcAffordablePayment,
    calcHorizonYears,
    setCalcHorizonYears,
  } = props

  return (
    <>
      <div style={{ height: 14 }} />
      <div className="panelTitle">How do you want to pay?</div>
      <div className="segmented">
        <button type="button" className={`segButton ${calcPayMode === 'cash' ? 'segButtonActive' : ''}`} onClick={() => setCalcPayMode('cash')}>
          Pay in full
        </button>
        <button type="button" className={`segButton ${calcPayMode === 'loan' ? 'segButtonActive' : ''}`} onClick={() => setCalcPayMode('loan')}>
          Get a loan
        </button>
      </div>

      {calcPayMode === 'loan' ? (
        <>
          <div style={{ height: 12 }} />
          <div className="panelTitle">Loan details</div>
          <div className="toolbar">
            <div className="field" style={{ flex: 1, minWidth: 180 }}>
              <div className="label">Down payment</div>
              <input className="input" value={calcDownPayment} onChange={(e) => setCalcDownPayment(e.target.value)} />
            </div>
            <div className="field" style={{ flex: 1, minWidth: 180 }}>
              <div className="label">APR</div>
              <input className="input" value={calcApr} onChange={(e) => setCalcApr(e.target.value)} />
            </div>
          </div>

          <div style={{ height: 10 }} />
          <div className="segmented">
            <button type="button" className={`segButton ${calcPlanMode === 'term' ? 'segButtonActive' : ''}`} onClick={() => setCalcPlanMode('term')}>
              Choose term
            </button>
            <button type="button" className={`segButton ${calcPlanMode === 'affordable' ? 'segButtonActive' : ''}`} onClick={() => setCalcPlanMode('affordable')}>
              Monthly payment
            </button>
          </div>

          <div style={{ height: 10 }} />
          {calcPlanMode === 'term' ? (
            <div className="field" style={{ width: 220 }}>
              <div className="label">Term (months)</div>
              <input
                className="input"
                value={calcTermMonthsText}
                onChange={(e) => {
                  const v = e.target.value
                  setCalcTermMonthsText(v)
                  if (v.trim() === '') {
                    setCalcTermMonths(0)
                    return
                  }
                  const raw = Number(v)
                  if (!Number.isFinite(raw)) return
                  const n = Math.max(1, Math.min(600, Math.round(raw)))
                  setCalcTermMonths(n)
                }}
                inputMode="numeric"
              />
            </div>
          ) : (
            <div className="field" style={{ width: 320 }}>
              <div className="label">Affordable payment ($/month)</div>
              <input className="input" value={calcAffordablePayment} onChange={(e) => setCalcAffordablePayment(e.target.value)} placeholder="$" />
            </div>
          )}
        </>
      ) : (
        <>
          <div style={{ height: 12 }} />
          <div className="panelTitle">True cost horizon</div>
          <div className="pillRow">
            <button type="button" className={`pillButton ${calcHorizonYears === 5 ? 'pillButtonActive' : ''}`} onClick={() => setCalcHorizonYears(5)}>
              5 years
            </button>
            <button type="button" className={`pillButton ${calcHorizonYears === 10 ? 'pillButtonActive' : ''}`} onClick={() => setCalcHorizonYears(10)}>
              10 years
            </button>
            <button type="button" className={`pillButton ${calcHorizonYears === 15 ? 'pillButtonActive' : ''}`} onClick={() => setCalcHorizonYears(15)}>
              15 years
            </button>
          </div>
        </>
      )}
    </>
  )
}

function FinancesSection(
  props: Pick<
    Props,
    | 'calcIncome'
    | 'setCalcIncome'
    | 'setCalcIncomeTouched'
    | 'calcExpenses'
    | 'setCalcExpenses'
    | 'setCalcExpensesTouched'
    | 'calcDebtBalance'
    | 'fmtMoney'
  >
) {
  const { calcIncome, setCalcIncome, setCalcIncomeTouched, calcExpenses, setCalcExpenses, setCalcExpensesTouched, calcDebtBalance, fmtMoney } = props

  return (
    <>
      <div style={{ height: 14 }} />
      <div className="panelTitle">Your finances</div>
      <div className="toolbar">
        <div className="field" style={{ flex: 1, minWidth: 180 }}>
          <div className="label">Monthly income</div>
          <input
            className="input"
            value={calcIncome}
            onChange={(e) => {
              setCalcIncomeTouched(true)
              setCalcIncome(e.target.value)
            }}
          />
        </div>
        <div className="field" style={{ flex: 1, minWidth: 180 }}>
          <div className="label">Monthly expenses</div>
          <input
            className="input"
            value={calcExpenses}
            onChange={(e) => {
              setCalcExpensesTouched(true)
              setCalcExpenses(e.target.value)
            }}
          />
        </div>
      </div>

      <div style={{ height: 10 }} />
      <div className="toolbar">
        <div className="field" style={{ flex: 1, minWidth: 180 }}>
          <div className="label">Current debt (from accounts)</div>
          <input className="input" value={fmtMoney(calcDebtBalance)} readOnly />
        </div>
      </div>
    </>
  )
}

function ResultsPanel(
  props: Pick<
    Props,
    | 'calcResult'
    | 'calcPayMode'
    | 'calcCategory'
    | 'calcItemName'
    | 'calcMake'
    | 'calcModel'
    | 'calcYear'
    | 'reCity'
    | 'reState'
    | 'reZip'
    | 'fmtMoney'
    | 'purchaseName'
    | 'fmtHorizonDuration'
    | 'metricValueFontSizePx'
  >
) {
  const {
    calcResult,
    calcPayMode,
    calcCategory,
    calcItemName,
    calcMake,
    calcModel,
    calcYear,
    reCity,
    reState,
    reZip,
    fmtMoney,
    purchaseName,
    fmtHorizonDuration,
    metricValueFontSizePx,
  } = props

  return (
    <div
      className={`calcResultsShell ${
        calcResult?.status === 'Safe'
          ? 'calcResultsShell--safe'
          : calcResult?.status === 'Risky'
            ? 'calcResultsShell--risky'
            : calcResult?.status === 'Impossible'
              ? 'calcResultsShell--impossible'
              : calcResult?.status === 'Not recommended'
                ? 'calcResultsShell--notrec'
                : ''
      }`}
    >
      {!calcResult ? (
        <div className="muted">Fill the inputs and press Calculate.</div>
      ) : (
        <>
          <div className="calcResultsHeader">
            <div className="calcResultsTitle">
              {calcResult.status === 'Safe'
                ? 'You can afford this!'
                : calcResult.status === 'Risky'
                  ? 'This is risky'
                  : calcResult.status === 'Impossible'
                    ? 'Impossible'
                    : 'Not recommended'}
            </div>
            <div className="calcResultsSub">
              {calcResult.status === 'Safe'
                ? 'Your finances looks good for this purchase'
                : calcResult.status === 'Risky'
                  ? 'Your buffer is tight for this purchase'
                  : calcResult.status === 'Impossible'
                    ? 'This payment will not pay off the loan'
                    : 'This purchase will likely strain your budget'}
            </div>
            <div className="calcResultsMeta">
              {purchaseName({
                category: calcCategory,
                itemName: calcItemName,
                make: calcMake,
                model: calcModel,
                year: calcYear,
                reCity,
                reState,
                reZip,
              })}
            </div>
          </div>

          {calcPayMode === 'loan' ? (
            <div className="calcMetricsStrip">
              {(() => {
                const sMonthly = fmtMoney(calcResult.loan.payment)
                const sTotal = fmtMoney(calcResult.loan.totalPaid + (calcResult.loan.downPayment || 0))
                const sInterest = fmtMoney(calcResult.loan.interestPaid)
                const sMonths = String(calcResult.loan.termMonths)
                const fontSize = metricValueFontSizePx([sMonthly, sTotal, sInterest, sMonths].reduce((a, b) => (a.length >= b.length ? a : b), ''))

                return (
                  <>
                    <div className="calcMetric">
                      <div className="calcMetricLabel">Monthly Payment</div>
                      <div className="calcMetricValue" style={{ fontSize }}>
                        {sMonthly}
                      </div>
                    </div>
                    <div className="calcMetric">
                      <div className="calcMetricLabel">Total Paid</div>
                      <div className="calcMetricValue" style={{ fontSize }}>
                        {sTotal}
                      </div>
                    </div>
                    <div className="calcMetric">
                      <div className="calcMetricLabel">Interest</div>
                      <div className="calcMetricValue" style={{ fontSize }}>
                        {sInterest}
                      </div>
                    </div>
                    <div className="calcMetric">
                      <div className="calcMetricLabel">Months to pay</div>
                      <div className="calcMetricValue" style={{ fontSize }}>
                        {sMonths}
                      </div>
                    </div>
                  </>
                )
              })()}
            </div>
          ) : null}

          <div className="calcInnerCard">
            <div className="panelTitle calcPanelTitleMedium">Value Analysis</div>
            <div className="dashRow" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="stat">
                <div className="muted">Value today</div>
                <div className="statValue">{fmtMoney(calcResult.value.valueToday)}</div>
              </div>
              <div className="stat">
                <div className="muted">At horizon</div>
                <div className="statValue">{fmtMoney(calcResult.value.valueAtHorizon)}</div>
                <div className="muted">{fmtHorizonDuration(calcResult.value.horizonYears)}</div>
              </div>
            </div>
          </div>

          <div className="calcInnerCard">
            <div className="panelTitle calcPanelTitleMedium">Smart Tips</div>
            <div className="muted" style={{ marginBottom: 10 }}>
              See More Tips
            </div>
            <div className="list">
              {calcResult.tips.map((x, idx) => (
                <div key={idx} className="item" style={{ justifyContent: 'flex-start' }}>
                  <div style={{ fontSize: 13 }}>{x}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default function CalculatorPage(props: Props) {
  const {
    calcPrice,
    setCalcPrice,
    calcCategory,
    setCalcCategory,
    calcItemName,
    setCalcItemName,
    calcMake,
    setCalcMake,
    calcModel,
    setCalcModel,
    calcYear,
    setCalcYear,
    reZip,
    setReZip,
    reCity,
    setReCity,
    reState,
    setReState,
    reType,
    setReType,
    reSqft,
    setReSqft,
    reBedrooms,
    setReBedrooms,
    reBathrooms,
    setReBathrooms,
    reTxCostPct,
    setReTxCostPct,
    reApp,
    reAppLoading,
    calcPayMode,
    setCalcPayMode,
    calcDownPayment,
    setCalcDownPayment,
    calcApr,
    setCalcApr,
    calcPlanMode,
    setCalcPlanMode,
    calcTermMonthsText,
    setCalcTermMonthsText,
    setCalcTermMonths,
    calcAffordablePayment,
    setCalcAffordablePayment,
    calcHorizonYears,
    setCalcHorizonYears,
    calcIncome,
    setCalcIncome,
    setCalcIncomeTouched,
    calcExpenses,
    setCalcExpenses,
    setCalcExpensesTouched,
    calcDebtBalance,
    onCalculate,
    calcLoading,
    calcError,
    calcResult,
    fmtMoney,
    purchaseName,
    fmtHorizonDuration,
    metricValueFontSizePx,
  } = props

  return (
    <div className="calcPage">
      <div className="calcHeader">
        <div className="calcHeaderLeft">
          <div className="calcHeaderTitle">Loan Calculator</div>
        </div>
      </div>

      <div className="calcGrid">
        <div className="card">
          <PurchaseSection
            calcPrice={calcPrice}
            setCalcPrice={setCalcPrice}
            calcCategory={calcCategory}
            setCalcCategory={setCalcCategory}
            calcItemName={calcItemName}
            setCalcItemName={setCalcItemName}
            calcMake={calcMake}
            setCalcMake={setCalcMake}
            calcModel={calcModel}
            setCalcModel={setCalcModel}
            calcYear={calcYear}
            setCalcYear={setCalcYear}
          />

          <RealEstateSection
            calcCategory={calcCategory}
            reZip={reZip}
            setReZip={setReZip}
            reCity={reCity}
            setReCity={setReCity}
            reState={reState}
            setReState={setReState}
            reType={reType}
            setReType={setReType}
            reSqft={reSqft}
            setReSqft={setReSqft}
            reBedrooms={reBedrooms}
            setReBedrooms={setReBedrooms}
            reBathrooms={reBathrooms}
            setReBathrooms={setReBathrooms}
            reTxCostPct={reTxCostPct}
            setReTxCostPct={setReTxCostPct}
            reApp={reApp}
            reAppLoading={reAppLoading}
          />

          <PaymentSection
            calcPayMode={calcPayMode}
            setCalcPayMode={setCalcPayMode}
            calcDownPayment={calcDownPayment}
            setCalcDownPayment={setCalcDownPayment}
            calcApr={calcApr}
            setCalcApr={setCalcApr}
            calcPlanMode={calcPlanMode}
            setCalcPlanMode={setCalcPlanMode}
            calcTermMonthsText={calcTermMonthsText}
            setCalcTermMonthsText={setCalcTermMonthsText}
            setCalcTermMonths={setCalcTermMonths}
            calcAffordablePayment={calcAffordablePayment}
            setCalcAffordablePayment={setCalcAffordablePayment}
            calcHorizonYears={calcHorizonYears}
            setCalcHorizonYears={setCalcHorizonYears}
          />

          <FinancesSection
            calcIncome={calcIncome}
            setCalcIncome={setCalcIncome}
            setCalcIncomeTouched={setCalcIncomeTouched}
            calcExpenses={calcExpenses}
            setCalcExpenses={setCalcExpenses}
            setCalcExpensesTouched={setCalcExpensesTouched}
            calcDebtBalance={calcDebtBalance}
            fmtMoney={fmtMoney}
          />

          <div style={{ height: 14 }} />
          <button className="button calcButtonWide" type="button" disabled={calcLoading} onClick={onCalculate}>
            Calculate
          </button>

          {calcLoading ? <div className="muted" style={{ marginTop: 10 }}>Loading…</div> : null}
          {calcError ? <div className="error">{calcError}</div> : null}
        </div>

        <ResultsPanel
          calcResult={calcResult}
          calcPayMode={calcPayMode}
          calcCategory={calcCategory}
          calcItemName={calcItemName}
          calcMake={calcMake}
          calcModel={calcModel}
          calcYear={calcYear}
          reCity={reCity}
          reState={reState}
          reZip={reZip}
          fmtMoney={fmtMoney}
          purchaseName={purchaseName}
          fmtHorizonDuration={fmtHorizonDuration}
          metricValueFontSizePx={metricValueFontSizePx}
        />
      </div>
    </div>
  )
}
