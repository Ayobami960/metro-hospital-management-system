import { useState } from 'react'
import { Clock, Activity, AlertTriangle, CheckCircle, Filter, UserCheck } from 'lucide-react'
import { QueryError, QueryLoading, InlineEmpty } from '@/components/globals/query-state'
import { ServerPager } from '@/components/globals/server-pager'
import { useAssignLabOrder, useLabOrders } from '@/hooks/laboratory/laboratory.hooks'
import { useMessagingDirectory } from '@/hooks/messaging/messaging.hooks'
import { errorMessage } from '@/services/api/api-error'

const statusColors: Record<string, { bg: string; color: string }> = {
  PENDING: { bg: '#f1f5f9', color: '#64748b' },
  COLLECTED: { bg: '#dbeafe', color: '#2563eb' },
  IN_PROGRESS: { bg: '#fef9c3', color: '#ca8a04' },
  RESULTED: { bg: '#ede9fe', color: '#7c3aed' },
  RELEASED: { bg: '#dcfce7', color: '#16a34a' },
  CANCELLED: { bg: '#f1f5f9', color: '#64748b' },
  STAT: { bg: '#fee2e2', color: '#dc2626' },
  URGENT: { bg: '#fef9c3', color: '#ca8a04' },
  ROUTINE: { bg: '#ede9fe', color: '#7c3aed' },
}

function Badge({ label }: { label: string }) {
  const s = statusColors[label] ?? { bg: '#f1f5f9', color: '#64748b' }
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 100, background: s.bg, color: s.color }}>
      {label.replaceAll('_', ' ')}
    </span>
  )
}

const shortId = (id: string) => id.slice(0, 8).toUpperCase()

export default function TestRequestsPage() {
  const [filterPriority, setFilterPriority] = useState('All')
  const [filterStatus, setFilterStatus] = useState('All')
  const [page, setPage] = useState(1)
  const [assignModal, setAssignModal] = useState<string | null>(null)
  const [selectedTech, setSelectedTech] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)

  const requests = useLabOrders({
    page,
    pageSize: 10,
    status: filterStatus === 'All' ? undefined : filterStatus,
    priority: filterPriority === 'All' ? undefined : filterPriority,
  })

  const pending = useLabOrders({ pageSize: 1, status: 'PENDING' })
  const inProgress = useLabOrders({ pageSize: 1, status: 'IN_PROGRESS' })
  const stat = useLabOrders({ pageSize: 1, priority: 'STAT' })
  const released = useLabOrders({ pageSize: 1, status: 'RELEASED' })

  const directory = useMessagingDirectory()
  const assign = useAssignLabOrder()

  const technicians = (directory.data?.staff ?? []).filter((member) => member.role === 'LABORATORY')

  const handleAssign = (orderId: string) => {
    if (!selectedTech) return
    setActionError(null)
    assign
      .mutateAsync({ orderId, technicianId: selectedTech })
      .then(() => {
        setAssignModal(null)
        setSelectedTech('')
      })
      .catch((error: unknown) => setActionError(errorMessage(error, 'Could not assign the request.')))
  }

  const card = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 24 }
  const sT = { fontSize: 16, fontWeight: 700, color: 'var(--foreground)', marginBottom: 16, fontFamily: "'Plus Jakarta Sans', sans-serif" }

  const stats = [
    { label: 'Pending', value: pending.data?.meta.total, icon: Clock, color: '#d97706', bg: '#fef9c3' },
    { label: 'In Progress', value: inProgress.data?.meta.total, icon: Activity, color: '#2563eb', bg: '#dbeafe' },
    { label: 'STAT Orders', value: stat.data?.meta.total, icon: AlertTriangle, color: '#dc2626', bg: '#fee2e2' },
    { label: 'Released', value: released.data?.meta.total, icon: CheckCircle, color: '#16a34a', bg: '#dcfce7' },
  ]

  return (
    <div style={{ padding: 24, position: 'relative' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--foreground)', marginBottom: 4, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Test Requests</h1>
        <p style={{ color: 'var(--muted-foreground)', fontSize: 15 }}>Incoming lab test request queue</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {stats.map(s => {
          const Icon = s.icon
          return (
            <div key={s.label} style={{ ...card, display: 'flex', gap: 14, alignItems: 'center' }}>
              <div style={{ width: 46, height: 46, borderRadius: 14, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={20} color={s.color} />
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--foreground)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{s.value ?? '—'}</div>
                <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{s.label}</div>
              </div>
            </div>
          )
        })}
      </div>

      {actionError && (
        <div style={{ fontSize: 13, fontWeight: 600, color: '#dc2626', marginBottom: 16 }}>{actionError}</div>
      )}

      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={sT as React.CSSProperties}>Request Queue</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Filter size={15} color="var(--muted-foreground)" />
            <select value={filterPriority} onChange={e => { setFilterPriority(e.target.value); setPage(1) }}
              style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--foreground)', fontSize: 13, cursor: 'pointer' }}>
              <option value="All">All</option>
              <option value="STAT">STAT</option>
              <option value="URGENT">Urgent</option>
              <option value="ROUTINE">Routine</option>
            </select>
            <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1) }}
              style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--foreground)', fontSize: 13, cursor: 'pointer' }}>
              <option value="All">All</option>
              <option value="PENDING">Pending</option>
              <option value="COLLECTED">Collected</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="RESULTED">Resulted</option>
              <option value="RELEASED">Released</option>
            </select>
          </div>
        </div>

        {requests.isLoading ? (
          <QueryLoading text="Loading test requests…" />
        ) : requests.isError ? (
          <QueryError error={requests.error} onRetry={() => void requests.refetch()} />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  {['Request ID', 'Patient', 'Specimens', 'Tests Ordered', 'Priority', 'Received', 'Status', 'Action'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: 'var(--muted-foreground)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(requests.data?.rows ?? []).map(req => (
                  <tr key={req.id} style={{ borderBottom: '1px solid var(--border)', background: req.priority === 'STAT' && req.status !== 'RELEASED' ? '#fff9f9' : 'transparent' }}>
                    <td style={{ padding: '12px', fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: '#2563eb', fontWeight: 700 }}>{shortId(req.id)}</td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--foreground)' }}>{req.patientName}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>MRN {req.mrn}</div>
                    </td>
                    <td style={{ padding: '12px', fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--muted-foreground)' }}>
                      {req.specimens.length > 0 ? req.specimens.join(', ') : '—'}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: '#dbeafe', color: '#1d4ed8', fontWeight: 600 }}>
                        {req.itemCount} {req.itemCount === 1 ? 'test' : 'tests'}
                      </span>
                    </td>
                    <td style={{ padding: '12px' }}><Badge label={req.priority} /></td>
                    <td style={{ padding: '12px', fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--muted-foreground)' }}>
                      {new Date(req.orderedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={{ padding: '12px' }}><Badge label={req.status} /></td>
                    <td style={{ padding: '12px' }}>
                      {req.status !== 'RELEASED' && req.status !== 'CANCELLED' && (
                        <button onClick={() => setAssignModal(req.id)}
                          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: '#0891b2', color: 'white', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          <UserCheck size={13} /> Assign
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(requests.data?.rows ?? []).length === 0 && (
              <InlineEmpty text="No test requests match these filters." />
            )}
            <ServerPager meta={requests.data?.meta} onPageChange={setPage} />
          </div>
        )}
      </div>

      {/* Assign Modal */}
      {assignModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--card)', borderRadius: 16, padding: 28, width: 340, border: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--foreground)', marginBottom: 6, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Assign Technician</h3>
            <p style={{ fontSize: 13, color: 'var(--muted-foreground)', marginBottom: 18 }}>Request {shortId(assignModal)}</p>
            <select value={selectedTech} onChange={e => setSelectedTech(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)', fontSize: 13, marginBottom: 16 }}>
              <option value="">Select technician...</option>
              {technicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setAssignModal(null); setSelectedTech('') }}
                style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--muted)', color: 'var(--foreground)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={() => handleAssign(assignModal)} disabled={!selectedTech || assign.isPending}
                style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: '#0891b2', color: 'white', fontSize: 13, fontWeight: 700, cursor: !selectedTech || assign.isPending ? 'not-allowed' : 'pointer', opacity: !selectedTech || assign.isPending ? 0.6 : 1 }}>
                {assign.isPending ? 'Assigning…' : 'Assign'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
