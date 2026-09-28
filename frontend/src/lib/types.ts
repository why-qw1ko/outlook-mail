export interface UserIdentity {
  id: number
  username: string
  role: 'admin' | 'user' | string
}

export interface UserItem extends UserIdentity {
  enabled: boolean
  pool_count: number
  consumed_count: number
  last_imported_at: string | null
  created_at: string
  updated_at: string
}

export interface UserListResponse {
  items: UserItem[]
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

export interface UserApiKeyPayload {
  user_id: number
  username: string
  api_key: string
  updated_at: string
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
  batch_code: string
  group_site_id: number | null
  group_site_code: string
  group_site_name: string
  note: string
  owner_user_id: number | null
  owner_username: string
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
  user: UserIdentity
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

export interface ShareResult {
  token: string
  url: string
  expires_at: string
}

export interface PublicSharePayload {
  account: { email: string }
  inbox: MessageItem[]
  sent: MessageItem[]
  expires_at: string
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
