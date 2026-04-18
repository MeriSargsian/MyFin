import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  clearAuth,
  createAccount,
  deactivateAccount,
  getAccessToken,
  getMain,
  getRealEstateAppreciation,
  getVehicleValue,
  listCategories,
  listTransactions,
  login,
  setAccessToken,
  type Account,
  type Category,
  type RealEstateAppreciationResponse,
  type Transaction,
  type VehicleValueResponse,
} from './api'

function fmtMoney(v: number): string {
  const sign = v < 0 ? '-' : ''
  const abs = Math.abs(v)
  return `${sign}$${abs.toFixed(2)}`
}

function metricValueFontSizePx(s: string): number {
  const t = (s || '').trim()
  const len = t.length
  if (len <= 6) return 40
  if (len <= 8) return 36
  if (len <= 10) return 32
  if (len <= 12) return 28
  if (len <= 14) return 26
  return 24
}

function fmtYearsShort(y: number): string {
  if (!Number.isFinite(y)) return ''
  const rounded = Math.round(y)
  if (Math.abs(y - rounded) < 1e-9) return String(rounded)
  return y.toFixed(1)
}

function fmtHorizonDuration(y: number): string {
  if (!Number.isFinite(y) || y <= 0) return ''
  if (y < 1) {
    const m = Math.max(1, Math.round(y * 12))
    return `${m} month${m === 1 ? '' : 's'}`
  }
  const ys = fmtYearsShort(y)
  const n = Number(ys)
  const suffix = n === 1 ? 'year' : 'years'
  return `${ys} ${suffix}`
}

function purchaseName(params: {
  category: 'Car' | 'Tech' | 'Real Estate' | 'Other'
  itemName: string
  make: string
  model: string
  year: string
  reCity: string
  reState: string
  reZip: string
}): string {
  const { category, itemName, make, model, year, reCity, reState, reZip } = params
  if (category === 'Car') {
    const mk = (make || '').trim()
    const m = (model || '').trim()
    const y = (year || '').trim()
    const base = [mk, m].filter(Boolean).join(mk && m ? ' ' : '')
    if (base && y) return `${base} (${y})`
    if (base) return base
    if (y) return `Vehicle (${y})`
    return 'Vehicle'
  }
  if (category === 'Real Estate') {
    const city = (reCity || '').trim()
    const st = (reState || '').trim()
    const zip = (reZip || '').trim()
    const left = [city, st].filter(Boolean).join(city && st ? ', ' : '')
    const right = zip
    const loc = [left, right].filter(Boolean).join(right ? ' ' : '')
    if (loc) return loc
    return 'Real Estate'
  }
  const name = (itemName || '').trim()
  if (name) return name
  return category
}

function amortizeFixedPayment(principal: number, aprPct: number, payment: number, maxMonths: number): {
  termMonths: number
  interestPaid: number
  totalPaid: number
  paidOff: boolean
  remainingBalance: number
  amort: Array<{ m: number; interest: number; principal: number; balance: number }>
} {
  const monthlyRate = aprPct > 0 ? aprPct / 100 / 12 : 0
  let balance = Math.max(0, principal)
  let interestPaid = 0
  let totalPaid = 0
  const amort: Array<{ m: number; interest: number; principal: number; balance: number }> = []

  for (let m = 1; m <= maxMonths; m++) {
    if (balance <= 0) break
    const interest = monthlyRate > 0 ? balance * monthlyRate : 0
    const principalPay = Math.max(0, payment - interest)

    if (principalPay <= 0) {
      interestPaid += interest
      totalPaid += interest
      amort.push({ m, interest, principal: 0, balance })
      return { termMonths: m, interestPaid, totalPaid, paidOff: false, remainingBalance: balance, amort }
    }

    const actualPrincipalPay = Math.min(balance, principalPay)
    const actualPayment = actualPrincipalPay + interest
    balance = Math.max(0, balance - actualPrincipalPay)
    interestPaid += interest
    totalPaid += actualPayment
    amort.push({ m, interest, principal: actualPrincipalPay, balance })
  }

  return {
    termMonths: amort.length,
    interestPaid,
    totalPaid,
    paidOff: balance <= 0,
    remainingBalance: balance,
    amort,
  }
}

function isoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function addYears(d: Date, delta: number): Date {
  const x = new Date(d)
  x.setFullYear(x.getFullYear() + delta)
  return x
}

function addMonths(d: Date, delta: number): Date {
  const x = new Date(d)
  x.setMonth(x.getMonth() + delta)
  return x
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0)
}

function daysBetween(aIso: string, bIso: string): number {
  const a = new Date(aIso)
  const b = new Date(bIso)
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}

function mean(xs: number[]): number {
  if (xs.length === 0) return 0
  return xs.reduce((s, x) => s + x, 0) / xs.length
}

function stdDev(xs: number[]): number {
  if (xs.length <= 1) return 0
  const m = mean(xs)
  const v = mean(xs.map((x) => (x - m) ** 2))
  return Math.sqrt(v)
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0
  const ys = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(ys.length / 2)
  return ys.length % 2 === 0 ? (ys[mid - 1] + ys[mid]) / 2 : ys[mid]
}

function maxAbsDeviationFromMedian(xs: number[]): number {
  if (xs.length === 0) return 0
  const m = median(xs)
  return Math.max(...xs.map((x) => Math.abs(x - m)))
}

function monthShort(i: number): string {
  return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][i] || ''
}

function arcPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const start = {
    x: cx + r * Math.cos(startAngle),
    y: cy + r * Math.sin(startAngle),
  }
  const end = {
    x: cx + r * Math.cos(endAngle),
    y: cy + r * Math.sin(endAngle),
  }
  const largeArcFlag = endAngle - startAngle > Math.PI ? 1 : 0
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 1 ${end.x} ${end.y} Z`
}

function titleCase(s: string): string {
  if (!s) return s
  return s[0].toUpperCase() + s.slice(1)
}

function accountTypeLabel(type: string, brand: string): string {
  if (type === 'card') {
    if (brand && brand.toLowerCase() === 'debit') return 'Debit Card'
    return 'Credit Card'
  }
  return titleCase(type)
}

function App() {
  const [username, setUsername] = useState('test')
  const [password, setPassword] = useState('')
  const [accessTokenState, setAccessTokenState] = useState<string>(getAccessToken())
  const [error, setError] = useState<string>('')
  const [loading, setLoading] = useState(false)

  type Tab = 'dashboard' | 'transactions' | 'calculator' | 'business' | 'profile'

  const tabFromPathname = useCallback((pathname: string): Tab => {
    const p = (pathname || '').replace(/\/+$/, '')
    if (p === '/transactions') return 'transactions'
    if (p === '/calculator') return 'calculator'
    if (p === '/business') return 'business'
    if (p === '/profile') return 'profile'
    return 'dashboard'
  }, [])

  const pathFromTab = useCallback((tab: Tab): string => {
    if (tab === 'dashboard') return '/dashboard'
    return `/${tab}`
  }, [])

  const [activeTab, setActiveTab] = useState<Tab>(() => tabFromPathname(window.location.pathname))

  const setTab = useCallback(
    (tab: Tab) => {
      setActiveTab(tab)
      const nextPath = pathFromTab(tab)
      if (window.location.pathname !== nextPath) window.history.pushState({}, '', nextPath)
    },
    [pathFromTab]
  )
  const [accountsError, setAccountsError] = useState<string>('')
  const [accountsLoading, setAccountsLoading] = useState(false)
  const [accounts, setAccounts] = useState<Account[]>([])

  const [addCardOpen, setAddCardOpen] = useState(false)
  const [addCardName, setAddCardName] = useState('')
  const [addCardType, setAddCardType] = useState<'card' | 'checking' | 'cash'>('card')
  const [addCardBrand, setAddCardBrand] = useState('')
  const [addCardLast4, setAddCardLast4] = useState('')
  const [addCardIsBusiness, setAddCardIsBusiness] = useState(false)
  const [addCardLoading, setAddCardLoading] = useState(false)
  const [addCardError, setAddCardError] = useState('')

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmTitle, setConfirmTitle] = useState('')
  const [confirmMessage, setConfirmMessage] = useState('')
  const [confirmBusy, setConfirmBusy] = useState(false)
  const confirmActionRef = useRef<(() => Promise<void>) | null>(null)

  const [txLoading, setTxLoading] = useState(false)
  const [txError, setTxError] = useState('')
  const [txs, setTxs] = useState<Transaction[]>([])
  const [txFrom, setTxFrom] = useState('')
  const [txTo, setTxTo] = useState('')
  const [txType, setTxType] = useState<'income' | 'expense' | ''>('')
  const [txMerchant, setTxMerchant] = useState('')
  const [txAccount, setTxAccount] = useState<number | ''>('')
  const [txBiz, setTxBiz] = useState<boolean | ''>('')

  const [dashLoading, setDashLoading] = useState(false)
  const [dashError, setDashError] = useState('')
  const [dashAccount, setDashAccount] = useState<number | ''>('')
  const [dashCategory, setDashCategory] = useState<number | ''>('')
  const [dashPeriod, setDashPeriod] = useState<'7d' | '1m' | '3m' | '6m' | '1y'>('1m')
  const [dashTxs, setDashTxs] = useState<Transaction[]>([])

  const [catsError, setCatsError] = useState('')
  const [catsLoading, setCatsLoading] = useState(false)
  const [cats, setCats] = useState<Category[]>([])

  const [subsLoading, setSubsLoading] = useState(false)
  const [subsError, setSubsError] = useState('')
  const [subsTxs, setSubsTxs] = useState<Transaction[]>([])
  const subsLastKeyRef = useRef<string>('')

  const subsCacheRef = useRef<{
    fetchedAt: number
    data: Transaction[]
    inFlight: Promise<Transaction[]> | null
  }>({
    fetchedAt: 0,
    data: [],
    inFlight: null,
  })

  const [calcLoading, setCalcLoading] = useState(false)
  const [calcError, setCalcError] = useState('')
  const [calcTxs, setCalcTxs] = useState<Transaction[]>([])

  const [calcPrice, setCalcPrice] = useState('')
  const [calcCategory, setCalcCategory] = useState<'Car' | 'Tech' | 'Real Estate' | 'Other'>('Real Estate')
  const [calcItemName, setCalcItemName] = useState('')
  const [calcMake, setCalcMake] = useState('')
  const [calcModel, setCalcModel] = useState('')
  const [calcYear, setCalcYear] = useState('')

  const [calcPayMode, setCalcPayMode] = useState<'cash' | 'loan'>('loan')
  const [calcDownPayment, setCalcDownPayment] = useState('')
  const [calcApr, setCalcApr] = useState('')
  const [calcPlanMode, setCalcPlanMode] = useState<'term' | 'affordable'>('term')
  const [calcTermMonths, setCalcTermMonths] = useState(60)
  const [calcTermMonthsText, setCalcTermMonthsText] = useState('60')
  const [calcAffordablePayment, setCalcAffordablePayment] = useState('')

  const [calcIncome, setCalcIncome] = useState('')
  const [calcExpenses, setCalcExpenses] = useState('')
  const [calcIncomeTouched, setCalcIncomeTouched] = useState(false)
  const [calcExpensesTouched, setCalcExpensesTouched] = useState(false)

  const [calcHorizonYears, setCalcHorizonYears] = useState<5 | 10 | 15>(10)

  const [reZip, setReZip] = useState('')
  const [reCity, setReCity] = useState('')
  const [reState, setReState] = useState('')
  const [reType, setReType] = useState<'House' | 'Apartment' | ''>('House')
  const [reSqft, setReSqft] = useState('')
  const [reBedrooms, setReBedrooms] = useState('')
  const [reBathrooms, setReBathrooms] = useState('')
  const [reTxCostPct, setReTxCostPct] = useState('6')

  const [reAppLoading, setReAppLoading] = useState(false)
  const [reApp, setReApp] = useState<RealEstateAppreciationResponse | null>(null)

  const [vehVal, setVehVal] = useState<VehicleValueResponse | null>(null)
  const vehValCacheRef = useRef<
    Map<
      string,
      {
        fetchedAt: number
        data: VehicleValueResponse
        inFlight: Promise<VehicleValueResponse> | null
      }
    >
  >(new Map())

  const [calcRan, setCalcRan] = useState(false)
  const [calcNow, setCalcNow] = useState<number>(() => Date.now())

  const calcPrevCategoryRef = useRef<typeof calcCategory>(calcCategory)

  useEffect(() => {
    const prev = calcPrevCategoryRef.current
    if (prev === calcCategory) return
    calcPrevCategoryRef.current = calcCategory

    setCalcPrice('')
    setCalcItemName('')
    setCalcMake('')
    setCalcModel('')
    setCalcYear('')
    setCalcPayMode('loan')
    setCalcDownPayment('')
    setCalcApr('')
    setCalcPlanMode('term')
    setCalcTermMonths(60)
    setCalcTermMonthsText('60')
    setCalcAffordablePayment('')
    setCalcHorizonYears(10)

    setReZip('')
    setReCity('')
    setReState('')
    setReType('House')
    setReSqft('')
    setReBedrooms('')
    setReBathrooms('')
    setReTxCostPct('6')
    setReApp(null)
    setVehVal(null)
    setCalcError('')
    setCalcRan(false)
    setCalcNow(Date.now())
  }, [calcCategory])

  const [trendsLoading, setTrendsLoading] = useState(false)
  const [trendsError, setTrendsError] = useState('')
  const [trendsYear, setTrendsYear] = useState<number>(() => new Date().getFullYear())
  const [trendsMode, setTrendsMode] = useState<'income' | 'spendings'>('income')
  const [trendsScope, setTrendsScope] = useState<'business' | 'self'>('business')
  const [trendsTxs, setTrendsTxs] = useState<Transaction[]>([])
  const [trendsAllTxs, setTrendsAllTxs] = useState<Transaction[]>([])
  const [trendsYearsAvailable, setTrendsYearsAvailable] = useState<number[]>([])

  const trendsLastKeyRef = useRef<string>('')

  const isAuthed = useMemo(() => Boolean(accessTokenState), [accessTokenState])

  const onLogout = useCallback(() => {
    clearAuth()
    setAccessTokenState('')
    setTab('dashboard')
  }, [setTab])

  useEffect(() => {
    const onPop = () => {
      setActiveTab(tabFromPathname(window.location.pathname))
    }
    window.addEventListener('popstate', onPop)

    const p = window.location.pathname.replace(/\/+$/, '')
    if (p === '' || p === '/') window.history.replaceState({}, '', '/dashboard')

    onPop()
    return () => window.removeEventListener('popstate', onPop)
  }, [tabFromPathname])

  useEffect(() => {
    if (!isAuthed) {
      setAccessTokenState(getAccessToken())
      setUsername('')
      setPassword('')
    }
  }, [isAuthed])

  const refreshAccounts = useCallback(async () => {
    setAccountsError('')
    setAccountsLoading(true)
    try {
      const data = await getMain()
      setAccounts(data.accounts)
    } catch (err) {
      setAccountsError(err instanceof Error ? err.message : 'Failed to load accounts')
    } finally {
      setAccountsLoading(false)
    }
  }, [])

  const onOpenAddCard = useCallback(() => {
    setAddCardError('')
    setAddCardName('')
    setAddCardType('card')
    setAddCardBrand('')
    setAddCardLast4('')
    setAddCardIsBusiness(false)
    setAddCardOpen(true)
  }, [])

  const onSubmitAddCard = useCallback(async () => {
    setAddCardError('')
    setAddCardLoading(true)
    try {
      await createAccount({
        name: addCardName.trim(),
        type: addCardType,
        brand: addCardBrand.trim(),
        last4: addCardLast4.trim(),
        default_is_business: addCardIsBusiness,
      })
      setAddCardOpen(false)
      await refreshAccounts()
    } catch (err) {
      setAddCardError(err instanceof Error ? err.message : 'Failed to add card')
    } finally {
      setAddCardLoading(false)
    }
  }, [addCardBrand, addCardIsBusiness, addCardLast4, addCardName, addCardType, refreshAccounts])

  const onDeleteAccount = useCallback(
    async (a: Account) => {
      const label = `${a.name}${a.last4 ? ` **${a.last4}` : ''}`
      setConfirmTitle('Delete card/account')
      setConfirmMessage(label)
      confirmActionRef.current = async () => {
        await deactivateAccount(a.id)
        await refreshAccounts()
      }
      setConfirmOpen(true)
    },
    [refreshAccounts]
  )

  useEffect(() => {
    if (!isAuthed) {
      setAccounts([])
      setCats([])
      return
    }

    let alive = true
    setAccountsError('')
    setAccountsLoading(true)
    getMain()
      .then((data) => {
        if (!alive) return
        setAccounts(data.accounts)
      })
      .catch((err) => {
        if (!alive) return
        setAccountsError(err instanceof Error ? err.message : 'Failed to load accounts')
      })
      .finally(() => {
        if (!alive) return
        setAccountsLoading(false)
      })

    return () => {
      alive = false
    }
  }, [isAuthed])

  useEffect(() => {
    if (!isAuthed) return

    let alive = true
    setCatsError('')
    setCatsLoading(true)
    listCategories()
      .then((data) => {
        if (!alive) return
        setCats(data)
      })
      .catch((err) => {
        if (!alive) return
        setCatsError(err instanceof Error ? err.message : 'Failed to load categories')
      })
      .finally(() => {
        if (!alive) return
        setCatsLoading(false)
      })

    return () => {
      alive = false
    }
  }, [isAuthed])

  useEffect(() => {
    if (!isAuthed) {
      setTxs([])
      return
    }
    if (activeTab !== 'transactions') return

    let alive = true
    setTxError('')
    setTxLoading(true)
    listTransactions({
      from_date: txFrom || undefined,
      to_date: txTo || undefined,
      type: txType || undefined,
      merchant: txMerchant || undefined,
      account: txAccount === '' ? undefined : txAccount,
      is_business: txBiz === '' ? undefined : txBiz,
    })
      .then((data) => {
        if (!alive) return
        setTxs(data)
      })
      .catch((err) => {
        if (!alive) return
        const msg = err instanceof Error ? err.message : 'Failed to load transactions'
        setTxError(msg)
        if (msg.includes('401') || msg.includes('Unauthorized')) {
          onLogout()
        }
      })
      .finally(() => {
        if (!alive) return
        setTxLoading(false)
      })

    return () => {
      alive = false
    }
  }, [activeTab, isAuthed, txAccount, txBiz, txFrom, txMerchant, txTo, txType])

  useEffect(() => {
    if (!isAuthed) {
      setDashTxs([])
      return
    }
    if (activeTab !== 'dashboard') return

    const toD = new Date()
    const fromD = new Date(toD)
    if (dashPeriod === '7d') {
      fromD.setDate(fromD.getDate() - 6)
    } else if (dashPeriod === '1m') {
      fromD.setMonth(fromD.getMonth() - 1)
    } else if (dashPeriod === '3m') {
      fromD.setMonth(fromD.getMonth() - 3)
    } else if (dashPeriod === '6m') {
      fromD.setMonth(fromD.getMonth() - 6)
    } else {
      fromD.setFullYear(fromD.getFullYear() - 1)
    }

    const from = isoDate(fromD)
    const to = isoDate(toD)

    let alive = true
    setDashError('')
    setDashLoading(true)
    listTransactions({
      from_date: from,
      to_date: to,
      account: dashAccount === '' ? undefined : dashAccount,
      category: dashCategory === '' ? undefined : dashCategory,
    })
      .then((data) => {
        if (!alive) return
        setDashTxs(data)
      })
      .catch((err) => {
        if (!alive) return
        const msg = err instanceof Error ? err.message : 'Failed to load dashboard data'
        setDashError(msg)
        if (msg.includes('401') || msg.includes('Unauthorized')) {
          onLogout()
        }
      })
      .finally(() => {
        if (!alive) return
        setDashLoading(false)
      })

    return () => {
      alive = false
    }
  }, [activeTab, dashAccount, dashCategory, dashPeriod, isAuthed])

  useEffect(() => {
    if (!isAuthed) {
      setTrendsTxs([])
      setTrendsAllTxs([])
      setTrendsYearsAvailable([])
      trendsLastKeyRef.current = ''
      return
    }
    if (activeTab !== 'dashboard') return

    const nowY = new Date().getFullYear()
    const minY = nowY - 4
    const key = `window:${minY}-${nowY}`
    if (trendsLastKeyRef.current === key && trendsAllTxs.length > 0) return

    const from = isoDate(new Date(minY, 0, 1))
    const to = isoDate(new Date(nowY, 11, 31))

    let alive = true
    setTrendsError('')
    setTrendsLoading(true)
    listTransactions({
      from_date: from,
      to_date: to,
    })
      .then((data) => {
        if (!alive) return
        setTrendsAllTxs(data)
        const years = Array.from(
          new Set(
            data
              .map((t) => {
                const y = Number(String(t.date || '').slice(0, 4))
                return Number.isFinite(y) ? y : null
              })
              .filter((y): y is number => typeof y === 'number')
          )
        ).sort((a, b) => b - a)

        setTrendsYearsAvailable(years)

        const nextYear = years.includes(trendsYear) ? trendsYear : years[0] ?? trendsYear
        setTrendsYear(nextYear)
        setTrendsTxs(data.filter((t) => String(t.date || '').startsWith(String(nextYear))))

        trendsLastKeyRef.current = key
      })
      .catch((err) => {
        if (!alive) return
        const msg = err instanceof Error ? err.message : 'Failed to load trends'
        setTrendsError(msg)
        trendsLastKeyRef.current = ''
        setTrendsAllTxs([])
        setTrendsYearsAvailable([])
        if (msg.includes('401') || msg.includes('Unauthorized')) {
          onLogout()
        }
      })
      .finally(() => {
        if (!alive) return
        setTrendsLoading(false)
      })

    return () => {
      alive = false
    }
  }, [activeTab, isAuthed, onLogout, trendsAllTxs.length, trendsYear])

  useEffect(() => {
    if (trendsAllTxs.length === 0) return

    const yearTxs = trendsAllTxs.filter((t) => String(t.date || '').startsWith(String(trendsYear)))

    if (trendsScope === 'business') {
      setTrendsTxs(yearTxs.filter((t) => Boolean(t.is_business)))
      return
    }

    const debitIds = new Set(accounts.filter((a) => a.type === 'debit').map((a) => a.id))
    if (debitIds.size === 0) {
      setTrendsTxs(yearTxs)
      return
    }
    setTrendsTxs(yearTxs.filter((t) => (typeof t.account === 'number' ? debitIds.has(t.account) : false)))
  }, [accounts, trendsAllTxs, trendsScope, trendsYear])

  useEffect(() => {
    if (!isAuthed) {
      setSubsTxs([])
      subsLastKeyRef.current = ''
      subsCacheRef.current = { fetchedAt: 0, data: [], inFlight: null }
      return
    }
    const TTL_MS = 3 * 60 * 1000

    const cache = subsCacheRef.current
    if (cache.data.length > 0) {
      setSubsTxs(cache.data)
      setSubsLoading(false)
    }

    const now = Date.now()
    const stale = now - cache.fetchedAt > TTL_MS
    if (!stale && cache.data.length > 0) return
    if (cache.inFlight) return

    const toD = new Date()
    const fromD = addYears(toD, -1)
    const from = isoDate(fromD)
    const to = isoDate(toD)
    const key = `subs:1y:${from}:${to}`
    subsLastKeyRef.current = key

    let alive = true
    setSubsError('')
    if (cache.data.length === 0) setSubsLoading(true)

    const p = listTransactions({
      from_date: from,
      to_date: to,
      type: 'expense',
    })

    subsCacheRef.current = {
      ...subsCacheRef.current,
      inFlight: p,
    }

    p.then((data) => {
      if (!alive) return
      subsCacheRef.current = {
        fetchedAt: Date.now(),
        data,
        inFlight: null,
      }
      setSubsTxs(data)
    })
      .catch((err) => {
        if (!alive) return
        const msg = err instanceof Error ? err.message : 'Failed to load subscriptions'
        setSubsError(msg)
        subsLastKeyRef.current = ''
        subsCacheRef.current = {
          ...subsCacheRef.current,
          inFlight: null,
        }
        if (msg.includes('401') || msg.includes('Unauthorized')) {
          subsCacheRef.current = { fetchedAt: 0, data: [], inFlight: null }
          onLogout()
        }
      })
      .finally(() => {
        if (!alive) return
        setSubsLoading(false)
      })

    return () => {
      alive = false
    }
  }, [isAuthed, onLogout])

  useEffect(() => {
    if (!isAuthed) {
      setCalcTxs([])
      return
    }
    if (activeTab !== 'calculator') return

    const now = new Date()
    const endPrev = endOfMonth(addMonths(now, -1))
    const start3 = startOfMonth(addMonths(now, -3))
    const from = isoDate(start3)
    const to = isoDate(endPrev)

    let alive = true
    setCalcError('')
    setCalcLoading(true)
    listTransactions({
      from_date: from,
      to_date: to,
    })
      .then((data) => {
        if (!alive) return
        setCalcTxs(data)
      })
      .catch((err) => {
        if (!alive) return
        const msg = err instanceof Error ? err.message : 'Failed to load calculator data'
        setCalcError(msg)
        if (msg.includes('401') || msg.includes('Unauthorized')) {
          onLogout()
        }
      })
      .finally(() => {
        if (!alive) return
        setCalcLoading(false)
      })

    return () => {
      alive = false
    }
  }, [activeTab, isAuthed, onLogout])

  const financeCatId = useMemo(() => {
    const c = cats.find((x) => x.kind === 'expense' && (x.name || '').trim().toLowerCase() === 'finance')
    return c?.id
  }, [cats])

  const calcWindowTotals = useMemo(() => {
    let income = 0
    let expenses = 0
    let financeExpenses = 0
    const excludes = ['des:payment', 'des:mobile pmt', 'applecard', 'capital one']

    for (const t of calcTxs) {
      const amt = Number(t.amount)
      if (t.type === 'income') income += amt
      else expenses += amt

      if (t.type === 'expense' && financeCatId && t.category === financeCatId) {
        const m = (t.merchant || '').toLowerCase()
        const isExcluded = excludes.some((k) => m.includes(k))
        if (!isExcluded) financeExpenses += amt
      }
    }

    return {
      incomeMonthly: income / 3,
      expensesMonthly: expenses / 3,
      debtPaymentsMonthly: financeExpenses / 3,
    }
  }, [calcTxs, financeCatId])

  useEffect(() => {
    if (activeTab !== 'calculator') return
    if (!calcIncomeTouched) setCalcIncome(String(Math.round(calcWindowTotals.incomeMonthly)))
    if (!calcExpensesTouched) setCalcExpenses(String(Math.round(calcWindowTotals.expensesMonthly)))
  }, [activeTab, calcIncomeTouched, calcExpensesTouched, calcWindowTotals.incomeMonthly, calcWindowTotals.expensesMonthly])

  const calcDebtBalance = useMemo(() => {
    const debtAccounts = accounts.filter((a) => a.type === 'credit_card' || a.type === 'loan')
    const sum = debtAccounts.reduce((s, a) => s + Math.max(0, Number(a.balance)), 0)
    return sum
  }, [accounts])

  const calcCashAuto = useMemo(() => {
    const sum = accounts.reduce((s, a) => s + Math.max(0, Number(a.balance)), 0)
    return sum
  }, [accounts])

  function loanPayment(principal: number, aprPct: number, termMonths: number): number {
    if (principal <= 0 || termMonths <= 0) return 0
    if (aprPct <= 0) return principal / termMonths
    const r = aprPct / 100 / 12
    return (principal * r) / (1 - (1 + r) ** -termMonths)
  }

  function depreciationFactor(category: 'Car' | 'Tech' | 'Real Estate' | 'Other', years: number, reAnnualRate: number): number {
    const y = Math.max(0, years)
    if (category === 'Real Estate') return (1 + reAnnualRate) ** y
    if (y <= 0) return 1

    const first = category === 'Car' ? 0.18 : category === 'Tech' ? 0.35 : 0.15
    const following = category === 'Car' ? 0.12 : category === 'Tech' ? 0.2 : 0.1
    const firstFactor = 1 - first
    const restYears = Math.max(0, y - 1)
    return firstFactor * (1 - following) ** restYears
  }

  const calcResult = useMemo(() => {
    if (!calcRan) return null

    const price = Number(calcPrice) || 0
    const down = Number(calcDownPayment) || 0
    const apr = Number(calcApr) || 0
    const income = Number(calcIncome) || 0
    const expenses = Number(calcExpenses) || 0
    const cash = calcCashAuto
    const debtPmts = calcWindowTotals.debtPaymentsMonthly

    const free = income - expenses - debtPmts

    let principal = 0
    let termMonths = calcTermMonths
    let payment = 0
    let interestPaid = 0
    let totalPaid = 0
    let amort: Array<{ m: number; interest: number; principal: number; balance: number }> = []
    let impossible = false

    if (calcPayMode === 'loan') {
      principal = Math.max(price - down, 0)
      if (calcPlanMode === 'affordable') {
        const desired = Number(calcAffordablePayment) || 0
        if (desired > 0) {
          payment = desired
          const sched = amortizeFixedPayment(principal, apr, desired, 600)
          termMonths = sched.termMonths
          interestPaid = sched.interestPaid
          totalPaid = sched.totalPaid
          amort = sched.amort
          impossible = !sched.paidOff
        }
      }
      if (payment <= 0) payment = loanPayment(principal, apr, termMonths)
    }

    const freeAfter = free - payment
    const paymentToFree = payment / Math.max(free, 1)
    const cashBufferMonths = cash / Math.max(expenses + debtPmts, 1)

    let status: 'Safe' | 'Risky' | 'Not recommended' | 'Impossible' = 'Safe'

    if (calcPayMode === 'loan' && calcPlanMode === 'affordable' && (Number(calcAffordablePayment) || 0) > 0 && impossible) {
      status = 'Impossible'
    } else if (paymentToFree > 0.5 || cashBufferMonths < 3 || freeAfter <= 0) status = 'Not recommended'
    else if (paymentToFree > 0.25 || cashBufferMonths < 6) status = 'Risky'

    const explanation: string[] = []
    explanation.push(`Free cash/month: ${fmtMoney(free)}`)
    if (calcPayMode === 'loan') explanation.push(`Monthly payment: ${fmtMoney(payment)} (${Math.round(paymentToFree * 100)}% of free cash)`)
    explanation.push(`Cash buffer: ${cashBufferMonths.toFixed(1)} months`)
    explanation.push(`Free after purchase: ${fmtMoney(freeAfter)}`)

    const tips: string[] = []
    if (calcPayMode === 'loan') {
      if (paymentToFree > 0.5) tips.push('Reduce the monthly payment (smaller loan, lower APR, or longer term).')
      else if (paymentToFree > 0.25) tips.push('Try to keep the monthly payment under 25% of your free cash.')

      if (down < price * 0.1 && price > 0) tips.push('Increase the down payment to reduce interest and improve affordability.')
      if (termMonths > 72) tips.push('Consider a shorter term to reduce total interest paid.')
      if (termMonths < 36 && paymentToFree > 0.25) tips.push('A slightly longer term can reduce monthly stress (trade-off: more interest).')
    } else {
      if (cash < price && price > 0) tips.push('If paying in full, keep enough cash buffer after purchase for emergencies.')
    }

    if (cashBufferMonths < 3) tips.push('Build at least a 3-month cash buffer before buying.')
    else if (cashBufferMonths < 6) tips.push('Aim for a 6-month cash buffer for a safer purchase.')

    if (status === 'Not recommended') tips.push('Consider a cheaper option or postpone the purchase until your cash flow improves.')
    if (tips.length === 0) tips.push('Your inputs look reasonable. If possible, compare offers to reduce APR and fees.')

    if (calcPayMode === 'loan' && calcPlanMode !== 'affordable') {
      const n = termMonths
      const monthlyRate = apr > 0 ? apr / 100 / 12 : 0
      let balance = principal
      interestPaid = 0
      totalPaid = 0
      amort = []
      for (let m = 1; m <= n; m++) {
        if (balance <= 0) break
        const interest = monthlyRate > 0 ? balance * monthlyRate : 0
        const principalPay = Math.max(0, payment - interest)

        if (principalPay <= 0) {
          interestPaid += interest
          totalPaid += interest
          amort.push({ m, interest, principal: 0, balance })
          break
        }

        const actualPrincipalPay = Math.min(balance, principalPay)
        const actualPayment = actualPrincipalPay + interest
        balance = Math.max(0, balance - actualPrincipalPay)
        interestPaid += interest
        totalPaid += actualPayment
        amort.push({ m, interest, principal: actualPrincipalPay, balance })
      }
      termMonths = amort.length
    }

    const year = Number(calcYear) || new Date().getFullYear()
    const ageYears = Math.max(0, new Date(calcNow).getFullYear() - year)

    const isRE = calcCategory === 'Real Estate'
    let reAnnualRate = 0.03
    const app5 = reApp?.ok ? reApp.appreciation_5y_pct : null
    if (isRE && typeof app5 === 'number' && Number.isFinite(app5)) {
      reAnnualRate = (1 + app5 / 100) ** (1 / 5) - 1
    }

    const valueTodayBase = price * depreciationFactor(calcCategory, ageYears, reAnnualRate)
    const horizonYears = calcPayMode === 'loan' ? termMonths / 12 : calcHorizonYears
    const valueAtHorizonBase = valueTodayBase * depreciationFactor(calcCategory, horizonYears, reAnnualRate)

    const vehOk = calcCategory === 'Car' && vehVal?.ok && Number.isFinite(vehVal.value_today) && Number.isFinite(vehVal.value_at_horizon)
    const valueToday = vehOk ? vehVal!.value_today : valueTodayBase
    const valueAtHorizon = vehOk ? vehVal!.value_at_horizon : valueAtHorizonBase
    const depreciationLoss = Math.max(valueToday - valueAtHorizon, 0)

    const txCostPct = Number(reTxCostPct) || 0
    const txCost = isRE ? price * (txCostPct / 100) : 0
    const realOwnershipCost = interestPaid + depreciationLoss + txCost

    return {
      status,
      explanation,
      tips,
      loan: {
        downPayment: down,
        principal,
        payment,
        termMonths,
        interestPaid,
        totalPaid,
        amort,
      },
      value: {
        valueToday,
        valueAtHorizon,
        depreciationLoss,
        txCost,
        realOwnershipCost,
        horizonYears,
      },
      ratios: {
        paymentToFree,
        cashBufferMonths,
        freeAfter,
      },
    }
  }, [
    calcAffordablePayment,
    calcApr,
    calcCategory,
    calcDownPayment,
    calcExpenses,
    calcHorizonYears,
    calcIncome,
    calcNow,
    calcPayMode,
    calcPlanMode,
    calcPrice,
    calcRan,
    calcTermMonths,
    calcCashAuto,
    calcWindowTotals.debtPaymentsMonthly,
    calcYear,
    vehVal,
    reApp,
    reTxCostPct,
  ])

  const monthly = useMemo(() => {
    const year = trendsYear
    const income = Array.from({ length: 12 }, () => 0)
    const spendings = Array.from({ length: 12 }, () => 0)
    for (const t of trendsTxs) {
      const dt = new Date(t.date)
      if (dt.getFullYear() !== year) continue
      const m = dt.getMonth()
      const amt = Math.abs(Number(t.amount) || 0)
      if (t.type === 'income') income[m] += amt
      else spendings[m] += amt
    }
    return { year, income, spendings }
  }, [trendsTxs, trendsYear])

  const trendsMetrics = useMemo(() => {
    let revenue = 0
    let expenses = 0
    for (const t of trendsTxs) {
      const dt = new Date(t.date)
      if (dt.getFullYear() !== trendsYear) continue
      const amt = Math.abs(Number(t.amount) || 0)
      if (t.type === 'income') revenue += amt
      else expenses += amt
    }
    const profit = revenue - expenses
    const estimatedTaxes = trendsScope === 'business' ? Math.max(0, profit) * 0.25 : 0

    return { revenue, expenses, profit, estimatedTaxes }
  }, [trendsScope, trendsTxs, trendsYear])

  const trendSeries = useMemo(() => {
    const max = Math.max(1, ...monthly.income, ...monthly.spendings)
    return { max }
  }, [monthly.income, monthly.spendings])

  const subscriptions = useMemo(() => {
    const byMerchant = new Map<string, Transaction[]>()
    for (const t of subsTxs) {
      const merchant = (t.merchant || 'Unknown').trim() || 'Unknown'
      const arr = byMerchant.get(merchant)
      if (!arr) byMerchant.set(merchant, [t])
      else arr.push(t)
    }

    const rows: Array<{
      merchant: string
      total: number
      count: number
      last: string
      cadenceDays: number
      cadenceType: 'monthly' | 'weekly'
      typicalAmount: number
      monthlyCost: number
    }> = []

    for (const [merchant, txs] of byMerchant.entries()) {
      if (txs.length < 3) continue
      const sorted = [...txs].sort((a, b) => a.date.localeCompare(b.date))
      const dates = sorted.map((t) => t.date)
      const dayOfMonth = dates.map((d) => new Date(d).getDate())
      const weekday = dates.map((d) => new Date(d).getDay())
      const intervals: number[] = []
      for (let i = 1; i < dates.length; i++) intervals.push(daysBetween(dates[i - 1], dates[i]))

      const cadence = mean(intervals)
      const cadenceSd = stdDev(intervals)

      const amounts = sorted.map((t) => Number(t.amount))
      const typical = median(amounts)
      const amountOkCount = amounts.filter((a) => Math.abs(a - typical) <= Math.max(5, typical * 0.2)).length

      const stableAmount = amountOkCount / amounts.length >= 0.7

      const looksMonthly = cadence >= 25 && cadence <= 36 && cadenceSd <= 7
      const sameDateMonthly = maxAbsDeviationFromMedian(dayOfMonth) <= 5

      const looksWeekly = cadence >= 5 && cadence <= 9 && cadenceSd <= 3
      const weekdayMode = weekday
        .reduce((acc, w) => {
          acc.set(w, (acc.get(w) || 0) + 1)
          return acc
        }, new Map<number, number>())
      const weekdayMax = Math.max(0, ...Array.from(weekdayMode.values()))
      const sameWeekday = weekdayMax / weekday.length >= 0.7

      const cadenceType: 'monthly' | 'weekly' | null = looksMonthly && sameDateMonthly ? 'monthly' : looksWeekly && sameWeekday ? 'weekly' : null

      if (!cadenceType || !stableAmount) continue

      const total = amounts.reduce((s, x) => s + x, 0)
      const last = sorted[sorted.length - 1]?.date || ''

      const monthlyCost = cadenceType === 'monthly' ? typical : typical * 4
      rows.push({
        merchant,
        total,
        count: sorted.length,
        last,
        cadenceDays: Math.round(cadence),
        cadenceType,
        typicalAmount: typical,
        monthlyCost,
      })
    }

    return rows.sort((a, b) => b.total - a.total)
  }, [subsTxs])

  const dashCategories = useMemo(() => {
    const set = new Set<number>()
    for (const t of dashTxs) set.add(t.category)
    const ids = Array.from(set)
    const byId = new Map(cats.filter((c) => c.kind === 'expense').map((c) => [c.id, c.name] as const))
    return ids
      .map((id) => ({ id, name: byId.get(id) || `Category ${id}` }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [cats, dashTxs])

  const catsById = useMemo(() => {
    return new Map(cats.map((c) => [c.id, c.name] as const))
  }, [cats])

  const dashTotals = useMemo(() => {
    let income = 0
    let expense = 0
    for (const t of dashTxs) {
      const amt = Number(t.amount)
      if (t.type === 'income') income += amt
      else expense += amt
    }
    return { income, expense }
  }, [dashTxs])

  const dashNet = useMemo(() => {
    let total = 0
    for (const a of accounts) total += Number(a.balance)
    return total
  }, [accounts])

  const spendings = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of dashTxs) {
      if (t.type !== 'expense') continue
      const key = catsById.get(t.category) || `Category ${t.category}`
      map.set(key, (map.get(key) || 0) + Number(t.amount))
    }
    const rows = Array.from(map.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)

    const top = rows.slice(0, 5)
    const rest = rows.slice(5)
    const restSum = rest.reduce((acc, r) => acc + r.value, 0)
    if (restSum > 0) top.push({ label: 'Other', value: restSum })
    return top
  }, [catsById, dashTxs])

  const pie = useMemo(() => {
    const total = spendings.reduce((acc, s) => acc + s.value, 0)
    const colors = ['#60a5fa', '#a78bfa', '#f472b6', '#34d399', '#fbbf24', '#fb7185']
    let angle = -Math.PI / 2
    const slices = spendings.map((s, idx) => {
      const frac = total > 0 ? s.value / total : 0
      const a0 = angle
      const a1 = angle + frac * Math.PI * 2
      angle = a1
      return { ...s, color: colors[idx % colors.length], a0, a1 }
    })
    return { total, slices }
  }, [spendings])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const tokens = await login(username, password)
      setAccessToken(tokens.access)
      setAccessTokenState(tokens.access)
      setPassword('')
    } catch (err) {
      setAccessToken('')
      setAccessTokenState('')
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  if (!isAuthed) {
    return (
      <div className="container">
        <div className="card">
          <h1>MyFin</h1>

          <form onSubmit={onSubmit} autoComplete="off">
            <div className="row">
              <label className="label">Username</label>
              <input className="input" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div className="row">
              <label className="label">Password</label>
              <input
                className="input"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button className="button" type="submit" disabled={loading}>
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>

          {error ? <div className="error">{error}</div> : null}
        </div>
      </div>
    )
  }

  return (
    <div className="appShell">
      <div className="topbar">
        <div className="topbarInner">
          <div className="brand">MYFIN</div>
          <div className="nav">
            <button
              className={`navLink ${activeTab === 'dashboard' ? 'navLinkActive' : ''}`}
              onClick={() => setTab('dashboard')}
              type="button"
            >
              Dashboard
            </button>
            <button
              className={`navLink ${activeTab === 'transactions' ? 'navLinkActive' : ''}`}
              onClick={() => setTab('transactions')}
              type="button"
            >
              Transactions
            </button>
            <button
              className={`navLink ${activeTab === 'calculator' ? 'navLinkActive' : ''}`}
              onClick={() => setTab('calculator')}
              type="button"
            >
              Calculator
            </button>
            <button
              className={`navLink ${activeTab === 'business' ? 'navLinkActive' : ''}`}
              onClick={() => setTab('business')}
              type="button"
            >
              Business
            </button>
            <button
              className={`navLink ${activeTab === 'profile' ? 'navLinkActive' : ''}`}
              onClick={() => setTab('profile')}
              type="button"
            >
              Profile
            </button>
            <button className="navLink" onClick={onLogout} type="button">
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className={activeTab === 'dashboard' ? 'page pageDashboard' : 'page'}>
        {activeTab === 'dashboard' ? (
          <div className="dashPage">
            <h1>Dashboard</h1>
            <div className="grid">
              <div>
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
                              <button
                                type="button"
                                className="navLink"
                                style={{ marginLeft: 10 }}
                                onClick={() => onDeleteAccount(a)}
                                aria-label="Delete card"
                              >
                                X
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <button type="button" className="addCardBtn" onClick={onOpenAddCard}>
                      + Add a card
                    </button>
                  </div>
                </div>

                {addCardOpen ? (
                  <div
                    className="modalOverlay"
                    role="dialog"
                    aria-modal="true"
                    onMouseDown={(e) => {
                      if (e.target === e.currentTarget) setAddCardOpen(false)
                    }}
                  >
                    <div className="card modalCard">
                      <div className="modalTitle">Add a card/account</div>
                      <div className="toolbar">
                        <div className="field" style={{ flex: 1, minWidth: 220 }}>
                          <div className="label">Name</div>
                          <input className="input" value={addCardName} onChange={(e) => setAddCardName(e.target.value)} />
                        </div>
                        <div className="field" style={{ width: 160 }}>
                          <div className="label">Type</div>
                          <select className="select" value={addCardType} onChange={(e) => setAddCardType(e.target.value as any)}>
                            <option value="card">Card</option>
                            <option value="checking">Checking</option>
                            <option value="cash">Cash</option>
                          </select>
                        </div>
                      </div>
                      <div style={{ height: 10 }} />
                      <div className="toolbar">
                        <div className="field" style={{ flex: 1, minWidth: 220 }}>
                          <div className="label">Brand</div>
                          <input className="input" value={addCardBrand} onChange={(e) => setAddCardBrand(e.target.value)} placeholder="Visa, MasterCard…" />
                        </div>
                        <div className="field" style={{ width: 160 }}>
                          <div className="label">Last 4</div>
                          <input className="input" value={addCardLast4} onChange={(e) => setAddCardLast4(e.target.value)} placeholder="1234" inputMode="numeric" />
                        </div>
                      </div>
                      <div style={{ height: 10 }} />
                      <label className="muted" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input type="checkbox" checked={addCardIsBusiness} onChange={(e) => setAddCardIsBusiness(e.target.checked)} />
                        Default business account
                      </label>
                      {addCardError ? <div className="error" style={{ marginTop: 10 }}>{addCardError}</div> : null}
                      <div style={{ height: 14 }} />
                      <div className="modalActions">
                        <button type="button" className="button buttonSecondary" onClick={() => setAddCardOpen(false)}>
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="button"
                          disabled={addCardLoading || !addCardName.trim()}
                          onClick={onSubmitAddCard}
                        >
                          {addCardLoading ? 'Saving…' : 'Add'}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}

                {confirmOpen ? (
                  <div
                    className="modalOverlay"
                    role="dialog"
                    aria-modal="true"
                    onMouseDown={(e) => {
                      if (confirmBusy) return
                      if (e.target === e.currentTarget) setConfirmOpen(false)
                    }}
                  >
                    <div className="card modalCard">
                      <div className="modalTitle">{confirmTitle}</div>
                      <div className="muted">{confirmMessage}</div>
                      <div style={{ height: 14 }} />
                      <div className="modalActions">
                        <button
                          type="button"
                          className="button buttonSecondary"
                          disabled={confirmBusy}
                          onClick={() => setConfirmOpen(false)}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="button buttonDanger"
                          disabled={confirmBusy}
                          onClick={async () => {
                            const fn = confirmActionRef.current
                            if (!fn) {
                              setConfirmOpen(false)
                              return
                            }
                            setConfirmBusy(true)
                            try {
                              await fn()
                              setConfirmOpen(false)
                            } catch (err) {
                              alert(err instanceof Error ? err.message : 'Failed')
                            } finally {
                              setConfirmBusy(false)
                            }
                          }}
                        >
                          {confirmBusy ? 'Deleting…' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="rightCol">
                <div className="card">
                  <div className="panelTitle">Monthly Spendings</div>
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
                          onChange={(e) => setDashAccount(e.target.value ? Number(e.target.value) : '')}
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
                          onChange={(e) => setDashCategory(e.target.value ? Number(e.target.value) : '')}
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
                        <select
                          className="select pillSelect"
                          value={dashPeriod}
                          onChange={(e) => setDashPeriod(e.target.value as any)}
                        >
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
                <div className="card">
                  <div className="panelTitle">Trends</div>
                  <div className="trendTop">
                    <div className="pillRow">
                      <button
                        type="button"
                        className={`pillButton ${trendsMode === 'income' ? 'pillButtonActive' : ''}`}
                        onClick={() => setTrendsMode('income')}
                      >
                        Income
                      </button>
                      <button
                        type="button"
                        className={`pillButton ${trendsMode === 'spendings' ? 'pillButtonActive' : ''}`}
                        onClick={() => setTrendsMode('spendings')}
                      >
                        Spendings
                      </button>
                    </div>
                    <select className="select pillSelect" value={trendsScope} onChange={(e) => setTrendsScope(e.target.value as any)}>
                      <option value="business">Business</option>
                      <option value="self">Self balance</option>
                    </select>
                    <select className="select pillSelect" value={String(trendsYear)} onChange={(e) => setTrendsYear(Number(e.target.value))}>
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
                            <rect
                              x={x}
                              y={yIncome}
                              width={20}
                              height={hIncome}
                              rx={4}
                              fill="#60a5fa"
                              opacity={trendsMode === 'income' ? 0.95 : 0.35}
                            />
                            <rect
                              x={x + 24}
                              y={ySpend}
                              width={20}
                              height={hSpend}
                              rx={4}
                              fill="#a78bfa"
                              opacity={trendsMode === 'spendings' ? 0.95 : 0.35}
                            />
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
                      <div className="muted">{trendsYear}</div>
                    </div>
                    <div className="stat">
                      <div className="muted">Expenses</div>
                      <div className="statValue">{fmtMoney(trendsMetrics.expenses)}</div>
                      <div className="muted">{trendsYear}</div>
                    </div>
                    <div className="stat">
                      <div className="muted">Profit</div>
                      <div className="statValue">{fmtMoney(trendsMetrics.profit)}</div>
                      <div className="muted">Revenue - Expenses</div>
                    </div>
                    <div className="stat">
                      <div className="muted">Estimated Taxes</div>
                      <div className="statValue">{trendsScope === 'self' ? '—' : fmtMoney(trendsMetrics.estimatedTaxes)}</div>
                      <div className="muted">{trendsScope === 'self' ? '—' : 'Est. tax liability'}</div>
                    </div>
                  </div>
                </div>

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
              </div>
            </div>
          </div>
        ) : activeTab === 'transactions' ? (
          <div>
            <h1>Transactions</h1>
            <div className="card">
              <div className="toolbar">
                <div className="field">
                  <div className="label">From</div>
                  <input className="input" type="date" value={txFrom} onChange={(e) => setTxFrom(e.target.value)} />
                </div>
                <div className="field">
                  <div className="label">To</div>
                  <input className="input" type="date" value={txTo} onChange={(e) => setTxTo(e.target.value)} />
                </div>
                <div className="field">
                  <div className="label">Type</div>
                  <select className="select" value={txType} onChange={(e) => setTxType(e.target.value as any)}>
                    <option value="">All</option>
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                  </select>
                </div>
                <div className="field">
                  <div className="label">Account</div>
                  <select
                    className="select"
                    value={txAccount === '' ? '' : String(txAccount)}
                    onChange={(e) => setTxAccount(e.target.value ? Number(e.target.value) : '')}
                  >
                    <option value="">All</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <div className="label">Business</div>
                  <select
                    className="select"
                    value={txBiz === '' ? '' : String(txBiz)}
                    onChange={(e) => {
                      if (!e.target.value) setTxBiz('')
                      else setTxBiz(e.target.value === 'true')
                    }}
                  >
                    <option value="">All</option>
                    <option value="false">Personal</option>
                    <option value="true">Business</option>
                  </select>
                </div>
                <div className="field" style={{ flex: 1, minWidth: 180 }}>
                  <div className="label">Merchant</div>
                  <input className="input" value={txMerchant} onChange={(e) => setTxMerchant(e.target.value)} placeholder="Search" />
                </div>
              </div>

              {txLoading ? <div className="muted" style={{ marginTop: 10 }}>Loading...</div> : null}
              {txError ? <div className="error">{txError}</div> : null}

              <div style={{ height: 12 }} />
              <div className="tableWrap tableWrapTransactions">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Merchant</th>
                      <th>Account</th>
                      <th>Category</th>
                      <th>Business Expense</th>
                      <th style={{ textAlign: 'right' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {txs.map((t) => (
                      <tr key={t.id}>
                        <td>{t.date}</td>
                        <td>{t.merchant || '-'}</td>
                        <td>{t.account ? accounts.find((a) => a.id === t.account)?.name || t.account : '-'}</td>
                        <td>{catsById.get(t.category) || `Category ${t.category}`}</td>
                        <td>
                          <input className="txCheckbox" type="checkbox" checked={t.is_business} readOnly />
                        </td>
                        <td style={{ textAlign: 'right' }}>{t.amount}</td>
                      </tr>
                    ))}
                    {!txLoading && txs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="muted">
                          No transactions
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : activeTab === 'calculator' ? (
          <div className="calcPage">
            <div className="calcHeader">
              <div className="calcHeaderLeft">
                <div className="calcHeaderTitle">Loan Calculator</div>
              </div>
            </div>
            <div className="calcGrid">
              <div className="card">
                <div className="panelTitle calcPanelTitleBig">What are you buying?</div>
                <div className="toolbar">
                  <div className="field" style={{ flex: 1, minWidth: 180 }}>
                    <div className="label">Price</div>
                    <input className="input" value={calcPrice} onChange={(e) => setCalcPrice(e.target.value)} placeholder="$" />
                  </div>
                  <div className="field" style={{ flex: 1, minWidth: 180 }}>
                    <div className="label">Category</div>
                    <select className="select" value={calcCategory} onChange={(e) => setCalcCategory(e.target.value as any)}>
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

                {calcCategory === 'Real Estate' ? (
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
                        <select className="select" value={reType} onChange={(e) => setReType(e.target.value as any)}>
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
                          {reAppLoading ? 'Loading…' : reApp?.ok ? `${reApp.appreciation_5y_pct.toFixed(1)}% (${reApp.source})` : reApp?.error ? `Fallback (${reApp.error})` : 'Will fetch on Calculate'}
                        </div>
                      </div>
                    </div>
                  </>
                ) : null}

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
                      <button
                        type="button"
                        className={`pillButton ${calcHorizonYears === 5 ? 'pillButtonActive' : ''}`}
                        onClick={() => setCalcHorizonYears(5)}
                      >
                        5 years
                      </button>
                      <button
                        type="button"
                        className={`pillButton ${calcHorizonYears === 10 ? 'pillButtonActive' : ''}`}
                        onClick={() => setCalcHorizonYears(10)}
                      >
                        10 years
                      </button>
                      <button
                        type="button"
                        className={`pillButton ${calcHorizonYears === 15 ? 'pillButtonActive' : ''}`}
                        onClick={() => setCalcHorizonYears(15)}
                      >
                        15 years
                      </button>
                    </div>
                  </>
                )}

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

                <div style={{ height: 14 }} />
                <button
                  className="button calcButtonWide"
                  type="button"
                  disabled={calcLoading}
                  onClick={async () => {
                    setCalcNow(Date.now())
                    setCalcRan(true)
                    if (calcCategory === 'Car') {
                      const make = calcMake.trim()
                      const model = calcModel.trim()
                      const year = Number(calcYear) || 0
                      const currentYear = new Date().getFullYear()

                      const termMonths = calcTermMonths
                      const horizonYears = calcPayMode === 'loan' ? Math.round(termMonths / 12) : calcHorizonYears
                      const key = `${make}|${model}|${year}|${horizonYears}|${currentYear}`

                      if (make && model && year && horizonYears >= 0) {
                        const TTL_MS = 3 * 60 * 1000
                        const now = Date.now()
                        const cached = vehValCacheRef.current.get(key)

                        if (cached?.data) {
                          setVehVal(cached.data)
                        }

                        const stale = !cached || now - cached.fetchedAt > TTL_MS
                        if (stale && !cached?.inFlight) {
                          const p = getVehicleValue({
                            make,
                            model,
                            year,
                            horizon_years: horizonYears,
                            current_year: currentYear,
                          })
                          vehValCacheRef.current.set(key, {
                            fetchedAt: cached?.fetchedAt || 0,
                            data: cached?.data || {
                              ok: false,
                              source: 'fallback',
                              value_today: 0,
                              value_at_horizon: 0,
                            },
                            inFlight: p,
                          })
                          try {
                            const resp = await p
                            vehValCacheRef.current.set(key, { fetchedAt: Date.now(), data: resp, inFlight: null })
                            setVehVal(resp)
                          } catch (e) {
                            vehValCacheRef.current.set(key, {
                              fetchedAt: 0,
                              data: {
                                ok: false,
                                source: 'fallback',
                                value_today: 0,
                                value_at_horizon: 0,
                                error: e instanceof Error ? e.message : 'Failed to fetch vehicle value',
                              },
                              inFlight: null,
                            })
                            setVehVal({
                              ok: false,
                              source: 'fallback',
                              value_today: 0,
                              value_at_horizon: 0,
                              error: e instanceof Error ? e.message : 'Failed to fetch vehicle value',
                            })
                          } finally {
                            // no visible loading UI
                          }
                        }
                      }
                    }
                    if (calcCategory === 'Real Estate') {
                      const zip = reZip.trim()
                      const city = reCity.trim()
                      const state = reState.trim()
                      if (zip || city || state) {
                        setReAppLoading(true)
                        try {
                          const resp = await getRealEstateAppreciation({
                            zip,
                            city,
                            state,
                            property_type: reType,
                            sqft: reSqft ? Number(reSqft) : undefined,
                            bedrooms: reBedrooms ? Number(reBedrooms) : undefined,
                            bathrooms: reBathrooms ? Number(reBathrooms) : undefined,
                          })
                          setReApp(resp)
                        } catch (e) {
                          setReApp({
                            ok: false,
                            source: 'fallback',
                            appreciation_5y_pct: 0,
                            error: e instanceof Error ? e.message : 'Failed to fetch appreciation',
                          })
                        } finally {
                          setReAppLoading(false)
                        }
                      }
                    }
                  }}
                >
                  Calculate
                </button>

                {calcLoading ? <div className="muted" style={{ marginTop: 10 }}>Loading…</div> : null}
                {calcError ? <div className="error">{calcError}</div> : null}
              </div>

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
                          const fontSize = metricValueFontSizePx(
                            [sMonthly, sTotal, sInterest, sMonths].reduce((a, b) => (a.length >= b.length ? a : b), '')
                          )

                          return (
                            <>
                        <div className="calcMetric">
                          <div className="calcMetricLabel">Monthly Payment</div>
                          <div className="calcMetricValue" style={{ fontSize }}>{sMonthly}</div>
                        </div>
                        <div className="calcMetric">
                          <div className="calcMetricLabel">Total Paid</div>
                          <div className="calcMetricValue" style={{ fontSize }}>{sTotal}</div>
                        </div>
                        <div className="calcMetric">
                          <div className="calcMetricLabel">Interest</div>
                          <div className="calcMetricValue" style={{ fontSize }}>{sInterest}</div>
                        </div>
                        <div className="calcMetric">
                          <div className="calcMetricLabel">Months to pay</div>
                          <div className="calcMetricValue" style={{ fontSize }}>{sMonths}</div>
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
                      <div className="muted" style={{ marginBottom: 10 }}>See More Tips</div>
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
            </div>
          </div>
        ) : (
          <div>
            <h1>{activeTab[0].toUpperCase() + activeTab.slice(1)}</h1>
            <div className="card">
              <div className="muted">Coming soon</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
