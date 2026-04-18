export type TokenPair = {
  access: string
  refresh: string
}

export function getAccessToken(): string {
  return localStorage.getItem('accessToken') || ''
}

export function getRefreshToken(): string {
  return localStorage.getItem('refreshToken') || ''
}

export function setAccessToken(token: string): void {
  if (!token) {
    localStorage.removeItem('accessToken')
    return
  }
  localStorage.setItem('accessToken', token)
}

export function setRefreshToken(token: string): void {
  if (!token) {
    localStorage.removeItem('refreshToken')
    return
  }
  localStorage.setItem('refreshToken', token)
}

export function clearAuth(): void {
  localStorage.removeItem('accessToken')
  localStorage.removeItem('refreshToken')
}

async function refreshAccessToken(): Promise<string> {
  const refresh = getRefreshToken()
  if (!refresh) throw new Error('Missing refresh token')

  const resp = await fetch('/api/auth/refresh/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh }),
  })

  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(text || `Refresh failed: ${resp.status}`)
  }

  const data = (await resp.json()) as { access?: string }
  const access = data.access || ''
  if (!access) throw new Error('Refresh did not return access token')
  setAccessToken(access)
  return access
}

async function authedFetch(input: RequestInfo, init: RequestInit = {}, triedRefresh = false): Promise<Response> {
  const token = getAccessToken()
  const headers = new Headers(init.headers || {})
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (!headers.has('Content-Type') && init.body) headers.set('Content-Type', 'application/json')

  const resp = await fetch(input, { ...init, headers })
  if (resp.status !== 401 || triedRefresh) return resp

  let text = ''
  try {
    text = await resp.clone().text()
  } catch {
    text = ''
  }

  const looksExpired = text.includes('token_not_valid') || text.includes('Token is expired')
  if (!looksExpired) return resp

  try {
    const newAccess = await refreshAccessToken()
    const retryHeaders = new Headers(init.headers || {})
    retryHeaders.set('Authorization', `Bearer ${newAccess}`)
    if (!retryHeaders.has('Content-Type') && init.body) retryHeaders.set('Content-Type', 'application/json')
    return await fetch(input, { ...init, headers: retryHeaders })
  } catch {
    clearAuth()
    return resp
  }
}

export async function login(username: string, password: string): Promise<TokenPair> {
  const resp = await fetch('/api/auth/login/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, password }),
  })

  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(text || `Login failed: ${resp.status}`)
  }

  return (await resp.json()) as TokenPair
}

export type Account = {
  id: number
  name: string
  type: string
  last4: string
  brand: string
  balance: string
  default_is_business: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export type MainResponse = {
  accounts: Account[]
}

export async function getMain(): Promise<MainResponse> {
  const resp = await authedFetch('/api/main/', {})

  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(text || `Request failed: ${resp.status}`)
  }

  return (await resp.json()) as MainResponse
}

export type Category = {
  id: number
  name: string
  kind: 'income' | 'expense'
  is_active: boolean
  created_at: string
  updated_at: string
}

export async function listCategories(): Promise<Category[]> {
  const resp = await authedFetch('/api/categories/', {})

  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(text || `Request failed: ${resp.status}`)
  }

  return (await resp.json()) as Category[]
}

export type Transaction = {
  id: number
  account: number | null
  amount: string
  type: 'income' | 'expense'
  category: number
  is_business: boolean
  date: string
  merchant: string
  created_at: string
  updated_at: string
}

export type TransactionListResponse = Transaction[]

export type TransactionListParams = {
  from_date?: string
  to_date?: string
  type?: 'income' | 'expense' | ''
  category?: number | ''
  merchant?: string
  account?: number | ''
  is_business?: boolean | ''
}

function toQuery(params: Record<string, string>): string {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (!v) continue
    qs.set(k, v)
  }
  const s = qs.toString()
  return s ? `?${s}` : ''
}

export async function listTransactions(params: TransactionListParams = {}): Promise<TransactionListResponse> {
  const query = toQuery({
    from_date: params.from_date || '',
    to_date: params.to_date || '',
    type: params.type || '',
    category: typeof params.category === 'number' ? String(params.category) : '',
    merchant: params.merchant || '',
    account: typeof params.account === 'number' ? String(params.account) : '',
    is_business: typeof params.is_business === 'boolean' ? String(params.is_business) : '',
  })

  const resp = await authedFetch(`/api/transaction/?${query}`, {})

  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(text || `Request failed: ${resp.status}`)
  }

  return (await resp.json()) as TransactionListResponse
}

export type RealEstateAppreciationRequest = {
  zip: string
  city: string
  state: string
  property_type: 'House' | 'Apartment' | ''
  sqft?: number | ''
  bedrooms?: number | ''
  bathrooms?: number | ''
}

export type RealEstateAppreciationResponse = {
  ok: boolean
  source: 'gemini' | 'fallback'
  appreciation_5y_pct: number
  notes?: string
  error?: string
}

export async function getRealEstateAppreciation(
  payload: RealEstateAppreciationRequest
): Promise<RealEstateAppreciationResponse> {
  const resp = await authedFetch('/api/real-estate/appreciation/', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(text || `Request failed: ${resp.status}`)
  }

  return (await resp.json()) as RealEstateAppreciationResponse
}

export type VehicleValueRequest = {
  make: string
  model: string
  year: number
  horizon_years: number
  current_year: number
}

export type VehicleValueResponse = {
  ok: boolean
  source: 'gemini' | 'fallback'
  value_today: number
  value_at_horizon: number
  notes?: string
  error?: string
}

export async function getVehicleValue(payload: VehicleValueRequest): Promise<VehicleValueResponse> {
  const resp = await authedFetch('/api/vehicle/value/', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(text || `Request failed: ${resp.status}`)
  }

  return (await resp.json()) as VehicleValueResponse
}

export type VehicleValuationRequest = {
  brand: string
  model: string
  year: number
  mileage: number
  horizon_years: number
}

export type VehicleValuationResponse = {
  ok: boolean
  source: 'gemini' | 'fallback'
  current_price?: number
  price_range?: [number, number]
  annual_depreciation_percent?: number
  forecast?: {
    '1y': number
    '3y': number
    '5y': number
  }
  trend?: 'up' | 'down' | 'stable' | string
  confidence?: number
  reasoning?: string
  horizon_years?: number
  error?: string
}

export async function getVehicleValuation(payload: VehicleValuationRequest): Promise<VehicleValuationResponse> {
  const resp = await authedFetch('/api/vehicle/valuation/', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(text || `Request failed: ${resp.status}`)
  }

  return (await resp.json()) as VehicleValuationResponse
}

export type RealEstateValuationRequest = {
  zip: string
  city: string
  beds?: number | ''
  baths?: number | ''
  sqft?: number | ''
  property_type: 'House' | 'Apartment' | ''
}

export type RealEstateValuationResponse = {
  ok: boolean
  source: 'gemini' | 'fallback'
  estimated_price?: number
  price_range?: [number, number]
  annual_growth_percent?: number
  forecast?: {
    '1y': number
    '3y': number
    '5y': number
  }
  trend?: 'up' | 'down' | 'stable' | string
  confidence?: number
  reasoning?: string
  error?: string
}

export async function getRealEstateValuation(payload: RealEstateValuationRequest): Promise<RealEstateValuationResponse> {
  const resp = await authedFetch('/api/real-estate/valuation/', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(text || `Request failed: ${resp.status}`)
  }

  return (await resp.json()) as RealEstateValuationResponse
}

export type TechValuationRequest = {
  product_name: string
  condition: string
  age_years: number
}

export type TechValuationResponse = {
  ok: boolean
  source: 'gemini' | 'fallback'
  current_price?: number
  price_range?: [number, number]
  annual_depreciation_percent?: number
  forecast?: {
    '1y': number
    '2y': number
  }
  trend?: 'up' | 'down' | 'stable' | string
  confidence?: number
  reasoning?: string
  error?: string
}

export async function getTechValuation(payload: TechValuationRequest): Promise<TechValuationResponse> {
  const resp = await authedFetch('/api/tech/valuation/', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(text || `Request failed: ${resp.status}`)
  }

  return (await resp.json()) as TechValuationResponse
}
