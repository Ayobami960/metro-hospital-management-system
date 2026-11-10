import { useState } from 'react'
import { Image, Upload, FileText, Clock, CheckCircle, Activity } from 'lucide-react'
import { QueryError, QueryLoading, InlineEmpty } from '@/components/globals/query-state'
import { ServerPager } from '@/components/globals/server-pager'
import {
  useRadiologyOrders,
  useSubmitRadiologyReport,
  useUpdateRadiologyStatus,
} from '@/hooks/diagnostics/diagnostics.hooks'
import { errorMessage } from '@/services/api/api-error'
import type { RadiologyOrder, StudyStatus } from '@/services/diagnostics/diagnostics.api'

const statusColors: Record<StudyStatus, { bg: string; color: string }> = {
  ORDERED: { bg: '#f1f5f9', color: '#64748b' },
  SCHEDULED: { bg: '#ede9fe', color: '#7c3aed' },
  IN_PROGRESS: { bg: '#fef9c3', color: '#ca8a04' },
  COMPLETED: { bg: '#dcfce7', color: '#16a34a' },
  CANCELLED: { bg: '#f1f5f9', color: '#64748b' },
}

const priorityColors: Record<string, { bg: string; color: string }> = {
  STAT: { bg: '#fee2e2', color: '#dc2626' },
  URGENT: { bg: '#fef9c3', color: '#ca8a04' },
  ROUTINE: { bg: '#f1f5f9', color: '#64748b' },
}

const studyTypeIcons: Record<string, string> = {
  'X-Ray': '🦴',
  MRI: '🧠',
  'CT Scan': '💻',
  Ultrasound: '〰️',
}

const tabs = ['All', 'X-Ray', 'MRI', 'CT Scan', 'Ultrasound'] as const
type TabType = (typeof tabs)[number]

function Badge({ label, colors }: { label: string; colors: { bg: string; color: string } }) {
  return <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 100, background: colors.bg, color: colors.color }}>{label.replaceAll('_', ' ')}</span>
}

const shortId = (id: string) => id.slice(0, 8).toUpperCase()

const iconFor = (studyType: string) =>
  studyTypeIcons[studyType] ?? Object.entries(studyTypeIcons).find(([key]) => studyType.toLowerCase().includes(key.toLowerCase()))?.[1] ?? '🩻'

export default function RadiologyPage() {
  const [activeTab, setActiveTab] = useState<TabType>('All')
  const [page, setPage] = useState(1)
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [findings, setFindings] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)

  const ordersQuery = useRadiologyOrders({ page, pageSize: 20 })
  const submitReport = useSubmitRadiologyReport()
  const updateStatus = useUpdateRadiologyStatus()

  const orders = ordersQuery.data?.rows ?? []
  const filtered = activeTab === 'All' ? orders : orders.filter(o => o.studyType.toLowerCase().includes(activeTab.toLowerCase()))
  const selected: RadiologyOrder | undefined = orders.find(o => o.id === selectedOrderId)

  const isToday = (value: string) => new Date(value).toDateString() === new Date().toDateString()
  const ordersToday = orders.filter(o => isToday(o.orderedAt)).length
  const completed = orders.filter(o => o.status === 'COMPLETED').length
  const pendingRead = orders.filter(o => Boolean(o.performedAt) && !o.reportSignedAt).length

  const stats = [
    { label: 'Orders Today', value: ordersToday, icon: Activity, color: '#2563eb', bg: '#dbeafe' },
    { label: 'Completed', value: completed, icon: CheckCircle, color: '#16a34a', bg: '#dcfce7' },
    { label: 'Pending Read', value: pendingRead, icon: Clock, color: '#ea580c', bg: '#fed7aa' },
  ]

  const handleSelect = (order: RadiologyOrder) => {
    setSelectedOrderId(order.id === selectedOrderId ? null : order.id)
    setFindings('')
    setActionError(null)
  }

  const handleSign = () => {
    if (!selected || !findings.trim()) return
    setActionError(null)
    submitReport
      .mutateAsync({ orderId: selected.id, input: { findings: findings.trim() } })
      .then(() => updateStatus.mutateAsync({ orderId: selected.id, status: 'COMPLETED' }))
      .then(() => setFindings(''))
      .catch((error: unknown) => setActionError(errorMessage(error, 'Could not finalise the report.')))
  }

  const card = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 24 }
  const sT = { fontSize: 15, fontWeight: 700, color: 'var(--foreground)', marginBottom: 14, fontFamily: "'Plus Jakarta Sans', sans-serif" }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--foreground)', marginBottom: 4, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Radiology</h1>
        <p style={{ color: 'var(--muted-foreground)', fontSize: 15 }}>Imaging orders, study tracking and radiologist notes</p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {stats.map(s => {
          const Icon = s.icon
          return (
            <div key={s.label} style={{ ...card, display: 'flex', gap: 14, alignItems: 'center' }}>
              <div style={{ width: 46, height: 46, borderRadius: 14, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={20} color={s.color} />
              </div>
              <div>
                <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--foreground)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{ordersQuery.isLoading ? '—' : s.value}</div>
                <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{s.label}</div>
              </div>
            </div>
          )
        })}
      </div>

      {actionError && (
        <div style={{ fontSize: 13, fontWeight: 600, color: '#dc2626', marginBottom: 16 }}>{actionError}</div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20 }}>
        {/* Order queue */}
        <div style={card}>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 18, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
            {tabs.map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                style={{ padding: '8px 16px', borderRadius: '8px 8px 0 0', border: 'none', background: activeTab === tab ? '#0891b2' : 'transparent', color: activeTab === tab ? 'white' : 'var(--muted-foreground)', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: -1 }}>
                {tab !== 'All' && studyTypeIcons[tab]} {tab}
              </button>
            ))}
          </div>

          {ordersQuery.isLoading ? (
            <QueryLoading text="Loading imaging orders…" />
          ) : ordersQuery.isError ? (
            <QueryError error={ordersQuery.error} onRetry={() => void ordersQuery.refetch()} />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    {['Order ID', 'Patient', 'Doctor', 'Study Type', 'Body Part', 'Priority', 'Time', 'Status', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(o => (
                    <tr key={o.id} style={{ borderBottom: '1px solid var(--border)', background: selectedOrderId === o.id ? '#ecfeff' : 'transparent' }}>
                      <td style={{ padding: '10px', fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#0891b2', fontWeight: 700 }}>{shortId(o.id)}</td>
                      <td style={{ padding: '10px', fontWeight: 600, color: 'var(--foreground)', fontSize: 12 }}>{o.patientName}</td>
                      <td style={{ padding: '10px', fontSize: 12, color: 'var(--muted-foreground)' }}>{o.orderingDoctor ?? '—'}</td>
                      <td style={{ padding: '10px' }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground)' }}>{iconFor(o.studyType)} {o.studyType}</span>
                      </td>
                      <td style={{ padding: '10px', fontSize: 12, color: 'var(--foreground)' }}>{o.bodyPart ?? '—'}</td>
                      <td style={{ padding: '10px' }}><Badge label={o.priority} colors={priorityColors[o.priority] ?? priorityColors.ROUTINE} /></td>
                      <td style={{ padding: '10px', fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--muted-foreground)' }}>
                        {new Date(o.scheduledAt ?? o.orderedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={{ padding: '10px' }}><Badge label={o.status} colors={statusColors[o.status]} /></td>
                      <td style={{ padding: '10px' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--muted)', color: 'var(--foreground)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                            <Image size={11} /> Images
                          </button>
                          <button style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--muted)', color: 'var(--foreground)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                            <Upload size={11} /> Upload
                          </button>
                          <button onClick={() => handleSelect(o)}
                            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 7, border: 'none', background: '#0891b2', color: 'white', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                            <FileText size={11} /> Notes
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && <InlineEmpty text="No imaging orders for this study type." />}
              <ServerPager meta={ordersQuery.data?.meta} onPageChange={setPage} />
            </div>
          )}
        </div>

        {/* Notes panel */}
        <div style={card}>
          <div style={sT as React.CSSProperties}>Radiologist Notes</div>
          {!selected ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, gap: 10 }}>
              <FileText size={36} color="var(--muted-foreground)" />
              <p style={{ color: 'var(--muted-foreground)', fontSize: 14 }}>Select an order to write notes</p>
            </div>
          ) : (
            <div>
              <div style={{ background: 'var(--background)', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#0891b2', fontWeight: 700, marginBottom: 4 }}>{shortId(selected.id)}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--foreground)' }}>{selected.patientName}</div>
                <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{selected.studyType} · {selected.bodyPart ?? '—'}</div>
                <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>Ordered by {selected.orderingDoctor ?? '—'}</div>
                <div style={{ marginTop: 8 }}>
                  <Badge label={selected.status} colors={statusColors[selected.status]} />
                </div>
              </div>

              {/* Image placeholder */}
              <div style={{ background: '#0f172a', borderRadius: 10, height: 160, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 16, border: '1px dashed #334155' }}>
                <Image size={32} color="#475569" />
                <span style={{ fontSize: 12, color: '#475569' }}>Image viewer placeholder</span>
                <button style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 7, border: 'none', background: '#1e40af', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  <Upload size={12} /> Upload Images
                </button>
              </div>

              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--foreground)', marginBottom: 8 }}>
                Radiologist Interpretation
              </label>
              {selected.reportSignedAt ? (
                <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 12 }}>
                  Report signed {new Date(selected.reportSignedAt).toLocaleString()}. A signed report cannot be edited from this screen.
                </div>
              ) : null}
              <textarea
                value={findings}
                onChange={e => setFindings(e.target.value)}
                rows={6}
                disabled={Boolean(selected.reportSignedAt)}
                placeholder="Enter radiologist interpretation and findings..."
                style={{ width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)', fontSize: 13, boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.6 }}
              />
              <button
                onClick={handleSign}
                disabled={Boolean(selected.reportSignedAt) || !findings.trim() || submitReport.isPending || updateStatus.isPending}
                style={{ marginTop: 12, width: '100%', padding: '10px', borderRadius: 9, border: 'none', background: '#16a34a', color: 'white', fontSize: 13, fontWeight: 700, cursor: selected.reportSignedAt || !findings.trim() ? 'not-allowed' : 'pointer', opacity: selected.reportSignedAt || !findings.trim() ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                <CheckCircle size={15} /> {submitReport.isPending ? 'Signing…' : 'Sign & Finalize Report'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
