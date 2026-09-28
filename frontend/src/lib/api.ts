import type {
  AccountDetail,
  AccountListResponse,
  AccountScope,
  AuthStatusResponse,
  ImportResult,
  LoginResponse,
  MessageDetail,
  MessageFolder,
  MessageItem,
  OperationStatusPayload,
  PoolSummary,
  PublicSharePayload,
  RandomConsumeAccountResponse,
  ShareResult,
  SiteItem,
  SiteListResponse,
  SyncResponse,
  UserApiKeyPayload,
  UserItem,
  UserListResponse,
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

export function fetchUsers() {
  return apiFetch<UserListResponse>('/api/users')
}

export function createUser(payload: { username: string; password: string; role?: string; enabled?: boolean }) {
  return apiFetch<UserItem>('/api/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateUser(userId: number, payload: { password?: string; enabled?: boolean }) {
  return apiFetch(`/api/users/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function fetchUserApiKey(userId: number) {
  return apiFetch<UserApiKeyPayload>(`/api/users/${userId}/api-key`)
}

export function regenerateUserApiKey(userId: number) {
  return apiFetch<UserApiKeyPayload>(`/api/users/${userId}/api-key/regenerate`, {
    method: 'POST',
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

export function fetchAccounts(params: {
  page: number
  pageSize: number
  keyword: string
  scope: AccountScope
  batchCode?: string
  groupSiteId?: number | null
  userId?: number | null
  siteCode?: string
}) {
  const search = new URLSearchParams()
  search.set('page', String(params.page))
  search.set('page_size', String(params.pageSize))
  search.set('keyword', params.keyword)
  search.set('scope', params.scope)
  search.set('batch_code', params.batchCode || '')
  if (params.groupSiteId) search.set('group_site_id', String(params.groupSiteId))
  search.set('site_code', params.siteCode || '')
  if (params.userId) search.set('user_id', String(params.userId))
  return apiFetch<AccountListResponse>(`/api/accounts?${search.toString()}`)
}

export async function exportAccounts(params: {
  keyword?: string
  scope?: AccountScope
  batchCode?: string
  userId?: number | null
  siteCode?: string
}) {
  const search = new URLSearchParams()
  search.set('keyword', params.keyword || '')
  search.set('scope', params.scope || 'all')
  search.set('batch_code', params.batchCode || '')
  search.set('site_code', params.siteCode || '')
  if (params.userId) search.set('user_id', String(params.userId))

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
    note?: string
    is_pinned?: boolean
    owner_user_id?: number
    batch_code?: string
    group_site_id?: number | null
  },
) {
  return apiFetch<AccountDetail>(`/api/accounts/${accountId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function batchUpdateAccounts(payload: {
  account_ids: number[]
  batch_code?: string
  group_site_id?: number | null
  enabled?: boolean
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

export function moveAccountsToUserPool(payload: { account_ids: number[]; owner_user_id: number }) {
  return apiFetch<{ ok: boolean; message: string }>('/api/accounts/batch-move', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function consumeRandomPoolAccount(payload: {
  site_code: string
  owner_user_id?: number | null
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
  owner_user_id?: number | null
}) {
  return apiFetch<ImportResult>('/api/accounts/import', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function fetchPoolSummary(userId?: number | null, siteCode?: string) {
  const search = new URLSearchParams()
  if (userId) search.set('user_id', String(userId))
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

export function createShare(accountId: number, days: number) {
  return apiFetch<ShareResult>(`/api/accounts/${accountId}/shares`, {
    method: 'POST',
    body: JSON.stringify({ days }),
  })
}

export function fetchPublicShare(token: string) {
  return apiFetch<PublicSharePayload>(`/api/public/shares/${token}`)
}

export function syncPublicShare(token: string) {
  return apiFetch<PublicSharePayload>(`/api/public/shares/${token}/sync`, {
    method: 'POST',
  })
}

export function fetchPublicMessage(token: string, messageId: number) {
  return apiFetch<MessageDetail>(`/api/public/shares/${token}/messages/${messageId}`)
}
