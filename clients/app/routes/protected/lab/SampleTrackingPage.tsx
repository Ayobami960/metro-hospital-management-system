import { useState } from 'react'
import { Search, Barcode, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { QueryError, QueryLoading, InlineEmpty } from '@/components/globals/query-state'
import { ServerPager } from '@/components/globals/server-pager'
import {
  useLabOrders,
  useSpecimenCustody,
  useSpecimenLookup,
  useSpecimens,
  useUpdateSpecimenStatus,
} from '@/hooks/laboratory/laboratory.hooks'
import { errorMessage } from '@/services/api/api-error'
import type { Specimen, SpecimenStatus } from '@/services/laboratory/laboratory.api'

const statusClass: Record<SpecimenStatus, string> = {
  COLLECTED: 'bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-400',
  IN_TRANSIT: 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400',
  RECEIVED: 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400',
  PROCESSING: 'bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-400',
  ARCHIVED: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
}

const statusOrder: SpecimenStatus[] = ['COLLECTED', 'IN_TRANSIT', 'RECEIVED', 'PROCESSING', 'ARCHIVED']

function Badge({ status }: { status: string }) {
  const cls = statusClass[status as SpecimenStatus] ?? statusClass.COLLECTED
  return (
    <span className={cn('text-[11px] font-bold px-2.5 py-[3px] rounded-full', cls)}>
      {status.replaceAll('_', ' ')}
    </span>
  )
}

const shortId = (id: string) => id.slice(0, 8).toUpperCase()

export default function SampleTrackingPage() {
  const [page, setPage] = useState(1)
  const [barcodeInput, setBarcodeInput] = useState('')
  const [lookupBarcode, setLookupBarcode] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)

  const specimens = useSpecimens({ page, pageSize: 10 })
  const orders = useLabOrders({ pageSize: 200 })
  const lookup = useSpecimenLookup(lookupBarcode)
  const updateStatus = useUpdateSpecimenStatus()

  const custody = useSpecimenCustody(selectedId)

  const patientByOrderId = new Map(
    (orders.data?.rows ?? []).map((order) => [order.id, `${order.patientName} · MRN ${order.mrn}`]),
  )

  const rows: Specimen[] = [
    ...(lookup.data && !(specimens.data?.rows ?? []).some((s) => s.id === lookup.data?.id)
      ? [lookup.data]
      : []),
    ...(specimens.data?.rows ?? []),
  ]

  const filteredSamples = rows.filter((row) => {
    const patient = patientByOrderId.get(row.labOrderId) ?? ''
    const needle = search.toLowerCase()
    return (
      row.barcode.toLowerCase().includes(needle) ||
      patient.toLowerCase().includes(needle) ||
      row.specimenType.toLowerCase().includes(needle)
    )
  })

  const selectedSample = rows.find((row) => row.id === selectedId)

  const handleBarcodeScan = () => {
    const barcode = barcodeInput.trim()
    if (!barcode) return
    const onPage = rows.find((row) => row.barcode.toLowerCase() === barcode.toLowerCase())
    if (onPage) {
      setSelectedId(onPage.id)
      setLookupBarcode(null)
    } else {
      setLookupBarcode(barcode)
      setSelectedId(null)
    }
    setBarcodeInput('')
  }

  const handleStatusChange = (specimenId: string, status: SpecimenStatus) => {
    setActionError(null)
    updateStatus
      .mutateAsync({ specimenId, input: { status } })
      .catch((error: unknown) => setActionError(errorMessage(error, 'Could not update the specimen.')))
  }

  const card = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 24 }
  const sT = { fontSize: 15, fontWeight: 700, color: 'var(--foreground)', marginBottom: 14, fontFamily: "'Plus Jakarta Sans', sans-serif" }

  const custodyEvents = custody.data ?? []

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--foreground)', marginBottom: 4, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Sample Tracking</h1>
        <p style={{ color: 'var(--muted-foreground)', fontSize: 15 }}>Track specimen chain of custody and status</p>
      </div>

      {/* Barcode scan */}
      <div style={{ ...card, marginBottom: 20, display: 'flex', gap: 12, alignItems: 'center' }}>
        <Barcode size={22} color="var(--muted-foreground)" />
        <input value={barcodeInput} onChange={e => setBarcodeInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleBarcodeScan()}
          placeholder="Scan or type a specimen barcode and press Enter..."
          style={{ flex: 1, padding: '9px 14px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)', fontSize: 13, fontFamily: "'JetBrains Mono', monospace" }} />
        <button onClick={handleBarcodeScan}
          style={{ padding: '9px 18px', borderRadius: 9, border: 'none', background: '#0891b2', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          Look Up
        </button>
      </div>

      {lookupBarcode && lookup.isFetched && !lookup.data && (
        <div style={{ fontSize: 13, fontWeight: 600, color: '#dc2626', marginBottom: 16 }}>
          No specimen found for barcode {lookupBarcode}.
        </div>
      )}

      {actionError && (
        <div style={{ fontSize: 13, fontWeight: 600, color: '#dc2626', marginBottom: 16 }}>{actionError}</div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20 }}>
        {/* Sample log table */}
        <div style={card}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14 }}>
            <div style={sT as React.CSSProperties}>Sample Log</div>
            <div style={{ marginLeft: 'auto', position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)' }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter..."
                style={{ paddingLeft: 28, paddingRight: 10, paddingTop: 7, paddingBottom: 7, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)', fontSize: 12 }} />
            </div>
          </div>

          {specimens.isLoading ? (
            <QueryLoading text="Loading specimens…" />
          ) : specimens.isError ? (
            <QueryError error={specimens.error} onRetry={() => void specimens.refetch()} />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    {['Barcode', 'Patient', 'Collected', 'Type', 'Status', 'Update Status', ''].map(h => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredSamples.map(s => (
                    <tr key={s.id} style={{ borderBottom: '1px solid var(--border)', background: selectedId === s.id ? '#ecfeff' : 'transparent' }}>
                      <td className="py-2.5 px-2.5 font-mono text-[11px] font-bold text-cyan-600 dark:text-cyan-400">{s.barcode}</td>
                      <td style={{ padding: '10px', fontWeight: 600, color: 'var(--foreground)', fontSize: 12 }}>
                        {patientByOrderId.get(s.labOrderId) ?? `Order ${shortId(s.labOrderId)}`}
                      </td>
                      <td style={{ padding: '10px', fontSize: 11, color: 'var(--muted-foreground)', fontFamily: "'JetBrains Mono', monospace" }}>
                        {new Date(s.collectedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={{ padding: '10px', fontSize: 12, color: 'var(--foreground)' }}>{s.specimenType}</td>
                      <td style={{ padding: '10px' }}><Badge status={s.status} /></td>
                      <td style={{ padding: '10px' }}>
                        <select value={s.status} onChange={e => handleStatusChange(s.id, e.target.value as SpecimenStatus)}
                          disabled={updateStatus.isPending}
                          style={{ padding: '5px 8px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)', fontSize: 12, cursor: 'pointer' }}>
                          {statusOrder.map(st => <option key={st} value={st}>{st.replaceAll('_', ' ')}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '10px' }}>
                        <button onClick={() => setSelectedId(s.id === selectedId ? null : s.id)}
                          style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--muted)', color: 'var(--foreground)', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                          Custody <ChevronRight size={11} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredSamples.length === 0 && <InlineEmpty text="No specimens match this filter." />}
              <ServerPager meta={specimens.data?.meta} onPageChange={setPage} />
            </div>
          )}
        </div>

        {/* Chain of custody */}
        <div style={card}>
          <div style={sT as React.CSSProperties}>Chain of Custody</div>
          {!selectedId ? (
            <p style={{ color: 'var(--muted-foreground)', fontSize: 13 }}>Select a sample to view its custody log.</p>
          ) : custody.isLoading ? (
            <QueryLoading text="Loading custody events…" />
          ) : custody.isError ? (
            <QueryError error={custody.error} onRetry={() => void custody.refetch()} />
          ) : (
            <div>
              <div className="font-mono text-xs font-bold text-cyan-600 dark:text-cyan-400 mb-1">{selectedSample?.barcode}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', marginBottom: 16 }}>
                {patientByOrderId.get(selectedSample?.labOrderId ?? '') ?? 'Unknown patient'} — {selectedSample?.specimenType}
              </div>
              {custodyEvents.length === 0 ? (
                <p style={{ color: 'var(--muted-foreground)', fontSize: 13 }}>No custody entries recorded yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {custodyEvents.map((entry, i) => (
                    <div key={entry.id} style={{ display: 'flex', gap: 12 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div className="w-3 h-3 rounded-full bg-cyan-600 dark:bg-cyan-400 mt-[3px] shrink-0" />
                        {i < custodyEvents.length - 1 && <div style={{ width: 2, flex: 1, background: 'var(--border)', margin: '2px 0' }} />}
                      </div>
                      <div style={{ paddingBottom: 16 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 2 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: 'var(--muted-foreground)' }}>
                            {new Date(entry.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <Badge status={entry.toStatus ?? entry.eventType} />
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground)' }}>{entry.location ?? '—'}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{entry.actorId}</div>
                        {entry.notes && <div style={{ fontSize: 11, color: 'var(--muted-foreground)', fontStyle: 'italic', marginTop: 2 }}>{entry.notes}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
