'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { workersApi } from '@/lib/api';
import { ArrowLeft, Save, User, Zap, Timer } from 'lucide-react';
import Link from 'next/link';

export default function NewWorkerPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    address: '',
    joiningDate: new Date().toISOString().split('T')[0],
    category: 'DAILY_WAGE',
    dailyWage: '',
    monthlySalary: '',
    overtimeRate: '',
    lateChargeRate: '',
    lateChargeUnit: 'PER_MINUTE',
    notes: '',
  });
  const [photo, setPhoto] = useState<File | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => { if (v) fd.append(k, v); });
      if (photo) fd.append('profilePhoto', photo);

      await workersApi.create(fd);
      router.push('/workers');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e?.response?.data?.error || 'Failed to create worker');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell>
      <div className="p-4 lg:p-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/workers" className="p-2 hover:bg-gray-100 rounded-xl">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Add New Worker</h2>
            <p className="text-sm text-gray-500">Fill in worker details</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 mb-4 text-sm">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
            <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Basic Info</h3>

            {/* Photo */}
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center overflow-hidden">
                {photo ? (
                  <img src={URL.createObjectURL(photo)} alt="preview" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-7 h-7 text-gray-400" />
                )}
              </div>
              <label className="cursor-pointer px-4 py-2 border border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-primary hover:text-primary transition-colors">
                Upload Photo
                <input type="file" accept="image/*" className="hidden" onChange={e => setPhoto(e.target.files?.[0] || null)} />
              </label>
            </div>

            {[
              { label: 'Full Name *', key: 'fullName', type: 'text', placeholder: 'Rahul Kumar' },
              { label: 'Phone Number *', key: 'phone', type: 'tel', placeholder: '9876543210' },
              { label: 'Address', key: 'address', type: 'text', placeholder: 'Mumbai, Maharashtra' },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{f.label}</label>
                <input
                  type={f.type}
                  value={form[f.key as keyof typeof form]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  required={f.label.includes('*')}
                />
              </div>
            ))}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Joining Date *</label>
              <input
                type="date"
                value={form.joiningDate}
                onChange={e => setForm(p => ({ ...p, joiningDate: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                required
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
            <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Wage Details</h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Worker Category *</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: 'DAILY_WAGE', label: 'Daily Wage', sub: 'Paid per day worked' },
                  { value: 'MONTHLY_SALARY', label: 'Monthly Salary', sub: 'Fixed monthly pay' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setForm(p => ({ ...p, category: opt.value }))}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${
                      form.category === opt.value
                        ? 'border-primary bg-primary/5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <p className="font-medium text-sm text-gray-900">{opt.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{opt.sub}</p>
                  </button>
                ))}
              </div>
            </div>

            {form.category === 'DAILY_WAGE' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Daily Wage (₹) *</label>
                <input
                  type="number"
                  value={form.dailyWage}
                  onChange={e => setForm(p => ({ ...p, dailyWage: e.target.value }))}
                  placeholder="600"
                  min="0"
                  step="50"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  required
                />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Monthly Salary (₹) *</label>
                <input
                  type="number"
                  value={form.monthlySalary}
                  onChange={e => setForm(p => ({ ...p, monthlySalary: e.target.value }))}
                  placeholder="18000"
                  min="0"
                  step="500"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
              <textarea
                value={form.notes}
                onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                placeholder="Any additional notes..."
                rows={2}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
              />
            </div>
          </div>

          {/* Rates Section */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
            <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Rates & Charges</h3>
            <p className="text-xs text-gray-400 -mt-2">Optional — used in payroll calculations</p>

            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
                <Zap className="w-4 h-4 text-blue-500" />
                Overtime Rate (₹ per hour)
              </label>
              <input
                type="number"
                value={form.overtimeRate}
                onChange={e => setForm(p => ({ ...p, overtimeRate: e.target.value }))}
                placeholder="e.g. 100 (leave blank to auto-calculate)"
                min="0"
                step="10"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
              <p className="text-xs text-gray-400 mt-1">If blank, OT is auto-calculated at 1.5× hourly rate</p>
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
                <Timer className="w-4 h-4 text-amber-500" />
                Late Charge
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={form.lateChargeRate}
                  onChange={e => setForm(p => ({ ...p, lateChargeRate: e.target.value }))}
                  placeholder="e.g. 2"
                  min="0"
                  step="0.5"
                  className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
                <select
                  value={form.lateChargeUnit}
                  onChange={e => setForm(p => ({ ...p, lateChargeUnit: e.target.value }))}
                  className="px-3 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  <option value="PER_MINUTE">₹ / minute</option>
                  <option value="PER_HOUR">₹ / hour</option>
                </select>
              </div>
              <p className="text-xs text-gray-400 mt-1">Deducted from salary based on late duration marked in attendance</p>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-primary text-white py-3.5 rounded-xl font-semibold hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            {loading ? 'Saving...' : 'Save Worker'}
          </button>
        </form>
      </div>
    </AppShell>
  );
}
