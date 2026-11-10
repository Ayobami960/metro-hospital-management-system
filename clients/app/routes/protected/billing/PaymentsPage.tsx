import { useMemo, useState } from 'react'
import { Plus, X, CreditCard, Banknote, Building2, FileCheck } from 'lucide-react'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { QueryError, QueryLoading, InlineEmpty } from '@/components/globals/query-state'
import { ServerPager } from '@/components/globals/server-pager'
import { useBillingReports, useInvoices, usePayments, useRecordPayment } from '@/hooks/billing/billing.hooks'
import { usePatients } from '@/hooks/patients/patients.hooks'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { errorMessage } from '@/services/api/api-error'
import { formatDate, label, money } from '@/lib/format'
import type { PaymentMethod } from '@/services/billing/billing.api'

const methodIcons: Record<string, typeof CreditCard> = {
  CARD: CreditCard,
  CASH: Banknote,
  INSURANCE: Building2,
  CHECK: FileCheck,
  TRANSFER: Building2,
}

const methodColors: Record<string, string> = {
  CARD: '#16a34a',
  CASH: '#d97706',
  INSURANCE: '#2563eb',
  CHECK: '#7c3aed',
  TRANSFER: '#0891b2',
}

const statusColors: Record<string, { bg: string; color: string }> = {
  CLEARED: { bg: '#dcfce7', color: '#16a34a' },
  COMPLETED: { bg: '#dcfce7', color: '#16a34a' },
  PENDING: { bg: '#fef9c3', color: '#ca8a04' },
  FAILED: { bg: '#fee2e2', color: '#dc2626' },
  REFUNDED: { bg: '#f1f5f9', color: '#64748b' },
}

const methods: PaymentMethod[] = ['CARD', 'CASH', 'INSURANCE', 'CHECK', 'TRANSFER']

export default function PaymentsPage() {
  const [showRecord, setShowRecord] = useState(false)
  const [page, setPage] = useState(1)
  const [patientSearch, setPatientSearch] = useState('')
  const [recPatientId, setRecPatientId] = useState('')
  const [recAmount, setRecAmount] = useState('')
  const [recMethod, setRecMethod] = useState<PaymentMethod>('CARD')
  const [recRef, setRecRef] = useState('')
  const [recInvoiceId, setRecInvoiceId] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)

  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const weekAgo = useMemo(() => {
    const date = new Date()
    date.setDate(date.getDate() - 6)
    return date.toISOString().slice(0, 10)
  }, [])

  const payments = usePayments({ page, pageSize: 10 })
  const reports = useBillingReports(weekAgo, today)
  const patients = usePatients({ pageSize: 20, search: useDebouncedValue(patientSearch) || undefined })
  const patientInvoices = useInvoices({ pageSize: 20, patientId: recPatientId || undefined, status: 'ISSUED' })
  const recordPayment = useRecordPayment()

  const methodData = (reports.data?.revenueByMethod ?? []).map(row => ({
    name: label(row.method),
    value: Math.round(row.amountMinor / 100),
    color: methodColors[row.method] ?? '#64748b',
  }))

  const dailyData = (reports.data?.revenueByDay ?? []).map(row => ({
    day: new Date(row.day).toLocaleDateString('en-US', { weekday: 'short' }),
    amount: Math.round(row.amountMinor / 100),
  }))

  const handleRecord = () => {
    const amount = Math.round(parseFloat(recAmount) * 100)
    if (!Number.isFinite(amount) || amount <= 0) {
      setActionError('Enter a valid payment amount.')
      return
    }
    setActionError(null)
    recordPayment
      .mutateAsync({
        patientId: recPatientId || undefined,
        amountMinor: amount,
        method: recMethod,
        reference: recRef || undefined,
        allocations: recInvoiceId ? [{ invoiceId: recInvoiceId, amountMinor: amount }] : undefined,
      })
      .then(() => {
        setShowRecord(false)
        setRecPatientId('')
        setRecAmount('')
        setRecRef('')
        setRecInvoiceId('')
        setPatientSearch('')
      })
      .catch((error: unknown) => setActionError(errorMessage(error, 'Could not record the payment.')))
  }

  const card = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 24 }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--foreground)', marginBottom: 4, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Payments</h1>
        <p style={{ color: 'var(--muted-foreground)', fontSize: 15 }}>Track all incoming payments and collections</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        {/* Pie Chart */}
        <div style={card}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--foreground)', marginBottom: 16, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Payment Method Breakdown</h3>
          {reports.isLoading ? (
            <QueryLoading text="Loading payment mix…" />
          ) : reports.isError ? (
            <QueryError error={reports.error} onRetry={() => void reports.refetch()} />
          ) : methodData.length === 0 ? (
            <InlineEmpty text="No payments recorded in the last 7 days." />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie data={methodData} cx="50%" cy="50%" innerRadius={45} outerRadius={72} paddingAngle={3} dataKey="value">
                    {methodData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: unknown) => [`$${Number(v).toLocaleString()}`, '']} contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ flex: 1 }}>
                {methodData.map(m => (
                  <div key={m.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: m.color, display: 'inline-block' }} />
                      <span style={{ fontSize: 13, color: 'var(--foreground)' }}>{m.name}</span>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: m.color }}>${m.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Bar Chart */}
        <div style={card}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--foreground)', marginBottom: 16, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Daily Collections (Last 7 Days)</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
              <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} formatter={(v: unknown) => [`$${Number(v).toLocaleString()}`, 'Collected']} />
              <Bar dataKey="amount" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Table */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--foreground)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Payment Ledger</h3>
            <p style={{ fontSize: 13, color: 'var(--muted-foreground)', marginTop: 2 }}>
              Collected in the last 7 days:{' '}
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: '#16a34a' }}>
                {money(reports.data?.collectedMinor)}
              </span>
            </p>
          </div>
          <button onClick={() => setShowRecord(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', background: '#2563eb', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            <Plus size={15} /> Record Payment
          </button>
        </div>

        {payments.isLoading ? (
          <QueryLoading text="Loading payments…" />
        ) : payments.isError ? (
          <QueryError error={payments.error} onRetry={() => void payments.refetch()} />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  {['Payment ID', 'Patient', 'Date', 'Method', 'Amount', 'Reference', 'Status'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: 'var(--muted-foreground)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(payments.data?.rows ?? []).map(p => {
                  const Icon = methodIcons[p.method] ?? CreditCard
                  const sc = statusColors[p.status] ?? statusColors.CLEARED
                  return (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px', fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: '#2563eb', fontWeight: 700 }}>{p.paymentNumber}</td>
                      <td style={{ padding: '12px', fontWeight: 600, color: 'var(--foreground)' }}>
                        {p.patientName}
                        <div style={{ fontSize: 11, color: 'var(--muted-foreground)', fontWeight: 400 }}>MRN {p.mrn}</div>
                      </td>
                      <td style={{ padding: '12px', color: 'var(--muted-foreground)', fontSize: 12 }}>{formatDate(p.receivedAt)}</td>
                      <td style={{ padding: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Icon size={14} color={methodColors[p.method]} />
                          <span style={{ fontSize: 13, color: methodColors[p.method], fontWeight: 600 }}>{label(p.method)}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: '#16a34a' }}>{money(p.amountMinor)}</td>
                      <td style={{ padding: '12px', fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--muted-foreground)' }}>{p.reference ?? '—'}</td>
                      <td style={{ padding: '12px' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 100, background: sc.bg, color: sc.color }}>{p.reversesPaymentId ? 'Refund' : label(p.kind)}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {(payments.data?.rows ?? []).length === 0 && <InlineEmpty text="No payments recorded yet." />}
            <ServerPager meta={payments.data?.meta} onPageChange={setPage} />
          </div>
        )}
      </div>

      {/* Record Payment Modal */}
      {showRecord && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, padding: 32, width: 480 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--foreground)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Record Payment</h2>
              <button onClick={() => setShowRecord(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)' }}><X size={20} /></button>
            </div>
            {actionError && (
              <div style={{ fontSize: 13, fontWeight: 600, color: '#dc2626', marginBottom: 14 }}>{actionError}</div>
            )}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', display: 'block', marginBottom: 6 }}>Patient</label>
              <input value={patientSearch} onChange={e => setPatientSearch(e.target.value)} placeholder="Search patients..."
                style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 10, fontSize: 14, background: 'var(--muted)', color: 'var(--foreground)', outline: 'none', boxSizing: 'border-box', marginBottom: 8 }} />
              <select value={recPatientId} onChange={e => { setRecPatientId(e.target.value); setRecInvoiceId('') }}
                style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 10, fontSize: 14, background: 'var(--muted)', color: 'var(--foreground)', outline: 'none' }}>
                <option value="">{patients.isLoading ? 'Loading patients…' : 'Optional — select patient...'}</option>
                {(patients.data?.rows ?? []).map(patient => (
                  <option key={patient.id} value={patient.id}>{patient.name} · MRN {patient.mrn}</option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', display: 'block', marginBottom: 6 }}>Amount ($)</label>
              <input type="number" value={recAmount} onChange={e => setRecAmount(e.target.value)} placeholder="0.00"
                style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 10, fontSize: 14, background: 'var(--muted)', color: 'var(--foreground)', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', display: 'block', marginBottom: 6 }}>Reference</label>
              <input value={recRef} onChange={e => setRecRef(e.target.value)} placeholder="Receipt or transfer reference"
                style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 10, fontSize: 14, background: 'var(--muted)', color: 'var(--foreground)', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            {recPatientId && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', display: 'block', marginBottom: 6 }}>Allocate to Invoice</label>
                <select value={recInvoiceId} onChange={e => setRecInvoiceId(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 10, fontSize: 14, background: 'var(--muted)', color: 'var(--foreground)', outline: 'none' }}>
                  <option value="">Do not allocate</option>
                  {(patientInvoices.data?.rows ?? []).map(invoice => (
                    <option key={invoice.id} value={invoice.id}>{invoice.invoiceNumber} · balance {money(invoice.balanceMinor, true)}</option>
                  ))}
                </select>
              </div>
            )}
            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', display: 'block', marginBottom: 6 }}>Payment Method</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {methods.slice(0, 4).map(m => (
                  <button key={m} onClick={() => setRecMethod(m)}
                    style={{ padding: '10px 0', border: `2px solid ${recMethod === m ? methodColors[m] : 'var(--border)'}`, borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: recMethod === m ? `${methodColors[m]}15` : 'var(--muted)', color: recMethod === m ? methodColors[m] : 'var(--muted-foreground)' }}>
                    {label(m)}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowRecord(false)}
                style={{ padding: '10px 20px', background: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleRecord} disabled={recordPayment.isPending}
                style={{ padding: '10px 24px', background: '#16a34a', color: 'white', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: recordPayment.isPending ? 'not-allowed' : 'pointer', opacity: recordPayment.isPending ? 0.6 : 1 }}>
                {recordPayment.isPending ? 'Recording…' : 'Record Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
