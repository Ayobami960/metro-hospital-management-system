import { useState } from 'react'
import { AlertTriangle, CheckCircle, Wrench, Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { QueryError, QueryLoading, InlineEmpty } from '@/components/globals/query-state'
import { useEquipment, useLogMaintenance, useMaintenanceLog } from '@/hooks/diagnostics/diagnostics.hooks'
import { errorMessage } from '@/services/api/api-error'
import type { EquipmentStatus } from '@/services/diagnostics/diagnostics.api'

const maintenanceTypes = ['Calibration', 'Preventive Maintenance', 'Repair', 'Inspection']

const statusClass: Record<EquipmentStatus, string> = {
  Operational: 'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400',
  'Maintenance Due': 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400',
  Overdue: 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400',
  'Out of Service': 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400',
}

function StatusBadge({ status }: { status: EquipmentStatus }) {
  const cls = statusClass[status]
  return <span className={cn('text-[11px] font-bold px-2.5 py-[3px] rounded-full', cls)}>{status}</span>
}

const formatDay = (value: string | null) =>
  value ? new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

export default function EquipmentLogPage() {
  const equipmentQuery = useEquipment()
  const [selectedEq, setSelectedEq] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ equipmentId: '', type: 'Calibration', technician: '', notes: '', result: 'Pass' })
  const [actionError, setActionError] = useState<string | null>(null)

  const equipment = equipmentQuery.data ?? []
  const logQuery = useMaintenanceLog(selectedEq ?? undefined)
  const logMaintenance = useLogMaintenance()

  const overdue = equipment.filter(e => e.status !== 'Operational')
  const filteredLog = logQuery.data ?? []

  const handleSubmit = () => {
    if (!form.equipmentId) return
    setActionError(null)
    logMaintenance
      .mutateAsync({
        equipmentId: form.equipmentId,
        input: {
          type: form.type,
          technician: form.technician || undefined,
          notes: form.notes || undefined,
          result: form.result || undefined,
        },
      })
      .then(() => {
        setForm({ equipmentId: '', type: 'Calibration', technician: '', notes: '', result: 'Pass' })
        setShowForm(false)
      })
      .catch((error: unknown) => setActionError(errorMessage(error, 'Could not save the maintenance entry.')))
  }

  const card = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 24 }
  const sT = { fontSize: 15, fontWeight: 700, color: 'var(--foreground)', marginBottom: 14, fontFamily: "'Plus Jakarta Sans', sans-serif" }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--foreground)', marginBottom: 4, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Equipment Log</h1>
        <p style={{ color: 'var(--muted-foreground)', fontSize: 15 }}>Lab equipment maintenance and calibration tracking</p>
      </div>

      {/* Overdue alerts */}
      {overdue.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {overdue.map(e => (
            <div key={e.id} className={cn('flex items-center gap-3 rounded-[10px] py-3 px-4 border-[1.5px]', e.status === 'Out of Service' ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800' : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800')}>
              <AlertTriangle size={16} className={cn(e.status === 'Out of Service' ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400')} />
              <span className={cn('text-[13px] font-bold', e.status === 'Out of Service' ? 'text-red-800 dark:text-red-300' : 'text-amber-800 dark:text-amber-300')}>
                {e.status === 'Out of Service' ? 'OUT OF SERVICE' : 'CALIBRATION OVERDUE'}: {e.name}{e.model ? ` (${e.model})` : ''} — Next due: {formatDay(e.nextDueAt)}
                {e.daysUntilDue !== null ? ` (${Math.abs(e.daysUntilDue)} days ${e.daysUntilDue < 0 ? 'overdue' : 'left'})` : ''} · Location: {e.location ?? '—'}
              </span>
            </div>
          ))}
        </div>
      )}

      {actionError && (
        <div style={{ fontSize: 13, fontWeight: 600, color: '#dc2626', marginBottom: 16 }}>{actionError}</div>
      )}

      {/* Equipment list */}
      <div style={{ ...card, marginBottom: 20 }}>
        <div style={sT as React.CSSProperties}>Equipment Inventory</div>
        {equipmentQuery.isLoading ? (
          <QueryLoading text="Loading equipment…" />
        ) : equipmentQuery.isError ? (
          <QueryError error={equipmentQuery.error} onRetry={() => void equipmentQuery.refetch()} />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  {['Name', 'Model', 'Serial No.', 'Location', 'Last Calibration', 'Next Due', 'Status', ''].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {equipment.map(e => (
                  <tr key={e.id} style={{ borderBottom: '1px solid var(--border)', background: selectedEq === e.id ? '#f0f9ff' : 'transparent' }}>
                    <td style={{ padding: '12px', fontWeight: 600, color: 'var(--foreground)' }}>{e.name}</td>
                    <td style={{ padding: '12px', color: 'var(--muted-foreground)', fontSize: 12 }}>{e.model ?? '—'}</td>
                    <td style={{ padding: '12px', fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--muted-foreground)' }}>{e.serial ?? '—'}</td>
                    <td style={{ padding: '12px', fontSize: 12, color: 'var(--foreground)' }}>{e.location ?? '—'}</td>
                    <td style={{ padding: '12px', fontSize: 12, color: 'var(--muted-foreground)' }}>{formatDay(e.lastCalibrationAt)}</td>
                    <td style={{ padding: '12px', fontSize: 12, fontWeight: e.status !== 'Operational' ? 700 : 400, color: e.status !== 'Operational' ? '#dc2626' : 'var(--foreground)' }}>{formatDay(e.nextDueAt)}</td>
                    <td style={{ padding: '12px' }}><StatusBadge status={e.status} /></td>
                    <td style={{ padding: '12px' }}>
                      <button onClick={() => setSelectedEq(selectedEq === e.id ? null : e.id)}
                        style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--muted)', color: 'var(--foreground)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                        View Log
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {equipment.length === 0 && <InlineEmpty text="No equipment has been registered yet." />}
          </div>
        )}
      </div>

      {/* Maintenance log */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={sT as React.CSSProperties}>Maintenance Log {selectedEq ? `— ${equipment.find(e => e.id === selectedEq)?.name}` : '(All Equipment)'}</div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {selectedEq && (
              <button onClick={() => setSelectedEq(null)}
                style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--muted)', color: 'var(--foreground)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                Show All
              </button>
            )}
            <button onClick={() => setShowForm(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 8, border: 'none', background: '#0891b2', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              <Plus size={14} /> Log Maintenance
            </button>
          </div>
        </div>

        {logQuery.isLoading ? (
          <QueryLoading text="Loading maintenance log…" />
        ) : logQuery.isError ? (
          <QueryError error={logQuery.error} onRetry={() => void logQuery.refetch()} />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  {['Equipment', 'Date', 'Type', 'Technician', 'Notes', 'Result'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredLog.map(entry => (
                  <tr key={entry.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px', fontWeight: 600, color: 'var(--foreground)', fontSize: 12 }}>{entry.equipmentName}</td>
                    <td style={{ padding: '12px', fontSize: 12, color: 'var(--muted-foreground)' }}>{formatDay(entry.performedAt)}</td>
                    <td style={{ padding: '12px' }}>
                      <span className="text-[11px] font-bold px-2.5 py-[3px] rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400">{entry.type}</span>
                    </td>
                    <td style={{ padding: '12px', fontSize: 12, color: 'var(--foreground)' }}>{entry.technician ?? '—'}</td>
                    <td style={{ padding: '12px', fontSize: 12, color: 'var(--muted-foreground)', maxWidth: 280 }}>{entry.notes ?? '—'}</td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        {(entry.result ?? '').startsWith('Pass') ? <CheckCircle size={13} className="text-green-600 dark:text-green-400" /> : <AlertTriangle size={13} className="text-red-600 dark:text-red-400" />}
                        <span className={cn('text-xs font-semibold', (entry.result ?? '').startsWith('Pass') ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>{entry.result ?? '—'}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredLog.length === 0 && <InlineEmpty text="No maintenance entries recorded yet." />}
          </div>
        )}
      </div>

      {/* Log Maintenance Modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--card)', borderRadius: 16, padding: 28, width: 480, border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--foreground)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Log Maintenance Entry</h3>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)' }}><X size={18} /></button>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--foreground)', marginBottom: 5 }}>Equipment</label>
              <select value={form.equipmentId} onChange={e => setForm(p => ({ ...p, equipmentId: e.target.value }))}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)', fontSize: 13 }}>
                <option value="">Select equipment...</option>
                {equipment.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--foreground)', marginBottom: 5 }}>Maintenance Type</label>
              <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)', fontSize: 13 }}>
                {maintenanceTypes.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--foreground)', marginBottom: 5 }}>Technician</label>
              <input value={form.technician} onChange={e => setForm(p => ({ ...p, technician: e.target.value }))}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)', fontSize: 13, boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--foreground)', marginBottom: 5 }}>Result</label>
              <select value={form.result} onChange={e => setForm(p => ({ ...p, result: e.target.value }))}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)', fontSize: 13 }}>
                <option value="Pass">Pass</option>
                <option value="Fail">Fail</option>
              </select>
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--foreground)', marginBottom: 5 }}>Notes</label>
              <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={3}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)', fontSize: 13, boxSizing: 'border-box', resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowForm(false)}
                style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--muted)', color: 'var(--foreground)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleSubmit} disabled={!form.equipmentId || logMaintenance.isPending}
                style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: '#0891b2', color: 'white', fontSize: 13, fontWeight: 700, cursor: !form.equipmentId || logMaintenance.isPending ? 'not-allowed' : 'pointer', opacity: !form.equipmentId || logMaintenance.isPending ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Wrench size={14} /> {logMaintenance.isPending ? 'Saving…' : 'Save Entry'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
