'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { advancesApi, workersApi } from '@/lib/api';
import { formatCurrency, formatDate, today } from '@/lib/utils';
import { Plus, Wallet, CheckCircle, X, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Advance {
  id: string;
  amount: number;
  repaidAmount: number;
  purpose?: string;
  date: string;
  isFullyRepaid: boolean;
  worker: { id: string; fullName: string; phone: string };
}

interface Worker { id: string; fullName: string; phone: string; }

export default function AdvancesPage() {
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'repaid'>('pending');
  const [form, setForm] = useState({ workerId: '', amount: '', purpose: '', date: today() });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params: Record<string, string | boolean> = filter !== 'all' ? { isFullyRepaid: filter === 'repaid' ? 'true' : 'false' } : {};
      const [advRes, wRes] = await Promise.all([
        advancesApi.list(params),
        workersApi.list({ isActive: true, limit: 100 }),
      ]);
      setAdvances(advRes.data.data);
      setWorkers(wRes.data.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filter]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await advancesApi.create({ workerId: form.workerId, amount: parseFloat(form.amount), purpose: form.purpose, date: form.date });
      setShowModal(false);
      setForm({ workerId: '', amount: '', purpose: '', date: today() });
      load();
    } finally {
      setSaving(false);
    }
  };

  const totalPending = advances.filter(a => !a.isFullyRepaid).reduce(
    (s, a) => s + Number(a.amount) - Number(a.repaidAmount), 0
  );

  return (
    <AppShell>
      <div className="p-4 lg:p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Advances</h2>
            <p className="text-sm text-gray-500">Total pending: {formatCurrency(totalPending)}</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary/90"
          >
            <Plus className="w-4 h-4" /> Add Advance
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
          {(['pending', 'all', 'repaid'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize',
              filter === f ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
            )}>
              {f}
            </button>
          ))}
        </div>

        {/* Advances list */}
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        ) : advances.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <Wallet className="w-12 h-12 mx-auto text-gray-200 mb-3" />
            <p className="text-gray-400">No advances found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {advances.map(adv => (
              <div key={adv.id} className="bg-white rounded-2xl border border-gray-100 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
                      adv.isFullyRepaid ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-600'
                    )}>
                      {adv.isFullyRepaid ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{adv.worker.fullName}</p>
                      <p className="text-xs text-gray-400">{adv.worker.phone}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900">{formatCurrency(Number(adv.amount))}</p>
                    <p className="text-xs text-gray-400">{formatDate(adv.date)}</p>
                  </div>
                </div>

                {adv.purpose && (
                  <p className="text-xs text-gray-500 mt-2 ml-13">{adv.purpose}</p>
                )}

                <div className="mt-3 pt-3 border-t border-gray-50 flex items-center justify-between text-xs">
                  <div className="flex gap-3">
                    <span className="text-gray-500">Repaid: <span className="font-medium text-green-600">{formatCurrency(Number(adv.repaidAmount))}</span></span>
                    <span className="text-gray-500">Pending: <span className={cn('font-medium', adv.isFullyRepaid ? 'text-green-600' : 'text-orange-600')}>
                      {formatCurrency(Number(adv.amount) - Number(adv.repaidAmount))}
                    </span></span>
                  </div>
                  <span className={cn(
                    'px-2 py-0.5 rounded-full text-xs font-medium',
                    adv.isFullyRepaid ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'
                  )}>
                    {adv.isFullyRepaid ? 'Repaid' : 'Pending'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Advance Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">Add Advance Payment</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Worker *</label>
                <select
                  value={form.workerId}
                  onChange={e => setForm(p => ({ ...p, workerId: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  required
                >
                  <option value="">Select worker...</option>
                  {workers.map(w => <option key={w.id} value={w.id}>{w.fullName} — {w.phone}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Amount (₹) *</label>
                <input
                  type="number" min="1" step="100"
                  value={form.amount}
                  onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                  placeholder="5000"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Date *</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Purpose</label>
                <input
                  type="text"
                  value={form.purpose}
                  onChange={e => setForm(p => ({ ...p, purpose: e.target.value }))}
                  placeholder="Medical, personal, etc."
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="w-full py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Add Advance'}
              </button>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
