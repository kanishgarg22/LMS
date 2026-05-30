'use client';

import { useEffect, useState, useCallback } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { workersApi } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import Link from 'next/link';
import {
  Search, Plus, User, Phone, Calendar,
  Badge, Pencil, IndianRupee
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Worker {
  id: string;
  fullName: string;
  phone: string;
  address?: string;
  joiningDate: string;
  category: string;
  dailyWage?: number;
  monthlySalary?: number;
  profilePhoto?: string;
  isActive: boolean;
}

export default function WorkersPage() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number | boolean> = {};
      if (search) params.search = search;
      if (categoryFilter) params.category = categoryFilter;
      if (activeFilter !== '') params.isActive = activeFilter === 'true';

      const res = await workersApi.list(params);
      setWorkers(res.data.data);
      setTotal(res.data.total);
    } catch {
      // silently keep previous state on error
    } finally {
      setLoading(false);
    }
  }, [search, categoryFilter, activeFilter]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <AppShell>
      <div className="p-4 lg:p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Workers</h2>
            <p className="text-sm text-gray-500">{total} total workers</p>
          </div>
          <Link
            href="/workers/new"
            className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Worker</span>
          </Link>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or phone..."
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-gray-700 bg-white"
          >
            <option value="">All Categories</option>
            <option value="DAILY_WAGE">Daily Wage</option>
            <option value="MONTHLY_SALARY">Monthly Salary</option>
          </select>

          <select
            value={activeFilter}
            onChange={e => setActiveFilter(e.target.value)}
            className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-gray-700 bg-white"
          >
            <option value="">All Status</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>

        {/* Workers grid */}
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        ) : workers.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <User className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No workers found</p>
            <Link href="/workers/new" className="text-primary text-sm mt-2 inline-block hover:underline">
              Add your first worker
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {workers.map(worker => (
              <div key={worker.id} className="bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-md transition-all">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center text-primary font-bold text-lg flex-shrink-0">
                    {worker.fullName[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <h3 className="font-semibold text-gray-900 text-sm leading-tight">{worker.fullName}</h3>
                      <span className={cn(
                        'text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ml-1',
                        worker.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                      )}>
                        {worker.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 mt-1 text-gray-500">
                      <Phone className="w-3 h-3" />
                      <span className="text-xs">{worker.phone}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-gray-50 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1 text-gray-500">
                      <Badge className="w-3 h-3" />
                      {worker.category === 'DAILY_WAGE' ? 'Daily Wage' : 'Monthly Salary'}
                    </span>
                    <span className="flex items-center gap-0.5 font-semibold text-gray-800">
                      <IndianRupee className="w-3 h-3" />
                      {worker.category === 'DAILY_WAGE'
                        ? `${(worker.dailyWage || 0).toLocaleString('en-IN')}/day`
                        : `${(worker.monthlySalary || 0).toLocaleString('en-IN')}/mo`
                      }
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Calendar className="w-3 h-3" />
                    <span>Joined {formatDate(worker.joiningDate)}</span>
                  </div>
                </div>

                <div className="mt-3 flex gap-2">
                  <Link
                    href={`/workers/${worker.id}`}
                    className="flex-1 text-center text-xs font-medium py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-xl transition-colors"
                  >
                    View Account
                  </Link>
                  <Link
                    href={`/workers/${worker.id}/edit`}
                    className="flex items-center justify-center w-9 h-9 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
