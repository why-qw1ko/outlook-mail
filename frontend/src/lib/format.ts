export function formatTime(value?: string | null) {
  if (!value) return '未同步'
  const raw = value.trim()
  const hasTimezone = /(?:[zZ]|[+\-]\d{2}:\d{2})$/.test(raw)
  const normalized = hasTimezone
    ? raw
    : raw.includes('T')
      ? `${raw}Z`
      : `${raw.replace(' ', 'T')}Z`
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Shanghai',
  }).format(date)
}

export function formatRelativeTime(value?: string | null) {
  if (!value) return '未同步'
  const raw = value.trim()
  const hasTimezone = /(?:[zZ]|[+\-]\d{2}:\d{2})$/.test(raw)
  const normalized = hasTimezone
    ? raw
    : raw.includes('T')
      ? `${raw}Z`
      : `${raw.replace(' ', 'T')}Z`
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return value

  const diff = Date.now() - date.getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} 天前`
  return formatTime(value)
}

export function formatSender(name?: string | null, email?: string | null) {
  const safeName = name?.trim()
  const safeEmail = email?.trim()
  if (safeName && safeEmail) return `${safeName}`
  return safeName || safeEmail || '未知发件人'
}

export function formatDateTime(value?: string | null) {
  return formatTime(value)
}

export async function copyText(text: string) {
  const resolved = String(text ?? '')
  if (!resolved) return

  if (navigator.clipboard?.writeText && window.isSecureContext) {
    await navigator.clipboard.writeText(resolved)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = resolved
  textarea.setAttribute('readonly', 'true')
  textarea.style.position = 'fixed'
  textarea.style.top = '-9999px'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  const ok = document.execCommand('copy')
  document.body.removeChild(textarea)
  if (!ok) throw new Error('复制失败')
}
