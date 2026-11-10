import { useMemo, useState } from 'react'
import { Download, FileSpreadsheet, FileText, TrendingUp, DollarSign, CreditCard, BarChart2 } from 'lucide-react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { QueryError, QueryLoading, InlineEmpty } from '@/components/globals/query-state'
import { useBillingDashboard, useBillingReports } from '@/hooks/billing/billing.hooks'
import { compactMoney, label, money, pct } from '@/lib/format'
import { API_ENDPOINTS } from '@/services/api/endpoints'
import { downloadFile } from '@/services/api/client'
import { errorMessage } from '@/services/api/api-error'

const reportTypes = ['Revenue Summary', 'Claims & Denials', 'Receivables Ageing']
const datePresets = ['This Month', 'Last 3 Months', 'Last 12 Months', 'Year to Date'] as const
type DatePreset = (typeof datePresets)[number]

const rangeFor = (preset: DatePreset): { from: string; to: string } => {
  const now = new Date()
  const to = now.toISOString().slice(0, 10)
  if (preset === 'This Month') {
    return { from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10), to }
  }
  if (preset === 'Last 3 Months') {
    const from = new Date(now)
    from.setMonth(from.getMonth() - 2, 1)
    return { from: from.toISOString().slice(0, 10), to }
  }
  if (preset === 'Year to Date') {
    return { from: new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10), to }
  }
  return { from: new Date(now.getFullYear(), now.getMonth() - 11, 1).toISOString().slice(0, 10), to }
}

export default function ReportsPage() {
  const [selectedReport, setSelectedReport] = useState(reportTypes[0])
  const [selectedPreset, setSelectedPreset] = useState<DatePreset>('Last 12 Months')
  const [exportError, setExportError] = useState<string | null>(null)

  const range = useMemo(() => rangeFor(selectedPreset), [selectedPreset])
  const reports = useBillingReports(range.from, range.to)
  const dashboard = useBillingDashboard()

  const trend = useMemo(() => {
    const buckets = new Map<string, number>()
    for (const row of reports.data?.revenueByDay ?? []) {
      const key = new Date(row.day).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
      buckets.set(key, (buckets.get(key) ?? 0) + row.amountMinor / 100)
    }
    return [...buckets.entries()].map(([month, collected]) => ({ month, collected }))
  }, [reports.data])

  const methodData = (reports.data?.revenueByMethod ?? []).map(row => ({
    method: label(row.method),
    revenue: Math.round(row.amountMinor / 100),
  }))

  const ageingData = reports.data
    ? [
        { bucket: 'Current', amountMinor: reports.data.ageing.current },
        { bucket: '1-30d', amountMinor: reports.data.ageing.d1to30 },
        { bucket: '31-60d', amountMinor: reports.data.ageing.d31to60 },
        { bucket: '61-90d', amountMinor: reports.data.ageing.d61to90 },
        { bucket: '90d+', amountMinor: reports.data.ageing.over90 },
      ]
    : []

  const approvedMinor = (reports.data?.claimOutcomes ?? [])
    .filter(outcome => outcome.status === 'APPROVED' || outcome.status === 'PARTIALLY_APPROVED')
    .reduce((total, outcome) => total + outcome.approvedMinor, 0)
  const claimsDecided = (reports.data?.claimOutcomes ?? [])
    .filter(outcome => outcome.status === 'APPROVED' || outcome.status === 'PARTIALLY_APPROVED' || outcome.status === 'DENIED')
    .reduce((total, outcome) => total + outcome.count, 0)
  const claimsApproved = (reports.data?.claimOutcomes ?? [])
    .filter(outcome => outcome.status === 'APPROVED' || outcome.status === 'PARTIALLY_APPROVED')
    .reduce((total, outcome) => total + outcome.count, 0)

  const kpis = [
    {
      label: 'Collected',
      value: compactMoney(reports.data?.collectedMinor),
      icon: DollarSign,
      color: '#2563eb',
      bg: '#dbeafe',
      sub: `${selectedPreset}`,
    },
    {
      label: 'Approved by Insurers',
      value: compactMoney(approvedMinor),
      icon: TrendingUp,
      color: '#16a34a',
      bg: '#dcfce7',
      sub: `${money(reports.data?.collectedMinor)} collected`,
    },
    {
      label: 'Outstanding',
      value: compactMoney(dashboard.data?.stats.outstandingMinor),
      icon: CreditCard,
      color: '#dc2626',
      bg: '#fee2e2',
      sub: 'Live patient balance',
    },
    {
      label: 'Claim Approval Rate',
      value: pct(claimsDecided > 0 ? Math.round((claimsApproved / claimsDecided) * 100) : null),
      icon: BarChart2,
      color: '#d97706',
      bg: '#fef9c3',
      sub: `${claimsDecided} decided claims`,
    },
  ]

  const handleExport = (format: 'PDF' | 'CSV' | 'Excel') => {
    if (format !== 'CSV') {
      setExportError('Only CSV export is available from the API today.')
      return
    }
    setExportError(null)
    downloadFile(API_ENDPOINTS.exports('invoices'), 'invoices.csv', {
      params: { from: range.from, to: range.to },
    }).catch((error: unknown) => setExportError(errorMessage(error, 'Could not export invoices.')))
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-[26px] font-extrabold text-foreground mb-1 font-['Plus_Jakarta_Sans',sans-serif]">Financial Reports</h1>
          <p className="text-muted-foreground text-[15px]">Analyze revenue, collections, and financial performance</p>
        </div>
        <div className="flex gap-2">
          {[
            { label: 'PDF', icon: FileText, color: '#dc2626' },
            { label: 'CSV', icon: FileSpreadsheet, color: '#16a34a' },
            { label: 'Excel', icon: Download, color: '#2563eb' },
          ].map(btn => {
            const Icon = btn.icon
            return (
              <button key={btn.label} onClick={() => handleExport(btn.label as 'PDF' | 'CSV' | 'Excel')}
                className="flex items-center gap-1.5 py-[9px] px-4 bg-muted border border-border rounded-lg text-[13px] font-bold cursor-pointer" style={{ color: btn.color }}>
                <Icon size={14} /> {btn.label}
              </button>
            )
          })}
        </div>
      </div>

      {exportError && (
        <div className="text-[13px] font-semibold text-red-600 dark:text-red-400 mb-4">{exportError}</div>
      )}

      {/* Controls */}
      <div className="bg-card border border-border rounded-2xl p-6 mb-6">
        <div className="flex gap-4 flex-wrap items-center">
          <div>
            <label className="text-xs font-bold text-muted-foreground block mb-1.5">REPORT TYPE</label>
            <div className="flex gap-1 flex-wrap">
              {reportTypes.map(r => (
                <button key={r} onClick={() => setSelectedReport(r)}
                  className="py-[7px] px-3.5 border-none rounded-lg cursor-pointer text-[13px] font-semibold transition-all duration-150"
                  style={{ background: selectedReport === r ? '#2563eb' : 'var(--muted)', color: selectedReport === r ? 'white' : 'var(--muted-foreground)' }}>
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div className="ml-auto">
            <label className="text-xs font-bold text-muted-foreground block mb-1.5">DATE RANGE</label>
            <div className="flex gap-1">
              {datePresets.map(p => (
                <button key={p} onClick={() => setSelectedPreset(p)}
                  className="py-[7px] px-3.5 rounded-lg cursor-pointer text-[13px] font-semibold"
                  style={{ border: `1px solid ${selectedPreset === p ? '#2563eb' : 'var(--border)'}`, background: selectedPreset === p ? '#dbeafe' : 'var(--muted)', color: selectedPreset === p ? '#2563eb' : 'var(--muted-foreground)' }}>
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {reports.isLoading ? (
        <QueryLoading text="Loading financial report…" />
      ) : reports.isError ? (
        <QueryError error={reports.error} onRetry={() => void reports.refetch()} />
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            {kpis.map(k => {
              const Icon = k.icon
              return (
                <div key={k.label} className="bg-card border border-border rounded-2xl p-6 flex gap-3.5 items-center">
                  <div className="w-[46px] h-[46px] rounded-[14px] flex items-center justify-center shrink-0" style={{ backgroundColor: k.bg }}><Icon size={20} color={k.color} /></div>
                  <div>
                    <div className="text-[22px] font-extrabold text-foreground font-mono">{k.value}</div>
                    <div className="text-xs text-muted-foreground">{k.label}</div>
                    <div className="text-[11px] font-semibold" style={{ color: k.color }}>{k.sub}</div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Revenue Trend */}
          <div className="bg-card border border-border rounded-2xl p-6 mb-5">
            <h3 className="text-[15px] font-bold text-foreground mb-5 font-['Plus_Jakarta_Sans',sans-serif]">Collected Trend — {selectedPreset}</h3>
            {trend.length === 0 ? (
              <InlineEmpty text="No collections recorded in this range." />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
                  <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} formatter={(v: unknown) => [`$${Number(v).toLocaleString()}`, 'Collected']} />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
                  <Line type="monotone" dataKey="collected" name="Collected" stroke="#16a34a" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Revenue by Payment Method */}
          <div className="bg-card border border-border rounded-2xl p-6 mb-5">
            <h3 className="text-[15px] font-bold text-foreground mb-5 font-['Plus_Jakarta_Sans',sans-serif]">Revenue by Payment Method</h3>
            {methodData.length === 0 ? (
              <InlineEmpty text="No payments recorded in this range." />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={methodData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
                  <YAxis type="category" dataKey="method" tick={{ fontSize: 12, fill: 'var(--foreground)', fontWeight: 600 }} axisLine={false} tickLine={false} width={120} />
                  <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} formatter={(v: unknown) => [`$${Number(v).toLocaleString()}`, 'Revenue']} />
                  <Bar dataKey="revenue" fill="#2563eb" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Receivables ageing */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <h3 className="text-[15px] font-bold text-foreground mb-5 font-['Plus_Jakarta_Sans',sans-serif]">Receivables Ageing</h3>
            <div className="grid grid-cols-5 gap-3">
              {ageingData.map(entry => (
                <div key={entry.bucket} className="bg-muted rounded-xl p-4 text-center">
                  <div className="text-lg font-extrabold text-foreground font-mono">{compactMoney(entry.amountMinor)}</div>
                  <div className="text-[11px] text-muted-foreground mt-1">{entry.bucket}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
