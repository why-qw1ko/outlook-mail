import type {
  AccountDetail,
  AccountListResponse,
  AccountScope,
  ApiKeyItem,
  ApiKeyListResponse,
  AuthStatusResponse,
  ImportResult,
  LoginResponse,
  MessageDetail,
  MessageFolder,
  MessageItem,
  OperationStatusPayload,
  PoolSummary,
  RandomConsumeAccountResponse,
  SiteItem,
  SiteListResponse,
  SyncResponse,
} from './types'

const ADMIN_TOKEN_KEY = 'oms_admin_token'

export function getAdminToken() {
  return window.localStorage.getItem(ADMIN_TOKEN_KEY)
}

export function setAdminToken(token: string) {
  window.localStorage.setItem(ADMIN_TOKEN_KEY, token)
}

export function clearAdminToken() {
  window.localStorage.removeItem(ADMIN_TOKEN_KEY)
}

async function parseError(response: Response) {
  const payload = await response.json().catch(() => null)
  const detail = payload && typeof payload.detail === 'string' ? payload.detail : `请求失败：${response.status}`
  throw new Error(detail)
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers || {})
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json')
  }
  const token = getAdminToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const response = await fetch(path, { ...init, headers })
  if (!response.ok) await parseError(response)
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export function fetchAuthStatus() {
  return apiFetch<AuthStatusResponse>('/api/admin/auth/status')
}

export function login(payload: { username: string; password: string }) {
  return apiFetch<LoginResponse>('/api/admin/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function fetchApiKeys() {
  return apiFetch<ApiKeyListResponse>('/api/api-keys')
}

export function createApiKey(payload: { name: string; enabled?: boolean }) {
  return apiFetch<ApiKeyItem>('/api/api-keys', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateApiKey(keyId: number, payload: { name?: string; enabled?: boolean }) {
  return apiFetch<ApiKeyItem>(`/api/api-keys/${keyId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function regenerateApiKey(keyId: number) {
  return apiFetch<ApiKeyItem>(`/api/api-keys/${keyId}/regenerate`, {
    method: 'POST',
  })
}

export function deleteApiKey(keyId: number) {
  return apiFetch<OperationStatusPayload>(`/api/api-keys/${keyId}`, {
    method: 'DELETE',
  })
}

export function fetchSites() {
  return apiFetch<SiteListResponse>('/api/sites')
}

export function createSite(payload: { code: string; name: string; enabled?: boolean }) {
  return apiFetch<SiteItem>('/api/sites', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateSite(siteId: number, payload: { code?: string; name?: string; enabled?: boolean }) {
  return apiFetch<SiteItem>(`/api/sites/${siteId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function deleteSite(siteId: number) {
  return apiFetch<OperationStatusPayload>(`/api/sites/${siteId}`, {
    method: 'DELETE',
  })
}

export function fetchAccounts(params: {
  page: number
  pageSize: number
  keyword: string
  scope: AccountScope
  batchCode?: string
  groupSiteId?: number | null
  siteCode?: string
  includeDisabled?: boolean
  stationOnly?: boolean
}) {
  const search = new URLSearchParams()
  search.set('page', String(params.page))
  search.set('page_size', String(params.pageSize))
  search.set('keyword', params.keyword)
  search.set('scope', params.scope)
  search.set('batch_code', params.batchCode || '')
  if (params.groupSiteId) search.set('group_site_id', String(params.groupSiteId))
  search.set('site_code', params.siteCode || '')
  if (params.includeDisabled) search.set('include_disabled', 'true')
  if (params.stationOnly) search.set('station_only', 'true')
  return apiFetch<AccountListResponse>(`/api/accounts?${search.toString()}`)
}

export async function exportAccounts(params: {
  keyword?: string
  scope?: AccountScope
  batchCode?: string
  siteCode?: string
}) {
  const search = new URLSearchParams()
  search.set('keyword', params.keyword || '')
  search.set('scope', params.scope || 'all')
  search.set('batch_code', params.batchCode || '')
  search.set('site_code', params.siteCode || '')

  const headers = new Headers()
  const token = getAdminToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const response = await fetch(`/api/accounts/export?${search.toString()}`, { headers })
  if (!response.ok) await parseError(response)

  const blob = await response.blob()
  const disposition = response.headers.get('Content-Disposition') || ''
  const matched = disposition.match(/filename="?([^";]+)"?/i)
  return { blob, filename: matched?.[1] || 'accounts.csv' }
}

export async function exportAccountsTxt(params: {
  keyword: string
  scope: AccountScope
  groupSiteId?: number | null
}) {
  const search = new URLSearchParams({ keyword: params.keyword, scope: params.scope })
  if (params.groupSiteId) search.set('group_site_id', String(params.groupSiteId))
  const headers = new Headers()
  const token = getAdminToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const response = await fetch(`/api/accounts/export-txt?${search.toString()}`, { headers })
  if (!response.ok) await parseError(response)
  const blob = await response.blob()
  const disposition = response.headers.get('Content-Disposition') || ''
  const matched = disposition.match(/filename="?([^";]+)"?/i)
  return { blob, filename: matched?.[1] || 'accounts.txt' }
}

export function fetchAccountDetail(accountId: number) {
  return apiFetch<AccountDetail>(`/api/accounts/${accountId}`)
}

export function updateAccount(
  accountId: number,
  payload: {
    enabled?: boolean
    show_in_station?: boolean
    note?: string
    is_pinned?: boolean
    batch_code?: string
    group_site_id?: number | null
  },
) {
  return apiFetch<AccountDetail>(`/api/accounts/${accountId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function fetchAccountCredentials(accountIds: number[]) {
  return apiFetch<Array<{ id: number; password: string }>>('/api/accounts/credentials', {
    method: 'POST',
    body: JSON.stringify({ account_ids: accountIds }),
    cache: 'no-store',
  })
}

export function batchUpdateAccounts(payload: {
  account_ids: number[]
  batch_code?: string
  group_site_id?: number | null
  enabled?: boolean
  show_in_station?: boolean
}) {
  return apiFetch<OperationStatusPayload>('/api/accounts/batch-update', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function batchDeleteAccounts(accountIds: number[]) {
  return apiFetch<OperationStatusPayload>('/api/accounts/batch-delete', {
    method: 'POST',
    body: JSON.stringify({ account_ids: accountIds }),
  })
}

export function consumeRandomPoolAccount(payload: {
  site_code: string
  page_size?: number
}) {
  return apiFetch<RandomConsumeAccountResponse>('/api/accounts/random-consume', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function importAccounts(payload: {
  data: string
  enabled?: boolean
  batch_code?: string
  group_site_id?: number | null
}) {
  return apiFetch<ImportResult>('/api/accounts/import', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function fetchPoolSummary(siteCode?: string) {
  const search = new URLSearchParams()
  if (siteCode) search.set('site_code', siteCode)
  const qs = search.toString()
  return apiFetch<PoolSummary>(`/api/accounts/pool-summary${qs ? `?${qs}` : ''}`)
}

export function releaseAccount(accountId: number, payload: { site_code: string }) {
  return apiFetch<OperationStatusPayload>(`/api/accounts/${accountId}/release`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function consumeAccount(accountId: number, payload: { site_code: string }) {
  return apiFetch<OperationStatusPayload>(`/api/accounts/${accountId}/consume`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function deleteAccount(accountId: number) {
  return apiFetch<OperationStatusPayload>(`/api/accounts/${accountId}`, {
    method: 'DELETE',
  })
}

export function syncAccount(accountId: number) {
  return apiFetch<SyncResponse>(`/api/accounts/${accountId}/sync`, {
    method: 'POST',
  })
}

export function validateAccountOAuth(accountId: number) {
  return apiFetch<OperationStatusPayload>(`/api/accounts/${accountId}/validate-oauth`, { method: 'POST' })
}

export function fetchMessages(accountId: number, folder: MessageFolder) {
  const search = new URLSearchParams()
  search.set('folder', folder)
  return apiFetch<MessageItem[]>(`/api/accounts/${accountId}/messages?${search.toString()}`)
}

export function fetchMessageDetail(_accountId: number, messageId: number) {
  return apiFetch<MessageDetail>(`/api/accounts/${_accountId}/messages/${messageId}`)
}

export function sendMail(
  accountId: number,
  payload: { to: string; cc?: string; bcc?: string; subject: string; body_text?: string; body_html?: string },
) {
  return apiFetch(`/api/accounts/${accountId}/send`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
