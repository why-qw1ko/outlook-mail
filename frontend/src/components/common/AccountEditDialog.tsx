import { useId, useRef, useState, type FormEvent } from 'react'
import { Dialog } from '@/components/common/AppDialog'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { Label, Select } from '@/components/ui/primitives'
import { updateAccount, type UpdateAccountPayload } from '@/lib/api'
import type { AccountItem, SiteItem } from '@/lib/types'

export function AccountEditDialog({ account, sites, onClose, onSaved }: {
  account: AccountItem
  sites: SiteItem[]
  onClose: () => void
  onSaved: () => void
}) {
  const formId = useId()
  const saving = useRef(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const currentGroupId = account.group_site_id
  const currentSite = sites.find((site) => site.id === currentGroupId)
  const availableSites = sites.filter((site) => site.enabled && site.id !== currentGroupId)

  const close = () => {
    if (!saving.current) onClose()
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (saving.current) return
    const data = new FormData(event.currentTarget)
    const group = String(data.get('group_site_id') ?? '')
    const groupSiteId = group ? Number(group) : null
    const batchCode = String(data.get('batch_code') ?? '').trim()
    const note = String(data.get('note') ?? '').trim()
    const password = String(data.get('password') ?? '').trim()
    const clientId = String(data.get('client_id') ?? '').trim()
    const refreshToken = String(data.get('refresh_token') ?? '').trim()

    if (Boolean(clientId) !== Boolean(refreshToken)) {
      setError('更新 OAuth 凭据时，请同时填写 Client ID 和 Refresh Token。')
      return
    }

    const payload: UpdateAccountPayload = {}
    if (groupSiteId !== currentGroupId) payload.group_site_id = groupSiteId
    if (batchCode !== account.batch_code.trim()) payload.batch_code = batchCode
    if (note !== account.note.replace(/\r\n?/g, '\n').trim()) payload.note = note
    if (password) payload.password = password
    if (clientId && refreshToken) {
      payload.client_id = clientId
      payload.refresh_token = refreshToken
    }
    if (Object.keys(payload).length === 0) {
      onClose()
      return
    }

    saving.current = true
    setPending(true)
    setError('')
    try {
      await updateAccount(account.id, payload)
      onSaved()
    } catch (error) {
      setError(error instanceof Error ? error.message : '更新邮箱失败')
    } finally {
      saving.current = false
      setPending(false)
    }
  }

  return (
    <Dialog
      open
      onClose={close}
      title="编辑邮箱"
      description={account.email}
      descriptionClassName="break-all"
      footer={
        <>
          <Button type="button" variant="outline" onClick={close} disabled={pending}>取消</Button>
          <Button type="submit" form={formId} loading={pending}>保存</Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} onChange={() => { if (error) setError('') }}>
        <fieldset disabled={pending} className="min-w-0 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`${formId}-group`}>站点分组</Label>
              <Select id={`${formId}-group`} name="group_site_id" defaultValue={currentGroupId ?? ''}>
                <option value="">无分组</option>
                {currentGroupId !== null && (
                  <option value={currentGroupId}>
                    {currentSite
                      ? `${currentSite.name || currentSite.code}（${currentSite.code}）`
                      : account.group_site_name || account.group_site_code || `原分组（${currentGroupId}）`}
                  </option>
                )}
                {availableSites.map((site) => (
                  <option key={site.id} value={site.id}>{site.name || site.code}（{site.code}）</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${formId}-batch`}>批次编码</Label>
              <Input id={`${formId}-batch`} name="batch_code" defaultValue={account.batch_code} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${formId}-note`}>备注</Label>
            <Textarea id={`${formId}-note`} name="note" rows={3} defaultValue={account.note} />
          </div>
          <div className="space-y-4 border-t border-border pt-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">更换凭据</p>
              <p className="text-paragraph text-xs">留空保留原值。更新 OAuth 凭据需同时填写 Client ID 和 Refresh Token。</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${formId}-password`}>新密码</Label>
              <Input id={`${formId}-password`} name="password" type="password" autoComplete="new-password" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`${formId}-client-id`}>Client ID</Label>
                <Input id={`${formId}-client-id`} name="client_id" autoComplete="off" spellCheck={false} />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${formId}-refresh-token`}>Refresh Token</Label>
                <Input id={`${formId}-refresh-token`} name="refresh_token" type="password" autoComplete="new-password" />
              </div>
            </div>
          </div>
        </fieldset>
        {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
      </form>
    </Dialog>
  )
}
