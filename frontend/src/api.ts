export type TokenPair = {
  access: string
  refresh: string
}

export function getAccessToken(): string {
  return localStorage.getItem('accessToken') || ''
}

export function setAccessToken(token: string): void {
  if (!token) {
    localStorage.removeItem('accessToken')
    return
  }
  localStorage.setItem('accessToken', token)
}

export function clearAuth(): void {
  localStorage.removeItem('accessToken')
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
  const token = getAccessToken()
  const resp = await fetch('/api/main/', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

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
  const token = getAccessToken()
  const resp = await fetch('/api/categories/', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

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
  const token = getAccessToken()
  const query = toQuery({
    from_date: params.from_date || '',
    to_date: params.to_date || '',
    type: params.type || '',
    category: typeof params.category === 'number' ? String(params.category) : '',
    merchant: params.merchant || '',
    account: typeof params.account === 'number' ? String(params.account) : '',
    is_business: typeof params.is_business === 'boolean' ? String(params.is_business) : '',
  })

  const resp = await fetch(`/api/transaction/${query}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

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
  const token = getAccessToken()
  const resp = await fetch('/api/real-estate/appreciation/', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
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
  const token = getAccessToken()
  const resp = await fetch('/api/vehicle/value/', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(text || `Request failed: ${resp.status}`)
  }

  return (await resp.json()) as VehicleValueResponse
}
