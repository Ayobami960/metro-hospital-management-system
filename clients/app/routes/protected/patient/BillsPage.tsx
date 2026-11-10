import { useState } from "react";
import { toast } from "sonner";
import { CreditCard, Download, FileText, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

import { useInvoice, useInvoices, useRecordPayment } from "@/hooks/billing/billing.hooks";
import { QueryError, QueryLoading, InlineEmpty } from "@/components/globals/query-state";
import { ServerPager } from "@/components/globals/server-pager";
import { errorMessage } from "@/services/api/api-error";
import { formatDate, label as toLabel, money } from "@/lib/format";

const statusClass: Record<string, string> = {
  PAID: "bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400",
  PARTIALLY_PAID: "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400",
  ISSUED: "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400",
  OVERDUE: "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400",
  DRAFT: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400",
  VOID: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400",
};

function PayModal({ invoiceId, amountMinor, onClose }: { invoiceId: string; amountMinor: number; onClose: () => void }) {
  const recordPayment = useRecordPayment();
  const [reference, setReference] = useState("");
  const [method, setMethod] = useState<"CARD" | "CASH" | "TRANSFER" | "CHECK">("CARD");

  const pay = async () => {
    try {
      await recordPayment.mutateAsync({
        amountMinor,
        method,
        reference: reference || undefined,
        allocations: [{ invoiceId, amountMinor }],
      });
      toast.success("Payment recorded");
      onClose();
    } catch (error) {
      toast.error(errorMessage(error, "Could not record the payment."));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000]">
      <div className="bg-card rounded-[20px] p-8 w-[420px] shadow-[0_24px_64px_rgba(0,0,0,0.18)]">
        <h3 className="text-xl font-extrabold text-foreground mb-1 font-['Plus_Jakarta_Sans',sans-serif]">Make Payment</h3>
        <p className="text-muted-foreground text-sm mb-5">Amount due: {money(amountMinor)}</p>

        <div className="mb-3.5">
          <label className="text-xs font-bold text-muted-foreground block mb-1.5">Payment Method</label>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as typeof method)}
            className="w-full py-2.5 px-3.5 border-[1.5px] border-border rounded-[10px] text-[13px] bg-muted text-foreground outline-none box-border"
          >
            {["CARD", "CASH", "TRANSFER", "CHECK"].map((option) => (
              <option key={option} value={option}>{toLabel(option)}</option>
            ))}
          </select>
        </div>
        <div className="mb-3.5">
          <label className="text-xs font-bold text-muted-foreground block mb-1.5">Reference (optional)</label>
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Card authorisation or cheque number"
            className="w-full py-2.5 px-3.5 border-[1.5px] border-border rounded-[10px] text-[13px] bg-muted text-foreground outline-none box-border"
          />
        </div>

        <div className="grid grid-cols-2 gap-2.5 mt-5">
          <button onClick={onClose} className="py-3 bg-muted text-foreground border border-border rounded-xl text-sm font-semibold cursor-pointer">Cancel</button>
          <button
            onClick={() => void pay()}
            disabled={recordPayment.isPending}
            className="py-3 bg-blue-600 text-white border-none rounded-xl text-sm font-bold cursor-pointer disabled:opacity-60"
          >
            {recordPayment.isPending ? "Processing…" : `Pay ${money(amountMinor)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BillsPage() {
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [payingInvoice, setPayingInvoice] = useState<{ id: string; amountMinor: number } | null>(null);

  const invoices = useInvoices({ page, pageSize: 10, sort: "issuedAt", order: "desc" });
  const rows = invoices.data?.rows ?? [];
  const detail = useInvoice(expanded);

  const totalOutstanding = rows.reduce((sum, invoice) => sum + invoice.balanceMinor, 0);
  const outstandingCount = rows.filter((invoice) => invoice.balanceMinor > 0).length;
  const paidCount = rows.filter((invoice) => invoice.status === "PAID").length;

  return (
    <div className="p-6">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-[26px] font-extrabold text-foreground mb-1 font-['Plus_Jakarta_Sans',sans-serif]">Bills &amp; Payments</h1>
          <p className="text-muted-foreground text-[15px]">
            {invoices.data?.meta.total ?? rows.length} invoices · Balance due on this page: {money(totalOutstanding)}
          </p>
        </div>
        <a href="/api/v1/exports/invoices?format=csv" className="flex items-center gap-1.5 py-[9px] px-4 bg-muted text-foreground border border-border rounded-[10px] text-[13px] font-semibold cursor-pointer">
          <Download size={14} /> Download Statements
        </a>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-2xl p-6 card-shadow">
          <div className="text-xs font-bold text-red-600 dark:text-red-400 mb-2">Amount Due</div>
          <div className="text-[28px] font-black text-red-600 dark:text-red-400 mb-1 font-mono">{money(totalOutstanding)}</div>
          <div className="text-xs text-red-600 dark:text-red-400">{outstandingCount} outstanding invoice(s)</div>
        </div>
        <div className="bg-card border border-border rounded-2xl p-6 card-shadow">
          <div className="text-xs font-bold text-muted-foreground mb-2">Paid In Full</div>
          <div className="text-[22px] font-extrabold text-foreground mb-1 font-mono">{paidCount}</div>
          <div className="text-xs text-muted-foreground">invoices on this page</div>
        </div>
        <div className="bg-card border border-border rounded-2xl p-6 card-shadow">
          <div className="text-xs font-bold text-muted-foreground mb-2">Total Billed</div>
          <div className="text-[22px] font-extrabold text-foreground mb-1 font-mono">
            {money(rows.reduce((sum, invoice) => sum + invoice.totalMinor, 0))}
          </div>
          <div className="text-xs text-muted-foreground">across {rows.length} invoices</div>
        </div>
      </div>

      {invoices.isLoading && <QueryLoading text="Loading your invoices…" />}
      {invoices.isError && <QueryError error={invoices.error} onRetry={() => void invoices.refetch()} />}

      {!invoices.isLoading && !invoices.isError && (
        <>
          <div className="flex flex-col gap-3">
            {rows.map((invoice) => {
              const isExpanded = expanded === invoice.id;
              return (
                <div key={invoice.id} className="bg-card border border-border rounded-2xl overflow-hidden card-shadow">
                  <button
                    onClick={() => setExpanded(isExpanded ? null : invoice.id)}
                    className="w-full py-[18px] px-6 flex items-center gap-4 border-none bg-transparent cursor-pointer text-left"
                  >
                    <FileText size={20} className="text-blue-600 dark:text-blue-400" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2.5 mb-1">
                        <span className="text-sm font-bold text-foreground font-mono">{invoice.invoiceNumber}</span>
                        <span className={cn("flex items-center gap-1 text-[11px] font-bold px-2.5 py-[3px] rounded-full", statusClass[invoice.status] ?? "bg-muted text-muted-foreground")}>
                          {toLabel(invoice.status)}
                        </span>
                        {invoice.overdue && <span className="text-[11px] font-bold text-red-600">Overdue</span>}
                      </div>
                      <div className="text-[13px] text-foreground font-semibold">
                        {invoice.itemCount} service{invoice.itemCount === 1 ? "" : "s"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Issued {formatDate(invoice.issuedAt)} · Due {formatDate(invoice.dueAt)}
                      </div>
                    </div>
                    <div className="text-right mr-2">
                      <div className={cn("text-base font-extrabold font-mono", invoice.balanceMinor > 0 ? "text-red-600 dark:text-red-400" : "text-foreground")}>
                        {money(invoice.balanceMinor)}
                      </div>
                      <div className="text-[11px] text-muted-foreground">your share</div>
                    </div>
                    {isExpanded ? <ChevronUp size={16} color="var(--muted-foreground)" /> : <ChevronDown size={16} color="var(--muted-foreground)" />}
                  </button>

                  {isExpanded && (
                    <div className="border-t border-border py-[18px] px-6">
                      {detail.isLoading && <div className="text-xs text-muted-foreground py-2">Loading line items…</div>}
                      {detail.isError && <QueryError error={detail.error} onRetry={() => void detail.refetch()} />}
                      {detail.data && (
                        <>
                          <table className="w-full border-collapse mb-4 text-[13px]">
                            <thead>
                              <tr className="border-b-[1.5px] border-border">
                                {["Service", "Qty", "Unit Price", "Total"].map((h) => (
                                  <th key={h} className="py-2 px-3 text-left text-xs font-bold text-muted-foreground">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {detail.data.items.map((item) => (
                                <tr key={item.id} className="border-b border-border">
                                  <td className="py-2.5 px-3 text-foreground">{item.description}</td>
                                  <td className="py-2.5 px-3 text-muted-foreground font-mono">{item.quantity}</td>
                                  <td className="py-2.5 px-3 font-mono">{money(item.unitPriceMinor)}</td>
                                  <td className="py-2.5 px-3 font-mono font-bold">{money(item.lineTotalMinor)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <div className="flex justify-end gap-8 py-3 border-t border-border text-[13px]">
                            <div className="text-right">
                              <div className="text-muted-foreground mb-1">Paid to date: <strong>{money(detail.data.amountPaidMinor)}</strong></div>
                              <div className="text-muted-foreground mb-1">Total charges: <strong>{money(detail.data.totalMinor)}</strong></div>
                              <div className={cn("font-extrabold text-[15px]", detail.data.balanceMinor > 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400")}>
                                Your Balance: {money(detail.data.balanceMinor)}
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2.5 mt-3.5">
                            <a href="/api/v1/exports/invoices?format=xlsx" className="py-2 px-4 bg-muted text-foreground border border-border rounded-lg text-[13px] font-semibold cursor-pointer flex items-center gap-1.5">
                              <Download size={13} /> Download
                            </a>
                            {detail.data.balanceMinor > 0 && (
                              <button
                                onClick={() => setPayingInvoice({ id: detail.data!.id, amountMinor: detail.data!.balanceMinor })}
                                className="py-2 px-4 bg-red-600 text-white border-none rounded-lg text-[13px] font-semibold cursor-pointer flex items-center gap-1.5"
                              >
                                <CreditCard size={13} /> Pay {money(detail.data.balanceMinor)}
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {rows.length === 0 && <InlineEmpty text="You have no invoices on file." />}
          <ServerPager meta={invoices.data?.meta} onPageChange={setPage} />
        </>
      )}

      {payingInvoice && (
        <PayModal invoiceId={payingInvoice.id} amountMinor={payingInvoice.amountMinor} onClose={() => setPayingInvoice(null)} />
      )}
    </div>
  );
}
