// ==================== TYPES ====================

export interface FBUserInfo {
  id: string
  name: string
}

export interface FBAdAccount {
  id: string
  account_id: string
  name: string
  account_status: number
  amount_spent: string
  balance: string
  spend_cap: string
  currency: string
  business_name: string | null
  business?: { id: string; name: string }
  funding_source_details?: {
    display_string?: string
    type?: number
  }
  disable_reason: number
  created_time: string
}

export interface FBBusiness {
  id: string
  name: string
  created_time: string
  verification_status: string
  permitted_roles: string[]
}

export interface ParsedAdAccount {
  index: number
  name: string
  accountId: string
  fullId: string
  status: string
  statusVariant: 'success' | 'danger' | 'warning' | 'info' | 'default'
  spendingLimit: number | null
  balance: number
  amountSpent: number
  currency: string
  businessName: string
  fundingSource: string
  createdTime: string
}

export interface ParsedBusiness {
  index: number
  name: string
  bmId: string
  roles: string
  verificationStatus: string
  adAccountCount: number | null
  createdTime: string
}

// ==================== CONSTANTS ====================

export const ACCOUNT_STATUS_MAP: Record<number, { label: string; variant: 'success' | 'danger' | 'warning' | 'info' | 'default' }> = {
  1:   { label: 'Active',              variant: 'success' },
  2:   { label: 'Disabled',            variant: 'danger' },
  3:   { label: 'Unsettled',           variant: 'warning' },
  7:   { label: 'Pending Risk Review', variant: 'warning' },
  8:   { label: 'Pending Settlement',  variant: 'warning' },
  9:   { label: 'In Grace Period',     variant: 'info' },
  100: { label: 'Pending Closure',     variant: 'danger' },
  101: { label: 'Closed',             variant: 'default' },
  201: { label: 'Any Active',         variant: 'success' },
  202: { label: 'Any Closed',         variant: 'default' },
}

export const DISABLE_REASON_MAP: Record<number, string> = {
  0: 'None',
  1: 'Ads integrity policy',
  2: 'Terms of service',
  3: 'Unused reseller account',
  4: 'Gray account shut down',
  5: 'ADS_INTEGRITY_POLICY',
  6: 'Business integrity policy',
  7: 'Permanent close',
  8: 'UNUSED_ACCOUNT',
  9: 'Lockout',
}

// ==================== HELPERS ====================

export function centsToAmount(cents: string | undefined | null): number {
  if (!cents || cents === '0') return 0
  return parseFloat(cents) / 100
}

export function getAccountStatus(statusCode: number) {
  return ACCOUNT_STATUS_MAP[statusCode] || { label: `Unknown (${statusCode})`, variant: 'default' as const }
}

export function parseAdAccount(account: FBAdAccount, index: number): ParsedAdAccount {
  const status = getAccountStatus(account.account_status)
  return {
    index: index + 1,
    name: account.name || 'Unnamed',
    accountId: account.account_id,
    fullId: account.id,
    status: status.label,
    statusVariant: status.variant,
    spendingLimit: account.spend_cap ? centsToAmount(account.spend_cap) : null,
    balance: centsToAmount(account.balance),
    amountSpent: centsToAmount(account.amount_spent),
    currency: account.currency || 'USD',
    businessName: account.business?.name || account.business_name || '-',
    fundingSource: account.funding_source_details?.display_string || '-',
    createdTime: account.created_time,
  }
}

export function parseBusiness(bm: FBBusiness, index: number, adAccountCount: number | null): ParsedBusiness {
  return {
    index: index + 1,
    name: bm.name,
    bmId: bm.id,
    roles: bm.permitted_roles?.join(', ') || '-',
    verificationStatus: bm.verification_status || '-',
    adAccountCount,
    createdTime: bm.created_time,
  }
}

// ==================== EXPORT ====================

export function exportAccountsToCSV(accounts: ParsedAdAccount[]) {
  const headers = ['#', 'Account Name', 'Account ID', 'Status', 'Spending Limit', 'Balance', 'Amount Spent', 'Currency', 'Business Name', 'Funding Source', 'Created Date']
  const rows = accounts.map(a => [
    a.index,
    a.name,
    a.accountId,
    a.status,
    a.spendingLimit !== null ? a.spendingLimit.toFixed(2) : 'Unlimited',
    a.balance.toFixed(2),
    a.amountSpent.toFixed(2),
    a.currency,
    a.businessName,
    a.fundingSource,
    a.createdTime,
  ])

  downloadCSV([headers, ...rows], `ad-accounts-${Date.now()}.csv`)
}

export function exportBMsToCSV(businesses: ParsedBusiness[]) {
  const headers = ['#', 'BM Name', 'BM ID', 'Roles', 'Verification Status', 'Ad Accounts', 'Created Date']
  const rows = businesses.map(b => [
    b.index,
    b.name,
    b.bmId,
    b.roles,
    b.verificationStatus,
    b.adAccountCount !== null ? b.adAccountCount : '-',
    b.createdTime,
  ])

  downloadCSV([headers, ...rows], `business-managers-${Date.now()}.csv`)
}

function downloadCSV(data: (string | number | null)[][], filename: string) {
  const csvContent = data
    .map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n')

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
