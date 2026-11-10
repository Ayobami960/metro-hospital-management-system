import { useMemo, useState } from 'react'
import { Bell, X, CalendarDays, Smartphone } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { QueryError, QueryLoading, InlineEmpty } from '@/components/globals/query-state'
import { useOutstanding } from '@/hooks/billing/billing.hooks'
import { formatDate, money } from '@/lib/format'
import { errorMessage } from '@/services/api/api-error'
import {
  useMessagingDirectory,
  useSendMessage,
  useStartConversation,
} from '@/hooks/messaging/messaging.hooks'

const riskColors: Record<string, { bg: string; color: string }> = {
  Low: { bg: '#dcfce7', color: '#16a34a' },
  Medium: { bg: '#fef9c3', color: '#ca8a04' },
  High: { bg: '#fee2e2', color: '#dc2626' },
}

const riskFor = (daysOverdue: number): 'Low' | 'Medium' | 'High' =>
  daysOverdue > 60 ? 'High' : daysOverdue > 30 ? 'Medium' : 'Low'

const bucketColors = ['#16a34a', '#d97706', '#ea580c', '#dc2626', '#991b1b']

export default function OutstandingPage() {
  const outstanding = useOutstanding({ pageSize: 50 })
  const [reminderPatient, setReminderPatient] = useState<{ name: string; patientId: string } | null>(null)
  const [planPatient, setPlanPatient] = useState<string | null>(null)
  const [reminderMethod, setReminderMethod] = useState<'email' | 'sms'>('email')
  const [planMonths, setPlanMonths] = useState('3')
  const [actionError, setActionError] = useState<string | null>(null)

  const startConversation = useStartConversation()
  const sendMessage = useSendMessage()
  const directory = useMessagingDirectory()

  const rows = outstanding.data?.rows ?? []
  const buckets = outstanding.data?.buckets

  const agingData = useMemo(
    () =>
      [
        { bucket: 'Current', amount: Math.round((buckets?.current ?? 0) / 100) },
        { bucket: '1-30d', amount: Math.round((buckets?.d1to30 ?? 0) / 100) },
        { bucket: '31-60d', amount: Math.round((buckets?.d31to60 ?? 0) / 100) },
        { bucket: '61-90d', amount: Math.round((buckets?.d61to90 ?? 0) / 100) },
        { bucket: '90d+', amount: Math.round((buckets?.over90 ?? 0) / 100) },
      ].map((entry, index) => ({ ...entry, color: bucketColors[index] })),
    [buckets],
  )

  const totalOutstanding = (buckets?.total ?? 0) / 100
  const highRisk = rows.filter(row => row.daysOverdue > 60).length
  const avgDays = rows.length > 0
    ? Math.round(rows.reduce((total, row) => total + row.daysOverdue, 0) / rows.length)
    : 0

  const planRow = rows.find(row => row.patientId === planPatient)
  const monthlyPlan = planRow ? Math.ceil(planRow.balanceMinor / 100 / parseInt(planMonths)) : 0

  const handleSendReminder = () => {
    if (!reminderPatient) return
    const participantUserId = (directory.data?.patients ?? []).find(
      patient => patient.id === reminderPatient.patientId,
    )?.userId
    if (!participantUserId) {
      setActionError(`${reminderPatient.name} has no portal account, so an in-app reminder cannot be delivered.`)
      setReminderPatient(null)
      return
    }
    setActionError(null)
    const body =
      reminderMethod === 'email'
        ? `Dear ${reminderPatient.name}, our records show an outstanding balance on your account. Please contact the billing office to arrange payment.`
        : `Reminder: an outstanding balance is due on your account. Reply to this message or call the billing office.`
    startConversation
      .mutateAsync({
        participantIds: [participantUserId],
        subject: 'Outstanding balance reminder',
        patientId: reminderPatient.patientId,
        type: 'DIRECT',
      })
      .then(conversation => sendMessage.mutateAsync({ conversationId: conversation.id, body }))
      .catch((error: unknown) => setActionError(errorMessage(error, 'Could not send the reminder.')))
      .finally(() => setReminderPatient(null))
  }

  const card = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 24 }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--foreground)', marginBottom: 4, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Outstanding Balances</h1>
        <p style={{ color: 'var(--muted-foreground)', fontSize: 15 }}>Patient accounts with unpaid balances</p>
      </div>

      {actionError && (
        <div style={{ fontSize: 13, fontWeight: 600, color: '#dc2626', marginBottom: 16 }}>{actionError}</div>
      )}

      {/* Summary Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total Outstanding', value: outstanding.isLoading ? '—' : money(buckets?.total ?? 0), color: '#dc2626' },
          { label: 'Invoices with Balance', value: outstanding.isLoading ? '—' : String(rows.length), color: '#2563eb' },
          { label: 'High Risk Accounts', value: outstanding.isLoading ? '—' : String(highRisk), color: '#dc2626' },
          { label: 'Avg Days Outstanding', value: outstanding.isLoading ? '—' : `${avgDays}d`, color: '#d97706' },
        ].map(s => (
          <div key={s.label} style={{ ...card, textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: s.color, fontFamily: "'JetBrains Mono', monospace" }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        {/* Aging Buckets */}
        <div style={card}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--foreground)', marginBottom: 16, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Aging Report</h3>
          {outstanding.isError ? (
            <QueryError error={outstanding.error} onRetry={() => void outstanding.refetch()} />
          ) : (
            <>
              {agingData.map(a => (
                <div key={a.bucket} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 12, height: 12, borderRadius: '50%', background: a.color, display: 'inline-block' }} />
                    <span style={{ fontSize: 14, color: 'var(--foreground)', fontWeight: 600 }}>{a.bucket}</span>
                  </div>
                  <span style={{ fontSize: 16, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: a.color }}>${a.amount.toLocaleString()}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, marginTop: 4 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--foreground)' }}>Total</span>
                <span style={{ fontSize: 18, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: '#dc2626' }}>${totalOutstanding.toLocaleString()}</span>
              </div>
            </>
          )}
        </div>

        {/* Bar Chart */}
        <div style={card}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--foreground)', marginBottom: 16, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Aging Distribution</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={agingData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="bucket" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(1)}K`} />
              <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} formatter={(v: unknown) => [`$${Number(v).toLocaleString()}`, 'Outstanding']} />
              <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                {agingData.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Invoice Table */}
      <div style={card}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--foreground)', marginBottom: 20, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Patient Outstanding Balances</h3>
        {outstanding.isLoading ? (
          <QueryLoading text="Loading outstanding balances…" />
        ) : outstanding.isError ? (
          <QueryError error={outstanding.error} onRetry={() => void outstanding.refetch()} />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  {['Patient', 'MRN', 'Invoice', 'Balance', 'Due Date', 'Days Outstanding', 'Risk Level', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: 'var(--muted-foreground)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(row => {
                  const risk = riskFor(row.daysOverdue)
                  const rc = riskColors[risk]
                  return (
                    <tr key={row.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px', fontWeight: 600, color: 'var(--foreground)' }}>{row.patientName}</td>
                      <td style={{ padding: '12px', fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--muted-foreground)' }}>{row.mrn}</td>
                      <td style={{ padding: '12px', fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: '#2563eb' }}>{row.invoiceNumber}</td>
                      <td style={{ padding: '12px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, color: '#dc2626', fontSize: 14 }}>{money(row.balanceMinor)}</td>
                      <td style={{ padding: '12px', fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--muted-foreground)' }}>{formatDate(row.dueAt)}</td>
                      <td style={{ padding: '12px', fontFamily: "'JetBrains Mono', monospace", color: row.daysOverdue > 60 ? '#dc2626' : row.daysOverdue > 30 ? '#d97706' : 'var(--muted-foreground)' }}>
                        {row.daysOverdue}d
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 100, background: rc.bg, color: rc.color }}>{risk}</span>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => setReminderPatient({ name: row.patientName, patientId: row.patientId })}
                            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', background: '#dbeafe', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                            <Bell size={12} /> Remind
                          </button>
                          <button onClick={() => setPlanPatient(row.patientId)}
                            style={{ padding: '5px 10px', background: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                            Payment Plan
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {rows.length === 0 && <InlineEmpty text="No outstanding balances." />}
          </div>
        )}
      </div>

      {/* Send Reminder Modal */}
      {reminderPatient && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, padding: 32, width: 420 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--foreground)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Send Reminder</h2>
              <button onClick={() => setReminderPatient(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)' }}><X size={20} /></button>
            </div>
            <p style={{ fontSize: 14, color: 'var(--muted-foreground)', marginBottom: 20 }}>Send a payment reminder to <strong style={{ color: 'var(--foreground)' }}>{reminderPatient.name}</strong></p>
            <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
              {[{ method: 'email' as const, text: 'Email', icon: CalendarDays }, { method: 'sms' as const, text: 'SMS', icon: Smartphone }].map(m => {
                const Icon = m.icon
                return (
                  <button key={m.method} onClick={() => setReminderMethod(m.method)}
                    style={{ flex: 1, padding: '14px', border: `2px solid ${reminderMethod === m.method ? '#2563eb' : 'var(--border)'}`, borderRadius: 12, cursor: 'pointer', background: reminderMethod === m.method ? '#dbeafe' : 'var(--muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <Icon size={20} color={reminderMethod === m.method ? '#2563eb' : 'var(--muted-foreground)'} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: reminderMethod === m.method ? '#2563eb' : 'var(--muted-foreground)' }}>{m.text}</span>
                  </button>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setReminderPatient(null)}
                style={{ padding: '10px 20px', background: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleSendReminder} disabled={startConversation.isPending || sendMessage.isPending}
                style={{ padding: '10px 24px', background: '#2563eb', color: 'white', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: startConversation.isPending ? 0.6 : 1 }}>
                {startConversation.isPending ? 'Sending…' : `Send ${reminderMethod === 'email' ? 'Email' : 'SMS'}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Plan Modal */}
      {planRow && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, padding: 32, width: 460 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--foreground)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Payment Plan Estimate</h2>
              <button onClick={() => setPlanPatient(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)' }}><X size={20} /></button>
            </div>
            <p style={{ fontSize: 14, color: 'var(--muted-foreground)', marginBottom: 16 }}>
              Estimate for <strong style={{ color: 'var(--foreground)' }}>{planRow.patientName}</strong>. Payment plans are arranged with the patient and recorded outside this screen.
            </p>
            <div style={{ background: 'var(--muted)', borderRadius: 12, padding: 16, marginBottom: 20, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>Total Balance</span>
              <span style={{ fontSize: 18, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: '#dc2626' }}>{money(planRow.balanceMinor)}</span>
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', display: 'block', marginBottom: 10 }}>Number of Installments</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {['3', '6', '12', '24'].map(m => (
                  <button key={m} onClick={() => setPlanMonths(m)}
                    style={{ flex: 1, padding: '10px 0', border: `2px solid ${planMonths === m ? '#2563eb' : 'var(--border)'}`, borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', background: planMonths === m ? '#2563eb' : 'var(--muted)', color: planMonths === m ? 'white' : 'var(--muted-foreground)' }}>
                    {m}mo
                  </button>
                ))}
              </div>
            </div>
            <div style={{ background: '#dbeafe', borderRadius: 12, padding: 16, marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 14, color: '#1d4ed8', fontWeight: 600 }}>Monthly Payment</span>
              <span style={{ fontSize: 24, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: '#2563eb' }}>${monthlyPlan.toLocaleString()}/mo</span>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setPlanPatient(null)}
                style={{ padding: '10px 20px', background: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
