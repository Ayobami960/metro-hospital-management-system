import { useMemo, useState } from 'react'
import { Plus, X, AlertTriangle, CheckCircle2, Clock, XCircle, RefreshCw } from 'lucide-react'
import { QueryError, QueryLoading, InlineEmpty } from '@/components/globals/query-state'
import { ServerPager } from '@/components/globals/server-pager'
import { useBillingReports, useClaims, useCreateClaim, useInvoices, useUpdateClaim } from '@/hooks/billing/billing.hooks'
import { useInsurers, useInsurancePlans } from '@/hooks/administration/administration.hooks'
import { errorMessage } from '@/services/api/api-error'
import { formatDate, label, money, pct } from '@/lib/format'

const statusConfig: Record<string, { bg: string; color: string; icon: typeof CheckCircle2 }> = {
  DRAFT: { bg: '#f1f5f9', color: '#64748b', icon: Clock },
  SUBMITTED: { bg: '#dbeafe', color: '#2563eb', icon: Clock },
  UNDER_REVIEW: { bg: '#fef9c3', color: '#ca8a04', icon: Clock },
  APPROVED: { bg: '#dcfce7', color: '#16a34a', icon: CheckCircle2 },
  PARTIALLY_APPROVED: { bg: '#dcfce7', color: '#16a34a', icon: CheckCircle2 },
  DENIED: { bg: '#fee2e2', color: '#dc2626', icon: XCircle },
  APPEALED: { bg: '#ede9fe', color: '#7c3aed', icon: RefreshCw },
}

export default function InsuranceClaimsPage() {
  const [page, setPage] = useState(1)
  const [showSubmit, setShowSubmit] = useState(false)
  const [expandedDenial, setExpandedDenial] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [formData, setFormData] = useState({ invoiceId: '', payer: '', planId: '', amount: '' })

  const yearAgo = useMemo(() => {
    const date = new Date()
    date.setFullYear(date.getFullYear() - 1)
    return date.toISOString().slice(0, 10)
  }, [])
  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])

  const claims = useClaims({ page, pageSize: 10 })
  const reports = useBillingReports(yearAgo, today)
  const openInvoices = useInvoices({ pageSize: 50, status: 'ISSUED' })
  const insurers = useInsurers()
  const plans = useInsurancePlans(formData.payer || undefined)
  const createClaim = useCreateClaim()
  const updateClaim = useUpdateClaim()

  const outcomes = reports.data?.claimOutcomes ?? []
  const countOf = (statuses: string[]) =>
    outcomes.filter(outcome => statuses.includes(outcome.status)).reduce((total, outcome) => total + outcome.count, 0)
  const amountOf = (statuses: string[], key: 'claimedMinor' | 'approvedMinor') =>
    outcomes.filter(outcome => statuses.includes(outcome.status)).reduce((total, outcome) => total + outcome[key], 0)

  const pending = countOf(['SUBMITTED', 'UNDER_REVIEW'])
  const approved = countOf(['APPROVED', 'PARTIALLY_APPROVED'])
  const denied = countOf(['DENIED'])
  const decided = approved + denied
  const approvalRate = decided > 0 ? Math.round((approved / decided) * 100) : null

  const totalClaimed = amountOf(['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'PARTIALLY_APPROVED', 'DENIED', 'APPEALED'], 'claimedMinor')
  const totalApproved = amountOf(['APPROVED', 'PARTIALLY_APPROVED'], 'approvedMinor')

  const handleSubmit = () => {
    const amount = Math.round(parseFloat(formData.amount) * 100)
    if (!formData.invoiceId || !formData.payer || !Number.isFinite(amount) || amount <= 0) {
      setActionError('Select an invoice, an insurer and enter a claimed amount.')
      return
    }
    setActionError(null)
    createClaim
      .mutateAsync({
        invoiceId: formData.invoiceId,
        insurerId: formData.payer,
        planId: formData.planId || undefined,
        claimedMinor: amount,
      })
      .then(() => {
        setShowSubmit(false)
        setFormData({ invoiceId: '', payer: '', planId: '', amount: '' })
      })
      .catch((error: unknown) => setActionError(errorMessage(error, 'Could not submit the claim.')))
  }

  const handleAppeal = (claimId: string) => {
    setActionError(null)
    updateClaim
      .mutateAsync({ claimId, input: { status: 'APPEALED' } })
      .catch((error: unknown) => setActionError(errorMessage(error, 'Could not appeal the claim.')))
  }

  const card = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 24 }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--foreground)', marginBottom: 4, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Insurance Claims</h1>
        <p style={{ color: 'var(--muted-foreground)', fontSize: 15 }}>Track and manage insurance claims and appeals</p>
      </div>

      {actionError && (
        <div style={{ fontSize: 13, fontWeight: 600, color: '#dc2626', marginBottom: 16 }}>{actionError}</div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Pending / Submitted', value: reports.isLoading ? '—' : pending, color: '#ca8a04' },
          { label: 'Approved', value: reports.isLoading ? '—' : approved, color: '#16a34a' },
          { label: 'Denied', value: reports.isLoading ? '—' : denied, color: '#dc2626' },
          { label: 'Approval Rate', value: reports.isLoading ? '—' : pct(approvalRate), color: '#2563eb' },
        ].map(s => (
          <div key={s.label} style={{ ...card, textAlign: 'center' }}>
            <div style={{ fontSize: 32, fontWeight: 800, color: s.color, fontFamily: "'JetBrains Mono', monospace" }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Amount summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 14, color: 'var(--muted-foreground)' }}>Total Claimed (12 mo)</span>
          <span style={{ fontSize: 24, fontWeight: 800, color: 'var(--foreground)', fontFamily: "'JetBrains Mono', monospace" }}>{money(totalClaimed)}</span>
        </div>
        <div style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 14, color: 'var(--muted-foreground)' }}>Total Approved (12 mo)</span>
          <span style={{ fontSize: 24, fontWeight: 800, color: '#16a34a', fontFamily: "'JetBrains Mono', monospace" }}>{money(totalApproved)}</span>
        </div>
      </div>

      {/* Table */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--foreground)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Claims</h3>
          <button onClick={() => setShowSubmit(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', background: '#2563eb', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            <Plus size={15} /> Submit New Claim
          </button>
        </div>

        {claims.isLoading ? (
          <QueryLoading text="Loading claims…" />
        ) : claims.isError ? (
          <QueryError error={claims.error} onRetry={() => void claims.refetch()} />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  {['Claim ID', 'Patient', 'Payer', 'Date Submitted', 'Amount Claimed', 'Amount Approved', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: 'var(--muted-foreground)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(claims.data?.rows ?? []).map(c => {
                  const sc = statusConfig[c.status] ?? statusConfig.SUBMITTED
                  const Icon = sc.icon
                  return (
                    <>
                      <tr key={c.id} style={{ borderBottom: expandedDenial === c.id ? 'none' : '1px solid var(--border)' }}>
                        <td style={{ padding: '12px', fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: '#2563eb', fontWeight: 700 }}>{c.claimNumber}</td>
                        <td style={{ padding: '12px', fontWeight: 600, color: 'var(--foreground)' }}>{c.patientName}</td>
                        <td style={{ padding: '12px', color: 'var(--muted-foreground)' }}>{c.insurer}</td>
                        <td style={{ padding: '12px', color: 'var(--muted-foreground)', fontSize: 12 }}>{formatDate(c.submittedAt)}</td>
                        <td style={{ padding: '12px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: 'var(--foreground)' }}>{money(c.claimedMinor)}</td>
                        <td style={{ padding: '12px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: (c.approvedMinor ?? 0) > 0 ? '#16a34a' : 'var(--muted-foreground)' }}>
                          {c.approvedMinor ? money(c.approvedMinor) : '—'}
                        </td>
                        <td style={{ padding: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Icon size={13} color={sc.color} />
                            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 100, background: sc.bg, color: sc.color }}>{label(c.status)}</span>
                          </div>
                        </td>
                        <td style={{ padding: '12px' }}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            {c.status === 'DENIED' && (
                              <>
                                <button onClick={() => setExpandedDenial(expandedDenial === c.id ? null : c.id)}
                                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                                  <AlertTriangle size={12} /> Reason
                                </button>
                                <button onClick={() => handleAppeal(c.id)} disabled={updateClaim.isPending}
                                  style={{ padding: '5px 10px', background: '#ede9fe', color: '#7c3aed', border: '1px solid #ddd6fe', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: updateClaim.isPending ? 0.6 : 1 }}>
                                  Appeal
                                </button>
                              </>
                            )}
                            {c.status !== 'DENIED' && (
                              <a href={`/billing/invoices?invoice=${c.invoiceId}`}
                                style={{ padding: '5px 10px', background: 'var(--muted)', color: '#2563eb', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', textDecoration: 'none' }}>
                                Track
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                      {expandedDenial === c.id && c.denialReason && (
                        <tr key={`${c.id}-denial`} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td colSpan={8} style={{ padding: '0 12px 14px 12px' }}>
                            <div style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                              <XCircle size={16} color="#dc2626" style={{ marginTop: 1, flexShrink: 0 }} />
                              <div>
                                <div style={{ fontSize: 12, fontWeight: 700, color: '#dc2626', marginBottom: 4 }}>Denial Reason</div>
                                <div style={{ fontSize: 13, color: '#7f1d1d' }}>{c.denialReason}</div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
            {(claims.data?.rows ?? []).length === 0 && <InlineEmpty text="No insurance claims recorded yet." />}
            <ServerPager meta={claims.data?.meta} onPageChange={setPage} />
          </div>
        )}
      </div>

      {/* Submit Claim Modal */}
      {showSubmit && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, padding: 32, width: 520, maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--foreground)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Submit New Claim</h2>
              <button onClick={() => setShowSubmit(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)' }}><X size={20} /></button>
            </div>
            {actionError && (
              <div style={{ fontSize: 13, fontWeight: 600, color: '#dc2626', marginBottom: 14 }}>{actionError}</div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', display: 'block', marginBottom: 6 }}>Invoice</label>
                <select value={formData.invoiceId} onChange={e => setFormData({ ...formData, invoiceId: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 10, fontSize: 14, background: 'var(--muted)', color: 'var(--foreground)', outline: 'none' }}>
                  <option value="">{openInvoices.isLoading ? 'Loading invoices…' : 'Select an issued invoice...'}</option>
                  {(openInvoices.data?.rows ?? []).map(invoice => (
                    <option key={invoice.id} value={invoice.id}>
                      {invoice.invoiceNumber} · {invoice.patientName} · {money(invoice.balanceMinor, true)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', display: 'block', marginBottom: 6 }}>Insurance Payer</label>
                <select value={formData.payer} onChange={e => setFormData({ ...formData, payer: e.target.value, planId: '' })}
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 10, fontSize: 14, background: 'var(--muted)', color: 'var(--foreground)', outline: 'none' }}>
                  <option value="">{insurers.isLoading ? 'Loading insurers…' : 'Select payer...'}</option>
                  {(insurers.data ?? []).map(insurer => (
                    <option key={insurer.id} value={insurer.id}>{insurer.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', display: 'block', marginBottom: 6 }}>Plan</label>
                <select value={formData.planId} onChange={e => setFormData({ ...formData, planId: e.target.value })}
                  disabled={!formData.payer}
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 10, fontSize: 14, background: 'var(--muted)', color: 'var(--foreground)', outline: 'none' }}>
                  <option value="">Optional</option>
                  {(plans.data ?? []).map(plan => (
                    <option key={plan.id} value={plan.id}>{plan.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', display: 'block', marginBottom: 6 }}>Amount Claimed ($)</label>
                <input type="number" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} placeholder="0.00"
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 10, fontSize: 14, background: 'var(--muted)', color: 'var(--foreground)', outline: 'none', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
              <button onClick={() => setShowSubmit(false)}
                style={{ padding: '10px 20px', background: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleSubmit} disabled={createClaim.isPending}
                style={{ padding: '10px 24px', background: '#2563eb', color: 'white', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: createClaim.isPending ? 'not-allowed' : 'pointer', opacity: createClaim.isPending ? 0.6 : 1 }}>
                {createClaim.isPending ? 'Submitting…' : 'Submit Claim'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
