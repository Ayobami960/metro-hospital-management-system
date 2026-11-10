import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { AlertTriangle, CheckCircle, Send, Search, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { QueryError, QueryLoading, InlineEmpty } from '@/components/globals/query-state'
import {
  useAnalyteIndex,
  useEnterLabResults,
  useLabOrders,
  useLabResults,
  useReleaseLabOrder,
} from '@/hooks/laboratory/laboratory.hooks'
import { errorMessage } from '@/services/api/api-error'
import type { LabResultRow } from '@/services/laboratory/laboratory.api'

type Flag = 'CRITICAL LOW' | 'CRITICAL HIGH' | 'LOW' | 'HIGH' | 'Normal'

function getFlag(value: number, low: number | null, high: number | null): Flag {
  if (low !== null && value < low) return 'LOW'
  if (high !== null && value > high) return 'HIGH'
  return 'Normal'
}

const flagClass: Record<string, string> = {
  'CRITICAL LOW': 'bg-red-900 dark:bg-red-800 text-white',
  'CRITICAL HIGH': 'bg-red-900 dark:bg-red-800 text-white',
  LOW: 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400',
  HIGH: 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400',
  Normal: 'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400',
}

const flagBadgeClass: Record<string, string> = {
  NORMAL: 'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400',
  HIGH: 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400',
  LOW: 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400',
  CRITICAL_HIGH: 'bg-red-900 dark:bg-red-800 text-white',
  CRITICAL_LOW: 'bg-red-900 dark:bg-red-800 text-white',
}

const shortId = (id: string) => id.slice(0, 8).toUpperCase()
const isAbnormal = (flag: Flag) => flag !== 'Normal'
const isCriticalFlag = (flag: string | null) => flag === 'CRITICAL_HIGH' || flag === 'CRITICAL_LOW'

export default function ResultsEntryPage() {
  const [searchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [selectedOrderId, setSelectedOrderId] = useState<string>(searchParams.get('order') ?? '')
  const [selectedItemId, setSelectedItemId] = useState('')
  const [values, setValues] = useState<Record<string, string>>({})
  const [released, setReleased] = useState(false)
  const [showCritical, setShowCritical] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const orders = useLabOrders({ pageSize: 50 })
  const results = useLabResults({ pageSize: 200 })
  const analytes = useAnalyteIndex()
  const enterResults = useEnterLabResults()
  const release = useReleaseLabOrder()

  const openOrders = (orders.data?.rows ?? []).filter(
    (order) => order.status !== 'RELEASED' && order.status !== 'CANCELLED',
  )
  const filteredOrders = openOrders.filter((order) => {
    const needle = search.toLowerCase()
    return (
      order.patientName.toLowerCase().includes(needle) ||
      order.mrn.toLowerCase().includes(needle) ||
      order.id.toLowerCase().includes(needle)
    )
  })

  const selectedOrder = openOrders.find((order) => order.id === selectedOrderId)

  /**
   * The API does not expose an order's items, so entry works from the items that
   * already have at least one result row for this order.
   */
  const orderResults = useMemo(
    () => (results.data?.rows ?? []).filter((row) => row.labOrderId === selectedOrderId),
    [results.data, selectedOrderId],
  )

  const items = useMemo(() => {
    const byItem = new Map<string, LabResultRow[]>()
    for (const row of orderResults) {
      const bucket = byItem.get(row.labOrderItemId) ?? []
      bucket.push(row)
      byItem.set(row.labOrderItemId, bucket)
    }
    return [...byItem.entries()].map(([itemId, rows]) => {
      const testInfo = analytes.data.get(rows[0]?.analyteId ?? '')
      return {
        itemId,
        testId: testInfo?.testId ?? '',
        testName: testInfo?.testName ?? `Item ${shortId(itemId)}`,
        rows,
      }
    })
  }, [orderResults, analytes.data])

  const selectedItem = items.find((item) => item.itemId === selectedItemId)

  const fields = useMemo(() => {
    if (!selectedItem || !selectedItem.testId) return []
    const catalogue = [...analytes.data.values()].filter((entry) => entry.testId === selectedItem.testId)
    const seen = new Set<string>()
    return catalogue.filter((entry) => {
      if (seen.has(entry.analyteId)) return false
      seen.add(entry.analyteId)
      return true
    })
  }, [selectedItem, analytes.data])

  const valueFor = (analyteId: string, row?: LabResultRow) =>
    values[analyteId] ?? (row?.valueNumeric !== null && row?.valueNumeric !== undefined
      ? String(row.valueNumeric)
      : (row?.valueText ?? ''))

  const computed = fields.map((field) => {
    const raw = valueFor(field.analyteId, selectedItem?.rows.find((row) => row.analyteId === field.analyteId))
    const parsed = Number.parseFloat(raw)
    return {
      analyteId: field.analyteId,
      name: field.name,
      unit: field.unit,
      low: field.referenceLow,
      high: field.referenceHigh,
      raw,
      flag: Number.isFinite(parsed) ? getFlag(parsed, field.referenceLow, field.referenceHigh) : null,
      numeric: Number.isFinite(parsed) ? parsed : null,
    }
  })

  const abnormal = computed.filter((field) => field.flag !== null && isAbnormal(field.flag))
  const allFilled = computed.length > 0 && computed.every((field) => field.raw.trim() !== '')

  const criticalResults = orderResults.filter((row) => !row.releasedAt && isCriticalFlag(row.flag))

  const resetSelection = (orderId: string) => {
    setSelectedOrderId(orderId)
    setSelectedItemId('')
    setValues({})
    setReleased(false)
    setActionError(null)
  }

  const runRelease = (acknowledgedCriticalIds: string[]) => {
    setActionError(null)
    release
      .mutateAsync({
        orderId: selectedOrderId,
        input: { itemIds: selectedItemId ? [selectedItemId] : undefined, acknowledgedCriticalIds },
      })
      .then(() => {
        setReleased(true)
        setShowCritical(false)
      })
      .catch((error: unknown) => {
        setShowCritical(false)
        setActionError(errorMessage(error, 'Could not release the results.'))
      })
  }

  const handleRelease = () => {
    if (!selectedItemId || !allFilled) return
    setActionError(null)
    enterResults
      .mutateAsync({
        orderId: selectedOrderId,
        input: {
          itemId: selectedItemId,
          values: computed
            .filter((field) => field.numeric !== null)
            .map((field) => ({
              analyteId: field.analyteId,
              valueNumeric: field.numeric as number,
              unit: field.unit ?? undefined,
            })),
        },
      })
      .then(() => {
        if (criticalResults.length > 0) {
          setShowCritical(true)
          return
        }
        runRelease([])
      })
      .catch((error: unknown) => setActionError(errorMessage(error, 'Could not save the results.')))
  }

  const card = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 24 }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--foreground)', marginBottom: 4, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Results Entry</h1>
        <p style={{ color: 'var(--muted-foreground)', fontSize: 15 }}>Enter and release laboratory test results</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20 }}>
        {/* Left: Select Request */}
        <div style={card}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--foreground)', marginBottom: 14, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Select Test Request</div>
          <div style={{ position: 'relative', marginBottom: 14 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search patient or ID..."
              style={{ width: '100%', paddingLeft: 32, paddingRight: 10, paddingTop: 8, paddingBottom: 8, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)', fontSize: 13, boxSizing: 'border-box' }} />
          </div>

          {orders.isLoading ? (
            <QueryLoading text="Loading requests…" />
          ) : orders.isError ? (
            <QueryError error={orders.error} onRetry={() => void orders.refetch()} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filteredOrders.map(order => (
                <div key={order.id} onClick={() => resetSelection(order.id)}
                  className={cn('py-2.5 px-3 rounded-[10px] border-[1.5px] cursor-pointer', selectedOrderId === order.id ? 'border-cyan-600 dark:border-cyan-400 bg-cyan-50 dark:bg-cyan-950/30' : 'border-border bg-background')}>
                  <div className="font-mono text-[11px] font-bold text-cyan-600 dark:text-cyan-400">{shortId(order.id)}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>{order.patientName}</div>
                  <div className="flex gap-1 flex-wrap mt-1">
                    <span className="text-[10px] px-1.5 py-px rounded bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 font-semibold">{order.itemCount} tests</span>
                    <span className="text-[10px] px-1.5 py-px rounded bg-muted text-muted-foreground font-semibold">{order.status.replaceAll('_', ' ')}</span>
                  </div>
                </div>
              ))}
              {filteredOrders.length === 0 && <InlineEmpty text="No open test requests." />}
            </div>
          )}
        </div>

        {/* Right: Entry Form */}
        <div>
          {!selectedOrder ? (
            <div style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
              <p style={{ color: 'var(--muted-foreground)', fontSize: 15 }}>Select a test request to begin entry</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div style={card}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--foreground)', marginBottom: 6, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  {selectedOrder.patientName} — {shortId(selectedOrder.id)}
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 14 }}>
                  MRN {selectedOrder.mrn} · {selectedOrder.priority} · {selectedOrder.itemCount} ordered {selectedOrder.itemCount === 1 ? 'test' : 'tests'} · ordered {new Date(selectedOrder.orderedAt).toLocaleString()}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {items.map(item => (
                    <button key={item.itemId} onClick={() => { setSelectedItemId(item.itemId); setValues({}); setReleased(false); setActionError(null) }}
                      className={cn('py-[7px] px-4 rounded-lg border-[1.5px] text-[13px] font-semibold cursor-pointer', selectedItemId === item.itemId ? 'bg-cyan-600 text-white border-cyan-600' : 'bg-background text-foreground border-border')}>
                      {item.testName}
                    </button>
                  ))}
                </div>
                {items.length === 0 && (
                  <div className="flex items-start gap-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-[10px] py-3 px-4">
                    <Info size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-[1px]" />
                    <span className="text-[12px] text-amber-800 dark:text-amber-300">
                      This order has no recorded results yet. The API requires a laboratory order item id to file results, and no endpoint lists an order's items, so entry is only possible for items that already carry at least one result. Collection, specimen tracking and release remain available.
                    </span>
                  </div>
                )}
              </div>

              {selectedItem && computed.length > 0 && (
                <div style={card}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--foreground)', marginBottom: 18, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{selectedItem.testName} Results</div>
                  {released && (
                    <div className="flex items-center gap-2.5 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-[10px] py-3 px-4 mb-4">
                      <CheckCircle size={18} className="text-green-600 dark:text-green-400" />
                      <span className="text-[13px] font-bold text-green-700 dark:text-green-400">Results signed and released to ordering physician</span>
                    </div>
                  )}
                  {actionError && (
                    <div className="text-[13px] font-semibold text-red-600 dark:text-red-400 mb-4">{actionError}</div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {computed.map(field => {
                      const existing = selectedItem.rows.find(row => row.analyteId === field.analyteId)
                      const fc = field.flag ? flagClass[field.flag] : null
                      return (
                        <div key={field.analyteId} style={{ display: 'grid', gridTemplateColumns: '160px 160px 1fr auto', gap: 12, alignItems: 'center' }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>{field.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--muted-foreground)', fontFamily: "'JetBrains Mono', monospace" }}>{field.unit ?? '—'}</div>
                          </div>
                          <input type="number" value={valueFor(field.analyteId, existing)}
                            onChange={e => setValues(v => ({ ...v, [field.analyteId]: e.target.value }))} placeholder="Enter value"
                            style={{ padding: '8px 12px', borderRadius: 8, border: `1.5px solid ${fc && field.flag && isAbnormal(field.flag) ? '#dc2626' : 'var(--border)'}`, background: 'var(--background)', color: 'var(--foreground)', fontSize: 13, fontFamily: "'JetBrains Mono', monospace" }} />
                          <div style={{ fontSize: 12, color: 'var(--muted-foreground)', fontFamily: "'JetBrains Mono', monospace" }}>
                            Ref: {field.low ?? '—'} – {field.high ?? '—'} {field.unit ?? ''}
                          </div>
                          {field.flag && (
                            <span className={cn('text-[11px] font-bold px-2.5 py-[3px] rounded-full whitespace-nowrap', flagClass[field.flag] ?? 'bg-muted text-muted-foreground')}>{field.flag}</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  <div style={{ marginTop: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
                    <button onClick={handleRelease} disabled={!allFilled || released || enterResults.isPending || release.isPending}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 22px', borderRadius: 10, border: 'none', background: allFilled && !released ? '#16a34a' : 'var(--muted)', color: allFilled && !released ? 'white' : 'var(--muted-foreground)', fontSize: 14, fontWeight: 700, cursor: allFilled && !released ? 'pointer' : 'not-allowed' }}>
                      <Send size={15} /> {enterResults.isPending || release.isPending ? 'Saving…' : 'Sign & Release'}
                    </button>
                    {abnormal.length > 0 && (
                      <span style={{ fontSize: 12, color: '#dc2626', fontWeight: 600 }}>
                        {abnormal.length} value{abnormal.length === 1 ? '' : 's'} outside the reference range
                      </span>
                    )}
                  </div>
                </div>
              )}

              {orderResults.length > 0 && (
                <div style={card}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--foreground)', marginBottom: 14, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Recorded Results</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--border)' }}>
                        {['Analyte', 'Value', 'Flag', 'Entered', 'Released'].map(header => (
                          <th key={header} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)' }}>{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {orderResults.map(row => {
                        const meta = analytes.data.get(row.analyteId)
                        return (
                          <tr key={row.id} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '10px', color: 'var(--foreground)' }}>{meta?.name ?? shortId(row.analyteId)}</td>
                            <td style={{ padding: '10px', fontFamily: "'JetBrains Mono', monospace", color: 'var(--foreground)' }}>
                              {row.valueNumeric ?? row.valueText ?? '—'} {row.unit ?? meta?.unit ?? ''}
                            </td>
                            <td style={{ padding: '10px' }}>
                              <span className={cn('text-[11px] font-bold px-2.5 py-[3px] rounded-full', flagBadgeClass[row.flag ?? 'NORMAL'] ?? 'bg-muted text-muted-foreground')}>
                                {(row.flag ?? 'NORMAL').replaceAll('_', ' ')}
                              </span>
                            </td>
                            <td style={{ padding: '10px', fontSize: 11, color: 'var(--muted-foreground)', fontFamily: "'JetBrains Mono', monospace" }}>{new Date(row.enteredAt).toLocaleString()}</td>
                            <td style={{ padding: '10px', fontSize: 11, color: 'var(--muted-foreground)', fontFamily: "'JetBrains Mono', monospace" }}>
                              {row.releasedAt ? new Date(row.releasedAt).toLocaleDateString() : '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Abnormal Value Alert */}
      {showCritical && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--card)', borderRadius: 16, padding: 28, width: 420, border: '2px solid #dc2626' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <AlertTriangle size={22} className="text-red-600 dark:text-red-400" />
              <h3 className="text-[17px] font-extrabold text-red-600 dark:text-red-400 font-['Plus_Jakarta_Sans',sans-serif]">Critical Value Alert</h3>
            </div>
            <p style={{ fontSize: 13, color: 'var(--foreground)', marginBottom: 8 }}>This order has results flagged as <strong>critically abnormal</strong>. The ordering physician must be notified before release.</p>
            <div style={{ background: '#fee2e2', borderRadius: 10, padding: '12px 16px', marginBottom: 18 }}>
              {criticalResults.map(row => (
                <div key={row.id} style={{ fontSize: 13, color: '#991b1b', fontWeight: 600 }}>
                  {analytes.data.get(row.analyteId)?.name ?? shortId(row.analyteId)}: {row.valueNumeric ?? row.valueText} {row.unit ?? ''} — {(row.flag ?? '').replaceAll('_', ' ')}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowCritical(false)}
                style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--muted)', color: 'var(--foreground)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={() => runRelease(criticalResults.map(row => row.id))}
                style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: '#dc2626', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                Physician Notified — Release
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
