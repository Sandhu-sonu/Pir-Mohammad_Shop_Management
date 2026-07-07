'use client';

import React, { useState } from 'react';
import { 
  createInvoiceAction, 
  markPaidAction, 
  cancelInvoiceAction, 
  issueRefundAction, 
  renewSubscriptionAction 
} from '@/lib/actions/billing';
import { useRouter } from 'next/navigation';

interface InvoiceItem {
  id: string;
  invoiceNumber: string;
  shopId: string;
  shopName: string;
  issueDate: Date;
  dueDate: Date;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  status: string;
  pdfUrl?: string | null;
  notes?: string | null;
}

interface PaymentItem {
  id: string;
  invoiceNumber: string;
  shopName: string;
  paymentDate: Date;
  amount: number;
  paymentMethod: string;
  gateway: string;
  gatewayReference: string;
  transactionId: string;
  status: string;
}

interface RefundItem {
  id: string;
  invoiceNumber: string;
  originalAmount: number;
  refundAmount: number;
  refundReason: string;
  status: string;
  gatewayReference: string;
  createdAt: Date;
}

interface TransactionItem {
  id: string;
  shopName: string;
  planName: string;
  type: string;
  startDate: Date;
  endDate: Date;
  amount: number;
  notes?: string | null;
  createdAt: Date;
}

interface AttemptItem {
  id: string;
  invoiceNumber: string;
  shopName: string;
  gateway: string;
  status: string;
  responseCode: string;
  createdAt: Date;
}

interface GatewayLogItem {
  id: string;
  gateway: string;
  eventType: string;
  payload: string;
  ip: string;
  createdAt: Date;
}

interface SaaSBillingManagerProps {
  initialInvoices: InvoiceItem[];
  initialPayments: PaymentItem[];
  initialRefunds: RefundItem[];
  initialTransactions: TransactionItem[];
  initialAttempts: AttemptItem[];
  initialGatewayLogs: GatewayLogItem[];
  shops: { id: string; name: string }[];
  plans: { id: string; name: string; price: any }[];
  mrr: number;
  arr: number;
  totalRevenue: number;
  totalOutstanding: number;
}

type TabType = 'overview' | 'invoices' | 'payments' | 'refunds' | 'transactions' | 'logs';

export default function SaaSBillingManager({
  initialInvoices,
  initialPayments,
  initialRefunds,
  initialTransactions,
  initialAttempts,
  initialGatewayLogs,
  shops,
  plans,
  mrr,
  arr,
  totalRevenue,
  totalOutstanding
}: SaaSBillingManagerProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  
  // Lists state
  const [invoices, setInvoices] = useState<InvoiceItem[]>(initialInvoices);
  const [payments, setPayments] = useState<PaymentItem[]>(initialPayments);
  const [refunds, setRefunds] = useState<RefundItem[]>(initialRefunds);
  const transactions = initialTransactions;
  
  // Search & filters
  const [searchInvoice, setSearchInvoice] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Modals state
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [newInvoiceShopId, setNewInvoiceShopId] = useState('');
  const [newInvoicePlanId, setNewInvoicePlanId] = useState('');
  
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceItem | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('MANUAL');
  const [gatewayName, setGatewayName] = useState('MANUAL');
  const [gatewayRef, setGatewayRef] = useState('');

  const [refundPaymentId, setRefundPaymentId] = useState<string | null>(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');

  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // Filtered invoices client side
  const filteredInvoices = invoices.filter(inv => {
    const matchSearch = inv.invoiceNumber.toLowerCase().includes(searchInvoice.toLowerCase()) ||
                        inv.shopName.toLowerCase().includes(searchInvoice.toLowerCase());
    const matchStatus = filterStatus ? inv.status === filterStatus : true;
    return matchSearch && matchStatus;
  });

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInvoiceShopId || !newInvoicePlanId) return;

    setLoading(true);
    setActionError('');
    setActionSuccess('');

    const res = await createInvoiceAction(newInvoiceShopId, newInvoicePlanId);
    if (res.success) {
      setActionSuccess('Subscription invoice created successfully.');
      setShowInvoiceModal(false);
      setNewInvoiceShopId('');
      setNewInvoicePlanId('');
      router.refresh();
    } else {
      setActionError(res.error || 'Failed to create invoice');
    }
    setLoading(false);
  };

  const handleMarkPaid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;

    setLoading(true);
    setActionError('');
    setActionSuccess('');

    const res = await markPaidAction(
      selectedInvoice.id,
      paymentMethod,
      gatewayName,
      gatewayRef || undefined
    );
    
    if (res.success) {
      setActionSuccess(`Invoice ${selectedInvoice.invoiceNumber} updated to PAID and subscription extended.`);
      setSelectedInvoice(null);
      router.refresh();
    } else {
      setActionError(res.error || 'Payment processing failed.');
    }
    setLoading(false);
  };

  const handleCancelInvoice = async (invoiceId: string) => {
    setLoading(true);
    setActionError('');
    setActionSuccess('');

    const res = await cancelInvoiceAction(invoiceId);
    if (res.success) {
      setActionSuccess('Invoice cancelled successfully.');
      setSelectedInvoice(null);
      router.refresh();
    } else {
      setActionError(res.error || 'Failed to cancel invoice.');
    }
    setLoading(false);
  };

  const handleIssueRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundPaymentId || !refundAmount || !refundReason.trim()) return;

    setLoading(true);
    setActionError('');
    setActionSuccess('');

    const res = await issueRefundAction(
      refundPaymentId,
      parseFloat(refundAmount),
      refundReason
    );

    if (res.success) {
      setActionSuccess('Refund completed successfully.');
      setRefundPaymentId(null);
      setRefundAmount('');
      setRefundReason('');
      router.refresh();
    } else {
      setActionError(res.error || 'Refund transaction rejected.');
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      {actionError && (
        <div className="bg-red-950 text-red-400 p-4 rounded-xl text-xs font-semibold text-center border border-red-900">
          {actionError}
        </div>
      )}
      {actionSuccess && (
        <div className="bg-green-950 text-green-400 p-4 rounded-xl text-xs font-semibold text-center border border-green-900">
          {actionSuccess}
        </div>
      )}

      {/* Tabs list navigation */}
      <div className="flex border-b border-gray-800 space-x-6 text-sm font-semibold text-gray-500">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-3 transition duration-150 ${activeTab === 'overview' ? 'text-white border-b-2 border-[#FF6B6B]' : 'hover:text-gray-300'}`}
        >
          Overview / ਸੰਖੇਪ
        </button>
        <button
          onClick={() => setActiveTab('invoices')}
          className={`pb-3 transition duration-150 ${activeTab === 'invoices' ? 'text-white border-b-2 border-[#FF6B6B]' : 'hover:text-gray-300'}`}
        >
          Invoices / ਬਿੱਲ ਸੂਚੀ
        </button>
        <button
          onClick={() => setActiveTab('payments')}
          className={`pb-3 transition duration-150 ${activeTab === 'payments' ? 'text-white border-b-2 border-[#FF6B6B]' : 'hover:text-gray-300'}`}
        >
          Payments / ਭੁਗਤਾਨ
        </button>
        <button
          onClick={() => setActiveTab('refunds')}
          className={`pb-3 transition duration-150 ${activeTab === 'refunds' ? 'text-white border-b-2 border-[#FF6B6B]' : 'hover:text-gray-300'}`}
        >
          Refunds / ਰਿਫੰਡ
        </button>
        <button
          onClick={() => setActiveTab('transactions')}
          className={`pb-3 transition duration-150 ${activeTab === 'transactions' ? 'text-white border-b-2 border-[#FF6B6B]' : 'hover:text-gray-300'}`}
        >
          Transactions / ਲਾਗ
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`pb-3 transition duration-150 ${activeTab === 'logs' ? 'text-white border-b-2 border-[#FF6B6B]' : 'hover:text-gray-300'}`}
        >
          Gateway Webhook Logs
        </button>
      </div>

      {/* Overview tab content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl">
              <span className="text-xs text-gray-500 uppercase font-bold">Monthly Recurring Revenue</span>
              <p className="text-3xl font-black text-emerald-400 mt-2">₹{mrr}</p>
              <p className="text-[10px] text-gray-400 mt-1">Based on active plans</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl">
              <span className="text-xs text-gray-500 uppercase font-bold">Annual Recurring Revenue</span>
              <p className="text-3xl font-black text-white mt-2">₹{arr}</p>
              <p className="text-[10px] text-gray-400 mt-1">MRR extrapolated run rate</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl">
              <span className="text-xs text-gray-500 uppercase font-bold">Total Collections</span>
              <p className="text-3xl font-black text-green-400 mt-2">₹{totalRevenue}</p>
              <p className="text-[10px] text-gray-400 mt-1">Sum of processed payments</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl">
              <span className="text-xs text-gray-500 uppercase font-bold">Outstanding Invoices</span>
              <p className="text-3xl font-black text-red-400 mt-2">₹{totalOutstanding}</p>
              <p className="text-[10px] text-gray-400 mt-1">Unpaid / Overdue totals</p>
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <h3 className="text-base font-bold text-white mb-4">Billing Operations Actions</h3>
            <div className="flex gap-4">
              <button
                onClick={() => setShowInvoiceModal(true)}
                className="bg-primary hover:bg-opacity-95 text-white font-bold py-2.5 px-6 rounded-xl text-xs border border-primary/20 transition"
                style={{ backgroundColor: '#FF6B6B' }}
              >
                + Create Manual Invoice
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoices tab content */}
      {activeTab === 'invoices' && (
        <div className="space-y-4">
          {/* Search bar */}
          <div className="flex flex-col md:flex-row gap-4 items-end bg-gray-950/45 p-4 rounded-xl border border-gray-805">
            <div className="flex-1 w-full space-y-1">
              <label className="text-xs text-gray-400 font-bold uppercase">Search Invoices</label>
              <input
                type="text"
                placeholder="Search by invoice number or shop name..."
                value={searchInvoice}
                onChange={(e) => setSearchInvoice(e.target.value)}
                className="w-full bg-gray-950 border border-gray-850 rounded-xl p-2.5 text-white text-xs focus:outline-none"
              />
            </div>
            <div className="w-full md:w-48 space-y-1">
              <label className="text-xs text-gray-400 font-bold uppercase">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full bg-gray-950 border border-gray-850 rounded-xl p-2.5 text-white text-xs focus:outline-none"
              >
                <option value="">All statuses</option>
                <option value="PAID">Paid</option>
                <option value="PENDING">Pending</option>
                <option value="OVERDUE">Overdue</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-300">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-505 text-xs">
                    <th className="py-2.5 px-3">Invoice No</th>
                    <th className="py-2.5 px-3">Shop</th>
                    <th className="py-2.5 px-3">Issue / Due Date</th>
                    <th className="py-2.5 px-3">Total Amount</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.map((inv) => (
                    <tr key={inv.id} className="border-b border-gray-800/40 hover:bg-gray-800/10 text-xs">
                      <td className="py-3 px-3 font-bold text-white">{inv.invoiceNumber}</td>
                      <td className="py-3 px-3">{inv.shopName}</td>
                      <td className="py-3 px-3 text-gray-400">
                        {new Date(inv.issueDate).toLocaleDateString()} / {new Date(inv.dueDate).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-3 font-semibold text-white">₹{inv.totalAmount}</td>
                      <td className="py-3 px-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          inv.status === 'PAID' ? 'bg-green-950 text-green-400' :
                          inv.status === 'PENDING' ? 'bg-yellow-950 text-yellow-400' :
                          inv.status === 'OVERDUE' ? 'bg-red-950 text-red-450' :
                          'bg-gray-800 text-gray-400'
                        }`}>
                          {inv.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right space-x-2">
                        <button
                          onClick={() => setSelectedInvoice(inv)}
                          className="bg-gray-800 hover:bg-gray-700 text-white text-[10px] font-bold px-2 py-1 rounded"
                        >
                          View Details
                        </button>
                        <a
                          href={`/api/v1/saas/invoices/${inv.id}/pdf`}
                          className="inline-block bg-primary/20 hover:bg-primary text-[#FF6B6B] hover:text-white text-[10px] font-bold px-2 py-1 rounded border border-[#FF6B6B]/30 transition"
                        >
                          PDF
                        </a>
                      </td>
                    </tr>
                  ))}
                  {filteredInvoices.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-gray-500 font-bold">
                        No invoices match search filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Payments tab content */}
      {activeTab === 'payments' && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-300">
              <thead>
                <tr className="border-b border-gray-800 text-gray-500 text-xs">
                  <th className="py-2.5 px-3">Invoice No</th>
                  <th className="py-2.5 px-3">Shop</th>
                  <th className="py-2.5 px-3">Payment Date</th>
                  <th className="py-2.5 px-3">Amount</th>
                  <th className="py-2.5 px-3">Method / Gateway</th>
                  <th className="py-2.5 px-3">Gateway Ref</th>
                  <th className="py-2.5 px-3">Txn ID</th>
                  <th className="py-2.5 px-3 text-right">Refund</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b border-gray-800/40 hover:bg-gray-800/10 text-xs">
                    <td className="py-3 px-3 font-semibold text-white">{p.invoiceNumber}</td>
                    <td className="py-3 px-3">{p.shopName}</td>
                    <td className="py-3 px-3 text-gray-400">{new Date(p.paymentDate).toLocaleString()}</td>
                    <td className="py-3 px-3 font-semibold text-white">₹{p.amount}</td>
                    <td className="py-3 px-3">{p.paymentMethod} / {p.gateway}</td>
                    <td className="py-3 px-3 text-[10px] text-gray-400 font-mono truncate max-w-[100px]">{p.gatewayReference}</td>
                    <td className="py-3 px-3 text-[10px] text-gray-400 font-mono truncate max-w-[100px]">{p.transactionId}</td>
                    <td className="py-3 px-3 text-right">
                      {p.status === 'SUCCESS' ? (
                        <button
                          onClick={() => {
                            setRefundPaymentId(p.id);
                            setRefundAmount(p.amount.toString());
                          }}
                          className="bg-red-950/20 hover:bg-red-950 text-red-400 border border-red-900/40 text-[9px] font-bold px-2 py-0.5 rounded transition"
                        >
                          Issue Refund
                        </button>
                      ) : (
                        <span className="text-[10px] text-red-500 font-bold">REFUNDED</span>
                      )}
                    </td>
                  </tr>
                ))}
                {payments.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-gray-500">
                      No payments processed yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Refunds tab content */}
      {activeTab === 'refunds' && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-300">
              <thead>
                <tr className="border-b border-gray-800 text-gray-500 text-xs">
                  <th className="py-2.5 px-3">Invoice No</th>
                  <th className="py-2.5 px-3">Refund Amount</th>
                  <th className="py-2.5 px-3">Original Paid</th>
                  <th className="py-2.5 px-3">Reason</th>
                  <th className="py-2.5 px-3">Gateway Ref</th>
                  <th className="py-2.5 px-3">Refunded Date</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {refunds.map((r) => (
                  <tr key={r.id} className="border-b border-gray-800/40 hover:bg-gray-800/10 text-xs">
                    <td className="py-3 px-3 font-semibold text-white">{r.invoiceNumber}</td>
                    <td className="py-3 px-3 font-bold text-red-400">₹{r.refundAmount}</td>
                    <td className="py-3 px-3 text-gray-400">₹{r.originalAmount}</td>
                    <td className="py-3 px-3 text-gray-400">{r.refundReason}</td>
                    <td className="py-3 px-3 font-mono text-[10px] text-gray-500">{r.gatewayReference}</td>
                    <td className="py-3 px-3 text-gray-500">{new Date(r.createdAt).toLocaleString()}</td>
                    <td className="py-3 px-3">
                      <span className="bg-red-950 text-red-400 px-2 py-0.5 rounded text-[10px] font-bold">
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {refunds.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-500">
                      No refunds issued yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Transactions tab content */}
      {activeTab === 'transactions' && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-300">
              <thead>
                <tr className="border-b border-gray-800 text-gray-500 text-xs">
                  <th className="py-2.5 px-3">Shop</th>
                  <th className="py-2.5 px-3">Plan</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Active Period</th>
                  <th className="py-2.5 px-3">Amount</th>
                  <th className="py-2.5 px-3">Logged Date</th>
                  <th className="py-2.5 px-3">Notes</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id} className="border-b border-gray-800/40 hover:bg-gray-800/10 text-xs">
                    <td className="py-3 px-3 font-bold text-white">{t.shopName}</td>
                    <td className="py-3 px-3">{t.planName}</td>
                    <td className="py-3 px-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold ${
                        t.type === 'RENEWAL' ? 'bg-green-950 text-green-400' : 'bg-blue-950 text-blue-400'
                      }`}>
                        {t.type}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-gray-400">
                      {new Date(t.startDate).toLocaleDateString()} - {new Date(t.endDate).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-3 font-semibold text-white">₹{t.amount}</td>
                    <td className="py-3 px-3 text-gray-500">{new Date(t.createdAt).toLocaleString()}</td>
                    <td className="py-3 px-3 text-gray-400">{t.notes}</td>
                  </tr>
                ))}
                {transactions.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-500">
                      No plan transactions logs yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Logs tab content */}
      {activeTab === 'logs' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Attempts logs */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-white">SaaS Gateway Call Attempts</h3>
            <div className="overflow-x-auto max-h-[400px]">
              <table className="w-full text-left text-sm text-gray-300">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-500 text-xs">
                    <th className="py-2 px-3">Invoice No</th>
                    <th className="py-2 px-3">Gateway</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {initialAttempts.map((a) => (
                    <tr key={a.id} className="border-b border-gray-800/40 text-xs hover:bg-gray-800/10">
                      <td className="py-2.5 px-3 font-semibold text-white">{a.invoiceNumber}</td>
                      <td className="py-2.5 px-3">{a.gateway}</td>
                      <td className="py-2.5 px-3">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold ${
                          a.status === 'SUCCESS' ? 'bg-green-950 text-green-400' : 'bg-red-950 text-red-400'
                        }`}>
                          {a.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-gray-500">{new Date(a.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                  {initialAttempts.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-4 text-center text-gray-500">No attempts logged yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Webhook logs */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-white">Incoming Webhooks Payload Log</h3>
            <div className="overflow-x-auto max-h-[400px]">
              <table className="w-full text-left text-sm text-gray-300">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-500 text-xs">
                    <th className="py-2 px-3">Gateway</th>
                    <th className="py-2 px-3">Event Type</th>
                    <th className="py-2 px-3">Caller IP</th>
                    <th className="py-2 px-3">Received Time</th>
                  </tr>
                </thead>
                <tbody>
                  {initialGatewayLogs.map((l) => (
                    <tr key={l.id} className="border-b border-gray-800/40 text-xs hover:bg-gray-800/10">
                      <td className="py-2.5 px-3 font-semibold text-white">{l.gateway}</td>
                      <td className="py-2.5 px-3 text-emerald-400 font-mono text-[10px]">{l.eventType}</td>
                      <td className="py-2.5 px-3 text-gray-400">{l.ip}</td>
                      <td className="py-2.5 px-3 text-gray-500">{new Date(l.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                  {initialGatewayLogs.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-4 text-center text-gray-500">No webhooks received yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Manual Invoice Creation Modal */}
      {showInvoiceModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 z-50">
          <form onSubmit={handleCreateInvoice} className="bg-gray-900 border border-gray-800 rounded-2xl max-w-sm w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-white">Create SaaS billing Invoice</h3>
            <p className="text-xs text-gray-400">Generate a subscription invoice. Payment options can be applied after creation.</p>
            
            <div className="space-y-1">
              <label className="text-xs text-gray-400 font-bold uppercase">Select Shop</label>
              <select
                value={newInvoiceShopId}
                onChange={(e) => setNewInvoiceShopId(e.target.value)}
                required
                className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-white text-xs focus:outline-none"
              >
                <option value="">-- Choose Tenant Shop --</option>
                {shops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-gray-400 font-bold uppercase">Select Plan Tier</label>
              <select
                value={newInvoicePlanId}
                onChange={(e) => setNewInvoicePlanId(e.target.value)}
                required
                className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-white text-xs focus:outline-none"
              >
                <option value="">-- Choose Subscription Plan --</option>
                {plans.map(p => <option key={p.id} value={p.id}>{p.name} (₹{p.price.toString()})</option>)}
              </select>
            </div>

            <div className="flex space-x-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowInvoiceModal(false);
                  setNewInvoiceShopId('');
                  setNewInvoicePlanId('');
                }}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-bold py-2 rounded-xl text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !newInvoiceShopId || !newInvoicePlanId}
                className="flex-1 bg-primary text-white font-bold py-2 rounded-xl text-xs hover:bg-opacity-90 disabled:opacity-50"
                style={{ backgroundColor: '#FF6B6B' }}
              >
                Generate Invoice
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Invoice Details Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 z-50">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-start border-b border-gray-800/80 pb-3">
              <div>
                <h3 className="text-lg font-bold text-white">Invoice Details</h3>
                <p className="text-xs text-gray-500 font-bold">{selectedInvoice.invoiceNumber}</p>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                selectedInvoice.status === 'PAID' ? 'bg-green-950 text-green-400' :
                selectedInvoice.status === 'PENDING' ? 'bg-yellow-950 text-yellow-400' :
                'bg-red-950 text-red-400'
              }`}>
                {selectedInvoice.status}
              </span>
            </div>

            <div className="space-y-2.5 text-xs text-gray-300">
              <div className="flex justify-between">
                <span className="text-gray-500 font-medium">Billed Tenant Shop:</span>
                <span className="font-bold text-white">{selectedInvoice.shopName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 font-medium">Issue / Due Date:</span>
                <span className="font-bold text-white">
                  {new Date(selectedInvoice.issueDate).toLocaleDateString()} - {new Date(selectedInvoice.dueDate).toLocaleDateString()}
                </span>
              </div>
              <div className="border-t border-gray-850 my-2 pt-2 space-y-2">
                <div className="flex justify-between">
                  <span>Subtotal Amount:</span>
                  <span className="font-semibold text-white">₹{selectedInvoice.subtotal}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tax Amount (18% GST):</span>
                  <span className="font-semibold text-white">₹{selectedInvoice.taxAmount}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-white">
                  <span>Total Amount Paid:</span>
                  <span className="text-[#FF6B6B]">₹{selectedInvoice.totalAmount}</span>
                </div>
              </div>
            </div>

            {selectedInvoice.status !== 'PAID' && selectedInvoice.status !== 'CANCELLED' && (
              <form onSubmit={handleMarkPaid} className="bg-gray-950 p-4 rounded-xl border border-gray-850 space-y-4">
                <p className="text-[10px] text-gray-400 uppercase font-extrabold tracking-wider">Mark Invoice Paid manually</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-500 font-bold uppercase">Method</label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-800 rounded-lg p-2 text-white text-[10px] focus:outline-none"
                    >
                      <option value="MANUAL">Manual Cash</option>
                      <option value="UPI">UPI Transfer</option>
                      <option value="BANK_TRANSFER">Bank Draft</option>
                      <option value="CARD">Card Gateway</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-500 font-bold uppercase">Gateway</label>
                    <select
                      value={gatewayName}
                      onChange={(e) => setGatewayName(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-800 rounded-lg p-2 text-white text-[10px] focus:outline-none"
                    >
                      <option value="MANUAL">Manual Approval</option>
                      <option value="STRIPE">Stripe Provider</option>
                      <option value="RAZORPAY">Razorpay Provider</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 font-bold uppercase">Gateway Reference ID / remarks</label>
                  <input
                    type="text"
                    placeholder="Enter order reference or bank note..."
                    value={gatewayRef}
                    onChange={(e) => setGatewayRef(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-800 rounded-lg p-2 text-white text-[10px] focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-emerald-950 hover:bg-emerald-900 text-emerald-450 border border-emerald-900 font-bold py-2 rounded-xl text-xs transition"
                >
                  Approve & Activate Subscription
                </button>
              </form>
            )}

            <div className="flex space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setSelectedInvoice(null)}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-bold py-2 rounded-xl text-xs"
              >
                Close
              </button>
              {selectedInvoice.status !== 'PAID' && selectedInvoice.status !== 'CANCELLED' && (
                <button
                  type="button"
                  onClick={() => handleCancelInvoice(selectedInvoice.id)}
                  disabled={loading}
                  className="flex-1 bg-red-950 hover:bg-red-900 text-red-400 border border-red-900 font-bold py-2 rounded-xl text-xs transition disabled:opacity-50"
                >
                  Cancel Invoice
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Refund Request Modal */}
      {refundPaymentId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 z-50">
          <form onSubmit={handleIssueRefund} className="bg-gray-900 border border-red-900 rounded-2xl max-w-sm w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-red-400">Issue SaaS Refund</h3>
            <p className="text-xs text-gray-400">Process refund payment. This will update original payment records and flag canceled transitions.</p>
            
            <div className="space-y-1">
              <label className="text-xs text-gray-400 font-bold uppercase">Refund Amount (INR)</label>
              <input
                type="number"
                step="0.01"
                placeholder="Enter amount to refund..."
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                required
                className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-white text-xs focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-gray-400 font-bold uppercase">Reason for Refund</label>
              <input
                type="text"
                placeholder="e.g., Trial extension request, manual adjustment..."
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                required
                className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-white text-xs focus:outline-none"
              />
            </div>

            <div className="flex space-x-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setRefundPaymentId(null);
                  setRefundAmount('');
                  setRefundReason('');
                }}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-bold py-2 rounded-xl text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !refundAmount || !refundReason.trim()}
                className="flex-1 bg-red-950 text-red-400 border border-red-900 font-bold py-2 rounded-xl text-xs hover:bg-red-900 transition disabled:opacity-50"
              >
                Confirm Refund
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
