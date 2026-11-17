export interface UserIdentity {
  id: number
  username: string
  role: 'admin' | 'user' | string
}

export interface ApiKeyItem {
  id: number
  name: string
  key: string
  enabled: boolean
  created_at: string
  updated_at: string
}

export interface ApiKeyListResponse {
  items: ApiKeyItem[]
}

export interface SiteItem {
  id: number
  code: string
  name: string
  enabled: boolean
  created_at: string
  updated_at: string
}

export interface SiteListResponse {
  items: SiteItem[]
}

export interface AccountSiteUsageItem {
  id: number
  site_id: number
  site_code: string
  site_name: string
  source: string
  used_at: string
}

export interface AccountItem {
  id: number
  email: string
  password: string
  enabled: boolean
  is_pinned: boolean
  show_in_station: boolean
  batch_code: string
  group_site_id: number | null
  group_site_code: string
  group_site_name: string
  note: string
  is_consumed: boolean
  created_at: string
  updated_at: string
  last_synced_at: string | null
  last_error: string
  inbox_count: number
  sent_count: number
  active_sites: AccountSiteUsageItem[]
  has_password: boolean
  has_oauth: boolean
  auth_type: string
  token_status: string
  permission_type: string
}

export interface AccountListResponse {
  items: AccountItem[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface RandomConsumeAccountResponse {
  item: AccountItem
  page: number
}

export interface AccountDetail extends AccountItem {
  has_password: boolean
  has_oauth: boolean
}

export interface PoolSummary {
  pool_count: number
  consumed_count: number
}

export interface MessageItem {
  id: number
  folder: 'inbox' | 'sent' | string
  subject: string
  sender_name: string
  sender_email: string
  recipient_summary: string
  preview: string
  sent_at: string | null
}

export interface MessageDetail extends MessageItem {
  body_text: string
  body_html: string
}

export interface ImportResult {
  total: number
  created: number
  updated: number
  failed: number
  errors: string[]
}

export interface AuthStatusResponse {
  enabled: boolean
  authenticated: boolean
  user: UserIdentity | null
}

export interface LoginResponse {
  access_token: string
  token_type: string
  user: UserIdentity
}

export interface OperationStatusPayload {
  ok: boolean
  message: string
  email: string
}

export interface SyncResponse {
  account_id: number
  synced_at: string
  inbox_count: number
  sent_count: number
}

export type AccountScope = 'consumed' | 'pool' | 'all'
export type MessageFolder = 'inbox' | 'sent'
