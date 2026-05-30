'use client';

import { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { reportsApi, downloadBlob } from '@/lib/api';
import { getMonthName, getCurrentMonth } from '@/lib/utils';
import { FileText, Download, FileSpreadsheet, Printer, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ReportsPage() {
  const now = getCurrentMonth();
  const [month, setMonth] = useState(now.month);
  const [year, setYear] = useState(now.year);
  const [loading, setLoading] = useState<string>('');

  const navigateMonth = (dir: number) => {
    const d = new Date(year, month - 1 + dir);
    setMonth(d.getMonth() + 1);
    setYear(d.getFullYear());
  };

  const downloadReport = async (type: string, format: string) => {
    setLoading(`${type}-${format}`);
    try {
      let res;
      let filename = '';

      if (type === 'attendance') {
        res = await reportsApi.attendance(month, year, format);
        filename = `attendance-${month}-${year}.${format}`;
      } else if (type === 'payroll') {
        res = await reportsApi.payrollSummary(month, year, format);
        filename = `payroll-${month}-${year}.${format}`;
      }

      if (res && filename) {
        downloadBlob(res.data as Blob, filename);
      }
    } finally {
      setLoading('');
    }
  };

  const reports = [
    {
      id: 'attendance',
      title: 'Attendance Report',
      description: 'Monthly attendance summary for all workers with present/absent/late stats',
      icon: FileText,
      color: 'text-blue-600 bg-blue-50',
    },
    {
      id: 'payroll',
      title: 'Payroll Summary',
      description: 'Complete payroll breakdown with salary calculations for all workers',
      icon: FileSpreadsheet,
      color: 'text-green-600 bg-green-50',
    },
  ];

  return (
    <AppShell>
      <div className="p-4 lg:p-6 space-y-5">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Reports</h2>
          <p className="text-sm text-gray-500">Generate and download reports</p>
        </div>

        {/* Month selector */}
        <div className="flex items-center justify-center gap-4 bg-white rounded-2xl border border-gray-100 p-3 w-fit">
          <button onClick={() => navigateMonth(-1)} className="p-2 hover:bg-gray-100 rounded-xl">
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <span className="font-semibold text-gray-900 w-40 text-center">
            {getMonthName(month)} {year}
          </span>
          <button onClick={() => navigateMonth(1)} className="p-2 hover:bg-gray-100 rounded-xl">
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Report cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {reports.map(report => (
            <div key={report.id} className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition-all">
              <div className="flex items-start gap-4 mb-4">
                <div className={`p-3 rounded-xl ${report.color}`}>
                  <report.icon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{report.title}</h3>
                  <p className="text-xs text-gray-500 mt-1">{report.description}</p>
                </div>
              </div>

              <p className="text-sm text-gray-600 font-medium mb-3">
                {getMonthName(month)} {year}
              </p>

              <div className="flex gap-2">
                <button
                  onClick={() => downloadReport(report.id, 'xlsx')}
                  disabled={!!loading}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-colors border',
                    'bg-green-50 text-green-700 border-green-200 hover:bg-green-100',
                    loading === `${report.id}-xlsx` && 'opacity-60'
                  )}
                >
                  {loading === `${report.id}-xlsx` ? (
                    <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
                  ) : <FileSpreadsheet className="w-4 h-4" />}
                  Excel
                </button>
                <button
                  onClick={() => downloadReport(report.id, 'pdf')}
                  disabled={!!loading}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-colors border',
                    'bg-red-50 text-red-700 border-red-200 hover:bg-red-100',
                    loading === `${report.id}-pdf` && 'opacity-60'
                  )}
                >
                  {loading === `${report.id}-pdf` ? (
                    <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
                  ) : <Download className="w-4 h-4" />}
                  PDF
                </button>
                <button
                  onClick={() => window.print()}
                  className="p-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  <Printer className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Info */}
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-sm text-blue-700">
          <p className="font-medium mb-1">📋 Report Features</p>
          <ul className="space-y-0.5 text-xs text-blue-600 list-disc list-inside">
            <li>Download as Excel (.xlsx) for editing and sharing</li>
            <li>Download as PDF for printing and archiving</li>
            <li>Individual salary slips available in worker profiles</li>
            <li>WhatsApp sharing coming soon</li>
          </ul>
        </div>
      </div>
    </AppShell>
  );
}
