'use client';

import { useState, useMemo } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useStore } from '@/lib/store';
import { formatCurrency, formatDate, today } from '@/lib/utils';
import { Plus, Wallet, X, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AdvancesPage() {
  const workers = useStore(s => s.workers);
  const advances = useStore(s => s.advances);
  const addAdvance = useStore(s => s.addAdvance);
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'repaid'>('pending');
  const [form, setForm] = useState({ workerId: '', amount: '', purpose: '', date: today() });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const filtered = useMemo(() => {
    return advances
      .filter(a => {
        if (filter === 'pending') return !a.isFullyRepaid;
        if (filter === 'repaid') return a.isFullyRepaid;
        return true;
      })
      .map(a => {
        const worker = workers.find(w => w.id === a.workerId);
        return { ...a, worker: worker ? { id: worker.id, fullName: worker.fullName, phone: worker.phone } : null };
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [advances, workers, filter]);

  const totalPending = useMemo(() =>
    advances.filter(a => !a.isFullyRepaid).reduce((s, a) => s + a.amount - a.repaidAmount, 0),
    [advances]
  );

  const activeWorkers = useMemo(() => workers.filter(w => w.isActive).sort((a, b) => a.fullName.localeCompare(b.fullName)), [workers]);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.workerId || !form.amount || !form.date) {
      setError('Worker, amount and date are required');
      return;
    }
    setSaving(true);
    addAdvance({ workerId: form.workerId, amount: parseFloat(form.amount), purpose: form.purpose || undefined, date: form.date });
    setShowModal(false);
    setForm({ workerId: '', amount: '', purpose: '', date: today() });
    setError('');
    setSaving(false);
  };

  return (
    <AppShell>
      <div className="p-4 lg:p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Advances</h2>
            <p className="text-sm text-gray-500">Total pending: {formatCurrency(totalPending)}</p>
          </div>
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary/90">
            <Plus className="w-4 h-4" /> Add Advance
          </button>
        </div>

        <div className="flex gap-2">
          {(['all', 'pending', 'repaid'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={cn('px-4 py-2 rounded-xl text-sm font-medium transition-all capitalize',
                filter === f ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
              {f}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Wallet className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>No advances found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(a => (
              <div key={a.id} className="bg-white rounded-2xl border border-gray-100 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">{a.worker?.fullName || 'Unknown'}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{a.worker?.phone}</p>
                    {a.purpose && <p className="text-sm text-gray-500 mt-1">{a.purpose}</p>}
                    <p className="text-xs text-gray-400 mt-1">{formatDate(a.date)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-gray-900">{formatCurrency(a.amount)}</p>
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium',
                      a.isFullyRepaid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}>
                      {a.isFullyRepaid ? 'Repaid' : 'Pending'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setShowModal(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl lg:inset-auto lg:top-1/2 lg:left-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2 lg:w-[420px] lg:rounded-2xl">
            <div className="px-5 py-5">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-gray-900 text-base">Add Advance</h3>
                <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-xl"><X className="w-5 h-5 text-gray-500" /></button>
              </div>

              {error && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2.5 mb-3 text-sm">
                  <AlertCircle className="w-4 h-4" />{error}
                </div>
              )}

              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1.5">Worker *</label>
                  <select value={form.workerId} onChange={e => setForm(p => ({ ...p, workerId: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20" required>
                    <option value="">Select worker...</option>
                    {activeWorkers.map(w => <option key={w.id} value={w.id}>{w.fullName}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1.5">Amount (₹) *</label>
                    <input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                      placeholder="500" min="0"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" required />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1.5">Date *</label>
                    <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" required />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1.5">Purpose (optional)</label>
                  <input type="text" value={form.purpose} onChange={e => setForm(p => ({ ...p, purpose: e.target.value }))}
                    placeholder="Reason..."
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <button type="submit" disabled={saving}
                  className="w-full flex items-center justify-center gap-2 bg-primary text-white py-3.5 rounded-xl font-semibold hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-60">
                  <Plus className="w-4 h-4" />{saving ? 'Saving...' : 'Add Advance'}
                </button>
              </form>
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}
