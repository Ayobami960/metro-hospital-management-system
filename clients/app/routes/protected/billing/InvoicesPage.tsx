import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Search, Plus, Eye, Edit2, Mail, Download, X, FileText } from 'lucide-react'
import { QueryError, QueryLoading, InlineEmpty } from '@/components/globals/query-state'
import { ServerPager } from '@/components/globals/server-pager'
import {
  useBillingDashboard,
  useCreateInvoice,
  useInvoice,
  useInvoices,
} from '@/hooks/billing/billing.hooks'
import { usePatients } from '@/hooks/patients/patients.hooks'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { errorMessage } from '@/services/api/api-error'
import { formatDate, label, money } from '@/lib/format'

const statusColors: Record<string, { bg: string; color: string }> = {
  PAID: { bg: '#dcfce7', color: '#16a34a' },
  PARTIALLY_PAID: { bg: '#dbeafe', color: '#2563eb' },
  ISSUED: { bg: '#fef9c3', color: '#ca8a04' },
  OVERDUE: { bg: '#fee2e2', color: '#dc2626' },
  DRAFT: { bg: '#f1f5f9', color: '#64748b' },
  VOID: { bg: '#f1f5f9', color: '#64748b' },
}

function Badge({ status }: { status: string }) {
  const s = statusColors[status] ?? statusColors.ISSUED
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 100, background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>
      {label(status)}
    </span>
  )
}

interface ServiceLine {
  description: string
  quantity: number
  unitPrice: number
}

const emptyLine: ServiceLine = { description: '', quantity: 1, unitPrice: 0 }

export default function InvoicesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const dateFrom = searchParams.get('from') ?? ''
  const dateTo = searchParams.get('to') ?? ''
  const openInvoiceId = searchParams.get('invoice')

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [page, setPage] = useState(1)
  const [showCreate, setShowCreate] = useState(false)
  const [patientSearch, setPatientSearch] = useState('')
  const [patientId, setPatientId] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [notes, setNotes] = useState('')
  const [services, setServices] = useState<ServiceLine[]>([{ ...emptyLine }])
  const [actionError, setActionError] = useState<string | null>(null)

  const debouncedSearch = useDebouncedValue(search)
  const invoices = useInvoices({
    page,
    pageSize: 10,
    search: debouncedSearch || undefined,
    status: statusFilter === 'All' ? undefined : statusFilter,
    from: dateFrom || undefined,
    to: dateTo || undefined,
  })
  const dashboard = useBillingDashboard()
  const detail = useInvoice(openInvoiceId)
  const patients = usePatients({ pageSize: 20, search: patientSearch || undefined })
  const createInvoice = useCreateInvoice()

  const setDateRange = (from: string, to: string) => {
    const next = new URLSearchParams(searchParams)
    if (from) next.set('from', from)
    else next.delete('from')
    if (to) next.set('to', to)
    else next.delete('to')
    setSearchParams(next)
    setPage(1)
  }

  const closeDetail = () => {
    const next = new URLSearchParams(searchParams)
    next.delete('invoice')
    setSearchParams(next)
  }

  const invoiceTotal = useMemo(
    () => services.reduce((total, line) => total + line.quantity * line.unitPrice, 0),
    [services],
  )

  const addService = () => setServices([...services, { ...emptyLine }])
  const removeService = (index: number) => setServices(services.filter((_, i) => i !== index))
  const updateService = (index: number, field: keyof ServiceLine, value: string | number) => {
    setServices(services.map((line, i) => (i === index ? { ...line, [field]: value } : line)))
  }

  const handleCreate = () => {
    if (!patientId) return
    const items = services.filter(line => line.description.trim() && line.unitPrice > 0)
    if (items.length === 0) {
      setActionError('Add at least one service line with a description and a price.')
      return
    }
    setActionError(null)
    createInvoice
      .mutateAsync({
        patientId,
        dueAt: dueAt || undefined,
        notes: notes || undefined,
        items: items.map(line => ({
          description: line.description.trim(),
          quantity: line.quantity || 1,
          unitPriceMinor: Math.round(line.unitPrice * 100),
        })),
      })
      .then(() => {
        setShowCreate(false)
        setPatientId('')
        setPatientSearch('')
        setDueAt('')
        setNotes('')
        setServices([{ ...emptyLine }])
      })
      .catch((error: unknown) => setActionError(errorMessage(error, 'Could not create the invoice.')))
  }

  const card = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 24 }
  const statCards = dashboard.data
    ? [
        { label: 'Invoiced (This Month)', value: money(dashboard.data.stats.invoicedThisMonthMinor), color: '#2563eb' },
        { label: 'Collected (This Month)', value: money(dashboard.data.stats.collectedThisMonthMinor), color: '#16a34a' },
        { label: 'Outstanding', value: money(dashboard.data.stats.outstandingMinor), color: '#dc2626' },
      ]
    : []

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--foreground)', marginBottom: 4, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Invoices</h1>
        <p style={{ color: 'var(--muted-foreground)', fontSize: 15 }}>Manage and track all patient invoices</p>
      </div>

      {/* Stats */}
      {statCards.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
          {statCards.map(s => (
            <div key={s.label} style={{ ...card, textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: s.color, fontFamily: "'JetBrains Mono', monospace" }}>{s.value}</div>
              <div style={{ fontSize: 13, color: 'var(--muted-foreground)', marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div style={{ ...card, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)' }} />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Search patient or invoice number..."
              style={{ width: '100%', padding: '9px 10px 9px 32px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, background: 'var(--muted)', color: 'var(--foreground)', outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
            style={{ padding: '9px 14px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, background: 'var(--muted)', color: 'var(--foreground)', outline: 'none', cursor: 'pointer' }}>
            {['All', 'DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'VOID'].map(s => (
              <option key={s} value={s}>{s === 'All' ? 'All' : label(s)}</option>
            ))}
          </select>
          <input type="date" value={dateFrom} onChange={e => setDateRange(e.target.value, dateTo)}
            style={{ padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, background: 'var(--muted)', color: 'var(--foreground)', outline: 'none' }} />
          <span style={{ color: 'var(--muted-foreground)', fontSize: 13 }}>to</span>
          <input type="date" value={dateTo} onChange={e => setDateRange(dateFrom, e.target.value)}
            style={{ padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, background: 'var(--muted)', color: 'var(--foreground)', outline: 'none' }} />
          <button onClick={() => setShowCreate(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', background: '#2563eb', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            <Plus size={15} /> Create Invoice
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={card}>
        {invoices.isLoading ? (
          <QueryLoading text="Loading invoices…" />
        ) : invoices.isError ? (
          <QueryError error={invoices.error} onRetry={() => void invoices.refetch()} />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  {['Invoice ID', 'Patient', 'Date', 'Items', 'Total', 'Paid', 'Balance', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: 'var(--muted-foreground)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(invoices.data?.rows ?? []).map(inv => (
                  <tr key={inv.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px', fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: '#2563eb', fontWeight: 700 }}>{inv.invoiceNumber}</td>
                    <td style={{ padding: '12px', fontWeight: 600, color: 'var(--foreground)' }}>
                      {inv.patientName}
                      <div style={{ fontSize: 11, color: 'var(--muted-foreground)', fontWeight: 400 }}>MRN {inv.mrn}</div>
                    </td>
                    <td style={{ padding: '12px', color: 'var(--muted-foreground)', fontSize: 12 }}>{formatDate(inv.issuedAt)}</td>
                    <td style={{ padding: '12px', color: 'var(--muted-foreground)' }}>{inv.itemCount}</td>
                    <td style={{ padding: '12px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: 'var(--foreground)' }}>{money(inv.totalMinor)}</td>
                    <td style={{ padding: '12px', fontFamily: "'JetBrains Mono', monospace", color: '#16a34a', fontWeight: 700 }}>{money(inv.amountPaidMinor)}</td>
                    <td style={{ padding: '12px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: inv.balanceMinor > 0 ? '#dc2626' : '#16a34a' }}>{money(inv.balanceMinor)}</td>
                    <td style={{ padding: '12px' }}><Badge status={inv.status} /></td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {[Eye, Edit2, Mail, Download].map((Icon, i) => (
                          <button key={i} title={['View', 'Edit', 'Send Email', 'Download PDF'][i]}
                            onClick={() => {
                              if (i !== 0) return
                              const next = new URLSearchParams(searchParams)
                              next.set('invoice', inv.id)
                              setSearchParams(next)
                            }}
                            style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', color: 'var(--muted-foreground)' }}>
                            <Icon size={14} />
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(invoices.data?.rows ?? []).length === 0 && <InlineEmpty text="No invoices match your filters." />}
            <ServerPager meta={invoices.data?.meta} onPageChange={setPage} />
          </div>
        )}
      </div>

      {/* Invoice detail */}
      {openInvoiceId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, padding: 32, width: 620, maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--foreground)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Invoice Detail</h2>
              <button onClick={closeDetail} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)' }}><X size={20} /></button>
            </div>
            {detail.isLoading ? (
              <QueryLoading text="Loading invoice…" />
            ) : detail.isError ? (
              <QueryError error={detail.error} onRetry={() => void detail.refetch()} />
            ) : detail.data ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
                  <div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700, color: '#2563eb' }}>{detail.data.invoiceNumber}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--foreground)' }}>{detail.data.patientName}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>Issued {formatDate(detail.data.issuedAt)} · Due {formatDate(detail.data.dueAt)}</div>
                  </div>
                  <Badge status={detail.data.status} />
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 18 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border)' }}>
                      {['Service', 'Qty', 'Unit', 'Line total'].map(h => (
                        <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {detail.data.items.map(item => (
                      <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px', color: 'var(--foreground)' }}>{item.description}</td>
                        <td style={{ padding: '10px', color: 'var(--muted-foreground)' }}>{item.quantity}</td>
                        <td style={{ padding: '10px', fontFamily: "'JetBrains Mono', monospace", color: 'var(--muted-foreground)' }}>{money(item.unitPriceMinor, true)}</td>
                        <td style={{ padding: '10px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: 'var(--foreground)' }}>{money(item.lineTotalMinor, true)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                  <span style={{ color: 'var(--muted-foreground)' }}>Subtotal</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--foreground)' }}>{money(detail.data.subtotalMinor, true)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                  <span style={{ color: 'var(--muted-foreground)' }}>Tax</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--foreground)' }}>{money(detail.data.taxMinor, true)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700, marginBottom: 6 }}>
                  <span style={{ color: 'var(--foreground)' }}>Total</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--foreground)' }}>{money(detail.data.totalMinor, true)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                  <span style={{ color: 'var(--muted-foreground)' }}>Paid</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", color: '#16a34a' }}>{money(detail.data.amountPaidMinor, true)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 18 }}>
                  <span style={{ color: 'var(--muted-foreground)' }}>Balance</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", color: detail.data.balanceMinor > 0 ? '#dc2626' : '#16a34a' }}>{money(detail.data.balanceMinor, true)}</span>
                </div>
                {detail.data.claims.length > 0 && (
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)', marginBottom: 8 }}>Insurance Claims</div>
                    {detail.data.claims.map(claim => (
                      <div key={claim.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 4 }}>
                        <span>{claim.claimNumber} · {claim.insurer}</span>
                        <span>{money(claim.claimedMinor)} · {label(claim.status)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Create Invoice Modal */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, padding: 32, width: 580, maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--foreground)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Create Invoice</h2>
              <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)' }}><X size={20} /></button>
            </div>
            {actionError && (
              <div style={{ fontSize: 13, fontWeight: 600, color: '#dc2626', marginBottom: 14 }}>{actionError}</div>
            )}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', display: 'block', marginBottom: 6 }}>Patient</label>
              <input value={patientSearch} onChange={e => setPatientSearch(e.target.value)} placeholder="Search patients by name or MRN..."
                style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 10, fontSize: 14, background: 'var(--muted)', color: 'var(--foreground)', outline: 'none', boxSizing: 'border-box', marginBottom: 8 }} />
              <select value={patientId} onChange={e => setPatientId(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 10, fontSize: 14, background: 'var(--muted)', color: 'var(--foreground)', outline: 'none' }}>
                <option value="">{patients.isLoading ? 'Loading patients…' : 'Select patient...'}</option>
                {(patients.data?.rows ?? []).map(patient => (
                  <option key={patient.id} value={patient.id}>{patient.name} · MRN {patient.mrn}</option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>Services</label>
                <button onClick={addService} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer' }}>
                  <Plus size={14} /> Add Service
                </button>
              </div>
              {services.map((svc, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px 32px', gap: 8, marginBottom: 8 }}>
                  <input value={svc.description} onChange={e => updateService(idx, 'description', e.target.value)} placeholder="Service name"
                    style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, background: 'var(--muted)', color: 'var(--foreground)', outline: 'none' }} />
                  <input type="number" value={svc.quantity} min={1} onChange={e => updateService(idx, 'quantity', parseInt(e.target.value) || 1)} placeholder="Qty"
                    style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, background: 'var(--muted)', color: 'var(--foreground)', outline: 'none' }} />
                  <input type="number" value={svc.unitPrice} min={0} onChange={e => updateService(idx, 'unitPrice', parseFloat(e.target.value) || 0)} placeholder="Price"
                    style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, background: 'var(--muted)', color: 'var(--foreground)', outline: 'none' }} />
                  <button onClick={() => removeService(idx)} disabled={services.length === 1}
                    style={{ width: 32, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fee2e2', border: 'none', borderRadius: 8, cursor: services.length === 1 ? 'not-allowed' : 'pointer', color: '#dc2626', opacity: services.length === 1 ? 0.4 : 1 }}>
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
            <div style={{ marginBottom: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', display: 'block', marginBottom: 6 }}>Due Date</label>
                <input type="date" value={dueAt} onChange={e => setDueAt(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 10, fontSize: 14, background: 'var(--muted)', color: 'var(--foreground)', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', display: 'block', marginBottom: 6 }}>Notes</label>
                <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional note"
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 10, fontSize: 14, background: 'var(--muted)', color: 'var(--foreground)', outline: 'none', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--foreground)' }}>Invoice Total</span>
                <span style={{ fontSize: 22, fontWeight: 800, color: '#2563eb', fontFamily: "'JetBrains Mono', monospace" }}>
                  {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(invoiceTotal)}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowCreate(false)}
                style={{ padding: '10px 20px', background: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleCreate} disabled={!patientId || createInvoice.isPending}
                style={{ padding: '10px 24px', background: '#2563eb', color: 'white', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: !patientId || createInvoice.isPending ? 'not-allowed' : 'pointer', opacity: !patientId || createInvoice.isPending ? 0.6 : 1 }}>
                {createInvoice.isPending ? 'Creating…' : 'Create Invoice'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
