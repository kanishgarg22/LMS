'use client';

import { useState, useMemo } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useStore } from '@/lib/store';
import { formatCurrency, formatDate } from '@/lib/utils';
import Link from 'next/link';
import { Search, Plus, User, Phone, Calendar, Pencil, IndianRupee } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function WorkersPage() {
  const workers = useStore(s => s.workers);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('');

  const filtered = useMemo(() => {
    return workers
      .filter(w => {
        if (search && !w.fullName.toLowerCase().includes(search.toLowerCase()) && !w.phone.includes(search)) return false;
        if (categoryFilter && w.category !== categoryFilter) return false;
        if (activeFilter !== '' && String(w.isActive) !== activeFilter) return false;
        return true;
      })
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [workers, search, categoryFilter, activeFilter]);

  return (
    <AppShell>
      <div className="p-4 lg:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Workers</h2>
            <p className="text-sm text-gray-500">{filtered.length} workers</p>
          </div>
          <Link
            href="/workers/new"
            className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Worker</span>
          </Link>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or phone..."
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">All Types</option>
            <option value="DAILY_WAGE">Daily Wage</option>
            <option value="MONTHLY_SALARY">Monthly Salary</option>
          </select>
          <select
            value={activeFilter}
            onChange={e => setActiveFilter(e.target.value)}
            className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">All Status</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <User className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No workers found</p>
            <p className="text-sm mt-1">Add your first worker to get started</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map(w => (
              <Link
                key={w.id}
                href={`/workers/detail?id=${w.id}`}
                className="bg-white rounded-2xl border border-gray-100 p-4 hover:border-primary/30 hover:shadow-sm transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center text-primary font-bold text-lg flex-shrink-0">
                    {w.fullName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-gray-900 truncate">{w.fullName}</p>
                      <span className={cn(
                        'text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0',
                        w.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      )}>
                        {w.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 text-xs text-gray-500">
                      <Phone className="w-3 h-3" />{w.phone}
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                        {w.category === 'DAILY_WAGE' ? 'Daily Wage' : 'Monthly'}
                      </span>
                      <span className="text-xs font-semibold text-gray-700 flex items-center gap-0.5">
                        <IndianRupee className="w-3 h-3" />
                        {w.category === 'DAILY_WAGE'
                          ? formatCurrency(w.dailyWage || 0) + '/day'
                          : formatCurrency(w.monthlySalary || 0) + '/mo'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1.5 text-xs text-gray-400">
                      <Calendar className="w-3 h-3" />
                      Joined {formatDate(w.joiningDate)}
                    </div>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-50 flex justify-end">
                  <span className="flex items-center gap-1 text-xs text-gray-400 hover:text-primary transition-colors">
                    <Pencil className="w-3 h-3" /> Edit
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
