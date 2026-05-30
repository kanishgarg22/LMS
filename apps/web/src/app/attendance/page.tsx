'use client';

import { useEffect, useState, useCallback } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { attendanceApi, advancesApi, reportsApi, downloadBlob } from '@/lib/api';
import { today, formatShortDate } from '@/lib/utils';
import {
  Search, X, Save, Plus,
  Clock, Zap, RefreshCw, IndianRupee, AlertCircle, FileDown
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Brand colours ────────────────────────────────────────────────────────────
const C = {
  morning: '#6FCF97',
  evening: '#A2CB8B',
  late:    '#FF5656',
  ot:      '#FEE2AD',
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface Worker     { id: string; fullName: string; phone: string; category: string; }
interface AttRecord  { id: string; status: string; overtime: string; overtimeHours: number | null; lateMinutes: number | null; halfDaySession: string | null; }
interface RegisterRow { worker: Worker; attendance: Record<string, AttRecord | null>; }
interface WorkerModal { worker: Worker; current: AttRecord | null; date: string; }
interface ModalEdit  {
  morning: boolean;
  evening: boolean;
  lateMinutes: string;   // minutes as string, '0' = none
  otHours:     string;
  otMinutes:   string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtTime(totalMins: number): string {
  if (!totalMins || totalMins <= 0) return '';
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (h > 0 && m > 0) return `${h}h${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function fmtOT(hours: number): string {
  if (!hours || hours <= 0) return '';
  const h = Math.floor(hours);
  const m = Math.round((hours % 1) * 60);
  if (h > 0 && m > 0) return `${h}h${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function attToEdit(att: AttRecord): ModalEdit {
  const s   = att.status;
  const ot  = att.overtimeHours || 0;
  const ses = att.halfDaySession; // 'M' | 'E' | null

  // Derive which M/E buttons should be on:
  // PRESENT → both on; LATE → both on (full day, came late)
  // HALF_DAY:  ses='M' (or default) → morning only; ses='E' → evening only
  let morning = false, evening = false;
  if (s === 'PRESENT' || s === 'LATE') {
    morning = true; evening = true;
  } else if (s === 'HALF_DAY') {
    morning = ses !== 'E';   // morning on unless specifically 'E'
    evening = ses === 'E';
  }

  return {
    morning, evening,
    lateMinutes: String(att.lateMinutes ?? 0),
    otHours:     String(Math.floor(ot)),
    otMinutes:   String(Math.round((ot % 1) * 60)),
  };
}

const DEFAULT_EDIT: ModalEdit = {
  morning: false, evening: false,
  lateMinutes: '0', otHours: '0', otMinutes: '0',
};

// ─── Attendance cell — 4-column bordered mini-table ──────────────────────────
//  ┌──────┬──────┬───────┬──────────┐
//  │  M   │  P   │  OT   │  2h 5m   │
//  ├──────┼──────┼───────┼──────────┤
//  │  E   │      │  LT   │  1h 5m   │
//  └──────┴──────┴───────┴──────────┘

function AttCell({ att }: { att: AttRecord | null }) {
  const s   = att?.status ?? 'ABSENT';
  const ses = att?.halfDaySession ?? 'M'; // default to morning for HALF_DAY

  // Which sessions are active?
  // PRESENT / LATE → both M and E active
  // HALF_DAY → only the recorded session (ses) is active
  // ABSENT / null → neither
  const mOn = s !== 'ABSENT' && att != null && (s !== 'HALF_DAY' || ses !== 'E');
  const eOn = (s === 'PRESENT' || s === 'LATE') || (s === 'HALF_DAY' && ses === 'E');
  const lOn   = s === 'LATE';
  const oOn   = att?.overtime === 'OT';
  const otTxt = fmtOT(att?.overtimeHours ?? 0);
  const ltTxt = fmtTime(att?.lateMinutes ?? 0);

  const B = '1px solid #D1D5DB';   // normal border
  const BD = '2px solid #C0C0C0';  // divider between P and OT columns

  const box = (bg: string, fg: string, w: number, extra?: React.CSSProperties): React.CSSProperties => ({
    width: w, minWidth: w, flexShrink: 0,
    backgroundColor: bg, color: fg,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 700, fontSize: 13,
    ...extra,
  });

  return (
    <div style={{ border: B, borderRadius: 5, overflow: 'hidden', width: '100%' }}>
      {/* Morning row */}
      <div style={{ display: 'flex', alignItems: 'stretch', borderBottom: B }}>
        <div style={box(mOn ? C.morning : '#DCF5E8', mOn ? '#fff' : C.morning, 28, { borderRight: B, minHeight: 28 })}>M</div>
        <div style={box(mOn ? '#E8F8F0' : '#fff', mOn ? '#1a6b40' : '#ddd', 24, { borderRight: BD, fontSize: 11 })}>{mOn ? 'P' : ''}</div>
        <div style={box(oOn ? C.ot : '#FEF5E4', oOn ? '#78350F' : '#C9A84C', 30, { borderRight: B, fontSize: 11 })}>OT</div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', padding: '0 5px', fontSize: 12, fontWeight: 600, color: oOn ? '#78350F' : '#ccc' }}>{oOn ? otTxt : ''}</div>
      </div>
      {/* Evening row */}
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        <div style={box(eOn ? C.evening : '#EDF6E9', eOn ? '#fff' : C.evening, 28, { borderRight: B, minHeight: 28 })}>E</div>
        <div style={box(eOn ? '#E8F8F0' : '#fff', eOn ? '#1a6b40' : '#ddd', 24, { borderRight: BD, fontSize: 11 })}>{eOn ? 'P' : ''}</div>
        <div style={box(lOn ? C.late : '#FFF0F0', lOn ? '#fff' : '#FF9999', 30, { borderRight: B, fontSize: 11 })}>LT</div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', padding: '0 5px', fontSize: 12, fontWeight: 600, color: lOn ? C.late : '#ccc' }}>{lOn ? ltTxt : ''}</div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function AttendancePage() {
  const [regDays, setRegDays] = useState(5);
  const [regRows, setRegRows] = useState<RegisterRow[]>([]);
  const [regDates, setRegDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modal
  const [modal, setModal] = useState<WorkerModal | null>(null);
  const [edit, setEdit] = useState<ModalEdit>(DEFAULT_EDIT);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [pageError, setPageError] = useState('');

  // PDF report modal
  const [reportWorker, setReportWorker] = useState<Worker | null>(null);
  const [reportFrom, setReportFrom] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]; });
  const [reportTo,   setReportTo]   = useState(today);
  const [downloading, setDownloading] = useState(false);
  const [reportError, setReportError] = useState('');

  const downloadReport = async () => {
    if (!reportWorker) return;
    setDownloading(true);
    setReportError('');
    try {
      const res = await reportsApi.workerAttendance(reportWorker.id, reportFrom, reportTo, 'pdf');
      downloadBlob(res.data as Blob, `attendance-${reportWorker.fullName.replace(/\s+/g, '-')}-${reportFrom}-to-${reportTo}.pdf`);
      setReportWorker(null);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setReportError(e?.response?.data?.error || e?.message || 'Failed to generate PDF — please retry');
    } finally { setDownloading(false); }
  };

  // Payment form (was "Advance")
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(today());
  const [payPurpose, setPayPurpose] = useState('');
  const [addingPay, setAddingPay] = useState(false);
  const [paySuccess, setPaySuccess] = useState(false);
  const [payError, setPayError] = useState('');

  // ── Load ──
  const loadRegister = useCallback(async () => {
    setLoading(true);
    setPageError('');
    try {
      const res = await attendanceApi.register({ days: regDays });
      setRegDates(res.data.data.dates);
      setRegRows(res.data.data.rows);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setPageError(e?.response?.data?.error || e?.message || 'Failed to load attendance data');
    } finally {
      setLoading(false);
    }
  }, [regDays]);

  useEffect(() => { loadRegister(); }, [loadRegister]);

  // ── Modal ──
  const openModal = (worker: Worker, att: AttRecord | null, d: string) => {
    setModal({ worker, current: att, date: d });
    setPayAmount(''); setPayDate(d); setPayPurpose('');
    setPaySuccess(false); setSaveError(''); setPayError('');
    setEdit(att ? attToEdit(att) : DEFAULT_EDIT);
  };

  // Status derived from M/E + lateMinutes (no separate toggle needed)
  const computeStatus = (e: ModalEdit): string => {
    if (!e.morning && !e.evening) return 'ABSENT';
    const lateMins = parseInt(e.lateMinutes) || 0;
    if (lateMins > 0) return 'LATE';
    if (e.morning && e.evening) return 'PRESENT';
    return 'HALF_DAY';
  };

  // ── Save ──
  const saveAttendance = async () => {
    if (!modal) return;
    const workerId = modal.worker.id;
    const dateStr  = modal.date;

    setSaving(true); setSaveError('');
    try {
      const status      = computeStatus(edit);
      const lateMins    = parseInt(edit.lateMinutes) || 0;
      const otDecimal   = (parseInt(edit.otHours) || 0) + (parseInt(edit.otMinutes) || 0) / 60;
      const overtimeStr = otDecimal > 0 ? 'OT' : 'NONE';

      // Determine which half for HALF_DAY records
      const halfDaySession: string | undefined =
        status === 'HALF_DAY' ? (edit.morning ? 'M' : 'E') : undefined;

      const res = await attendanceApi.mark({
        workerId, date: dateStr, status, overtime: overtimeStr,
        overtimeHours:  otDecimal > 0 ? otDecimal : undefined,
        lateMinutes:    lateMins  > 0 ? lateMins  : undefined,
        halfDaySession,
      });

      // Use real server data so id + values are always accurate
      const srv = res.data.data;
      const saved: AttRecord = {
        id:             srv.id,
        status:         srv.status,
        overtime:       srv.overtime,
        overtimeHours:  srv.overtimeHours  != null ? Number(srv.overtimeHours)  : null,
        lateMinutes:    srv.lateMinutes    != null ? Number(srv.lateMinutes)    : null,
        halfDaySession: srv.halfDaySession ?? null,
      };

      setRegRows(prev =>
        prev.map(r => r.worker.id !== workerId ? r
          : { ...r, attendance: { ...r.attendance, [dateStr]: saved } }
        )
      );
      setModal(null);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setSaveError(e?.response?.data?.error || e?.message || 'Save failed — please try again');
    } finally {
      setSaving(false);
    }
  };

  // ── Add payment (was advance) ──
  const addPayment = async () => {
    if (!modal || !payAmount) return;
    setAddingPay(true);
    setPayError('');
    try {
      await advancesApi.create({
        workerId: modal.worker.id,
        amount:   parseFloat(payAmount),
        purpose:  payPurpose || undefined,
        date:     payDate,
      });
      setPayAmount(''); setPayPurpose('');
      setPaySuccess(true);
      setTimeout(() => setPaySuccess(false), 3000);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setPayError(e?.response?.data?.error || e?.message || 'Failed to add payment');
    } finally { setAddingPay(false); }
  };

  const filtered = regRows.filter(r =>
    r.worker.fullName.toLowerCase().includes(search.toLowerCase())
  );

  // Preview for modal
  const lateMinsNum = parseInt(edit.lateMinutes) || 0;
  const otDecimalNum = (parseInt(edit.otHours) || 0) + (parseInt(edit.otMinutes) || 0) / 60;
  const statusPreview = (() => {
    if (!edit.morning && !edit.evening)
      return { text: 'Absent', bg: '#FFF0F0', color: C.late };
    if (lateMinsNum > 0)
      return { text: `Late — ${fmtTime(lateMinsNum)}`, bg: '#FFF0F0', color: C.late };
    if (edit.morning && edit.evening)
      return { text: otDecimalNum > 0 ? `Present + OT ${fmtOT(otDecimalNum)}` : 'Present — Full Day ✓', bg: '#F0FFF4', color: '#166534' };
    return { text: 'Half Day', bg: '#F5F3FF', color: '#6D28D9' };
  })();

  return (
    <AppShell>
      <div className="p-4 lg:p-6 max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Attendance</h2>
            <p className="text-xs text-gray-400 mt-0.5">{regRows.length} workers</p>
          </div>
          <button onClick={loadRegister} className="p-2 text-gray-400 hover:bg-gray-100 rounded-xl">
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </button>
        </div>

        {/* Page-level error */}
        {pageError && (
          <div className="flex items-center justify-between gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-3">
            <div className="flex items-center gap-2 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {pageError}
            </div>
            <button onClick={loadRegister} className="text-xs font-medium hover:underline flex-shrink-0 flex items-center gap-1">
              <RefreshCw className="w-3 h-3" /> Retry
            </button>
          </div>
        )}

        {/* Search + range */}
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search worker…"
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
            {[3, 5, 7, 10].map(d => (
              <button key={d} onClick={() => setRegDays(d)}
                className={cn('px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                  regDays === d ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700')}>
                {d}d
              </button>
            ))}
          </div>
        </div>

        {/* Colour key */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 bg-gray-50 rounded-xl px-3 py-2 mb-4">
          {[
            { hex: C.morning, label: 'M — Morning' },
            { hex: C.evening, label: 'E — Evening' },
            { hex: C.late,    label: 'LT — Late' },
            { hex: C.ot,      label: 'OT — Overtime' },
          ].map(({ hex, label }) => (
            <span key={label} className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-sm flex-shrink-0" style={{ backgroundColor: hex }} />
              {label}
            </span>
          ))}
        </div>

        {/* Register grid */}
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        ) : (
          <div className="bg-white rounded-2xl border-2 border-gray-300 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #9CA3AF', backgroundColor: '#F3F4F6' }}>
                    <th className="text-left px-4 py-3 text-sm font-bold text-gray-700 sticky left-0 min-w-[160px]"
                      style={{ borderRight: '2px solid #9CA3AF', backgroundColor: '#F3F4F6' }}>
                      Worker
                    </th>
                    {regDates.map(d => (
                      <th key={d} className="px-2 py-2 text-center min-w-[120px]"
                        style={{ borderRight: '1px solid #D1D5DB' }}>
                        <div className="text-sm font-bold text-gray-700">
                          {new Date(d + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'short' })}
                        </div>
                        <div className={cn(
                          'text-sm font-bold mt-0.5 px-2 py-0.5 rounded-full inline-block',
                          d === today() ? 'bg-primary text-white' : 'text-gray-600'
                        )}>
                          {formatShortDate(d)}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row, idx) => (
                    <tr key={row.worker.id}
                      style={{ borderBottom: '1px solid #D1D5DB', backgroundColor: idx % 2 === 0 ? '#fff' : '#F9FAFB' }}>
                      <td className="px-4 py-3 sticky left-0"
                        style={{ borderRight: '2px solid #9CA3AF', backgroundColor: idx % 2 === 0 ? '#fff' : '#F9FAFB' }}>
                        <div className="flex items-center justify-between gap-1">
                          <div>
                            <p className="text-sm font-bold text-gray-900 leading-tight">{row.worker.fullName}</p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {row.worker.category === 'DAILY_WAGE' ? 'Daily' : 'Monthly'}
                            </p>
                          </div>
                          <button
                            onClick={() => { setReportWorker(row.worker); setReportError(''); }}
                            title="Download attendance report"
                            className="p-1 text-gray-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors flex-shrink-0"
                          >
                            <FileDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                      {regDates.map(d => {
                        const att = row.attendance[d] ?? null;
                        return (
                          <td key={d} className="px-2 py-1"
                            style={{ borderRight: '1px solid #D1D5DB' }}>
                            <button
                              onClick={() => openModal(row.worker, att, d)}
                              className="w-full rounded-lg px-2 py-1 text-left transition-all hover:bg-blue-50 active:scale-95"
                            >
                              <AttCell att={att} />
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ════════════ MODAL ════════════ */}
      {modal && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm" onClick={() => !saving && setModal(null)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl max-h-[92vh] overflow-y-auto
                          lg:inset-auto lg:top-1/2 lg:left-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2
                          lg:w-[440px] lg:rounded-2xl lg:max-h-[85vh]">

            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1 lg:hidden">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>

            <div className="px-5 pb-8 pt-4">

              {/* Worker header */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center text-primary font-bold text-xl flex-shrink-0">
                    {modal.worker.fullName[0].toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-base leading-tight">{modal.worker.fullName}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(modal.date + 'T12:00:00').toLocaleDateString('en-IN', {
                        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
                      })}
                    </p>
                  </div>
                </div>
                <button onClick={() => !saving && setModal(null)} className="p-2 hover:bg-gray-100 rounded-xl">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Section label */}
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Mark Attendance</p>

              {/* M / E big buttons */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                <button onClick={() => setEdit(e => ({ ...e, morning: !e.morning }))}
                  className="py-5 rounded-2xl border-2 transition-all select-none"
                  style={{
                    backgroundColor: edit.morning ? C.morning : '#F9FAFB',
                    borderColor:     edit.morning ? '#4CAF7D' : '#E5E7EB',
                    color:           edit.morning ? '#fff'    : '#9CA3AF',
                    boxShadow:       edit.morning ? `0 4px 14px ${C.morning}60` : 'none',
                  }}>
                  <div className="text-3xl mb-1">🌅</div>
                  <div className="text-sm font-semibold">Morning</div>
                  <div className="text-2xl font-black mt-0.5">M</div>
                </button>
                <button onClick={() => setEdit(e => ({ ...e, evening: !e.evening }))}
                  className="py-5 rounded-2xl border-2 transition-all select-none"
                  style={{
                    backgroundColor: edit.evening ? C.evening : '#F9FAFB',
                    borderColor:     edit.evening ? '#7BAF6A' : '#E5E7EB',
                    color:           edit.evening ? '#fff'    : '#9CA3AF',
                    boxShadow:       edit.evening ? `0 4px 14px ${C.evening}60` : 'none',
                  }}>
                  <div className="text-3xl mb-1">🌆</div>
                  <div className="text-sm font-semibold">Evening</div>
                  <div className="text-2xl font-black mt-0.5">E</div>
                </button>
              </div>

              {/* Live status */}
              <div className="text-center text-sm font-semibold py-2.5 px-4 rounded-xl mb-5 transition-all"
                style={{ backgroundColor: statusPreview.bg, color: statusPreview.color }}>
                → {statusPreview.text}
              </div>

              {/* ── Late minutes (always visible, no toggle) ── */}
              <div className="flex items-center justify-between p-3.5 rounded-xl mb-2 border"
                style={{ backgroundColor: '#FFF5F5', borderColor: '#FFCDD2' }}>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" style={{ color: C.late }} />
                  <div>
                    <p className="text-sm font-semibold" style={{ color: C.late }}>Late</p>
                    <p className="text-[11px] text-gray-400">Enter 0 if not late</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number" min="0" max="480"
                    value={edit.lateMinutes}
                    onChange={e => setEdit(p => ({ ...p, lateMinutes: e.target.value }))}
                    className="w-20 px-3 py-2 border rounded-xl text-sm text-center font-bold focus:outline-none bg-white"
                    style={{ borderColor: '#FFCDD2', color: C.late }}
                  />
                  <span className="text-sm font-medium" style={{ color: C.late }}>min</span>
                </div>
              </div>

              {/* ── Overtime (always visible, no toggle) ── */}
              <div className="flex items-center justify-between p-3.5 rounded-xl mb-5 border"
                style={{ backgroundColor: '#FFFBF0', borderColor: '#FDE68A' }}>
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-600" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800">Overtime</p>
                    <p className="text-[11px] text-gray-400">Enter 0 if none</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number" min="0" max="12"
                    value={edit.otHours}
                    onChange={e => setEdit(p => ({ ...p, otHours: e.target.value }))}
                    className="w-14 px-2 py-2 border border-amber-200 rounded-xl text-sm text-center font-bold focus:outline-none bg-white text-amber-800"
                  />
                  <span className="text-sm font-medium text-amber-700">h</span>
                  <input
                    type="number" min="0" max="59"
                    value={edit.otMinutes}
                    onChange={e => setEdit(p => ({ ...p, otMinutes: e.target.value }))}
                    className="w-14 px-2 py-2 border border-amber-200 rounded-xl text-sm text-center font-bold focus:outline-none bg-white text-amber-800"
                  />
                  <span className="text-sm font-medium text-amber-700">m</span>
                </div>
              </div>

              {/* Error */}
              {saveError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2.5 mb-3 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {saveError}
                </div>
              )}

              {/* Save */}
              <button onClick={saveAttendance} disabled={saving}
                className="w-full flex items-center justify-center gap-2 bg-primary text-white py-4 rounded-2xl font-bold text-sm mb-6 hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-60 shadow-lg shadow-primary/20">
                <Save className="w-4 h-4" />
                {saving ? 'Saving…' : 'Save Attendance'}
              </button>

              {/* ── Payment Given (was Advance) ── */}
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px bg-gray-100" />
                <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">Payment Given</span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>

              <div className="flex items-center gap-2 mb-3">
                <IndianRupee className="w-4 h-4 text-orange-500" />
                <p className="text-sm font-semibold text-gray-700">Add Payment Given to Worker</p>
              </div>

              {paySuccess && (
                <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl p-3 mb-3 text-sm font-medium">
                  ✓ Payment recorded successfully!
                </div>
              )}
              {payError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2.5 mb-3 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {payError}
                </div>
              )}

              <div className="space-y-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block font-medium">Amount (₹) *</label>
                    <input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)}
                      placeholder="e.g. 500" min="0"
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-200" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block font-medium">Date *</label>
                    <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-200" />
                  </div>
                </div>
                <input type="text" value={payPurpose} onChange={e => setPayPurpose(e.target.value)}
                  placeholder="Reason (optional)"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-200" />
                <button onClick={addPayment} disabled={!payAmount || addingPay}
                  className="w-full flex items-center justify-center gap-2 bg-orange-500 text-white py-3.5 rounded-xl font-bold text-sm hover:bg-orange-600 active:scale-[0.98] transition-all disabled:opacity-50">
                  <Plus className="w-4 h-4" />
                  {addingPay ? 'Adding…' : 'Add Payment'}
                </button>
              </div>

            </div>
          </div>
        </>
      )}

      {/* ════════════ PDF REPORT MODAL ════════════ */}
      {reportWorker && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm" onClick={() => !downloading && setReportWorker(null)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl
                          lg:inset-auto lg:top-1/2 lg:left-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2
                          lg:w-[380px] lg:rounded-2xl">
            <div className="flex justify-center pt-3 pb-1 lg:hidden">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>
            <div className="px-5 py-5">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-gray-900 text-base">Download Attendance Report</h3>
                  <p className="text-xs text-gray-400 mt-0.5">{reportWorker.fullName}</p>
                </div>
                <button onClick={() => setReportWorker(null)} className="p-2 hover:bg-gray-100 rounded-xl">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Date range */}
              <div className="grid grid-cols-2 gap-3 mb-5">
                <div>
                  <label className="text-xs text-gray-500 font-medium block mb-1">From</label>
                  <input type="date" value={reportFrom} onChange={e => setReportFrom(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium block mb-1">To</label>
                  <input type="date" value={reportTo} onChange={e => setReportTo(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
              </div>

              {/* Quick range presets */}
              <div className="flex gap-2 mb-5 flex-wrap">
                {[
                  { label: 'This month', from: () => { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]; }, to: today },
                  { label: 'Last 30d',   from: () => { const d = new Date(); d.setDate(d.getDate()-29); return d.toISOString().split('T')[0]; }, to: today },
                  { label: 'Last 90d',   from: () => { const d = new Date(); d.setDate(d.getDate()-89); return d.toISOString().split('T')[0]; }, to: today },
                ].map(preset => (
                  <button key={preset.label}
                    onClick={() => { setReportFrom(preset.from()); setReportTo(preset.to()); }}
                    className="px-3 py-1.5 text-xs font-medium bg-gray-100 hover:bg-primary/10 hover:text-primary rounded-lg transition-colors">
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Error */}
              {reportError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2.5 mb-3 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {reportError}
                </div>
              )}

              {/* Download button */}
              <button onClick={downloadReport} disabled={downloading || !reportFrom || !reportTo}
                className="w-full flex items-center justify-center gap-2 bg-primary text-white py-3.5 rounded-xl font-bold text-sm hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-60 shadow-lg shadow-primary/20">
                <FileDown className="w-4 h-4" />
                {downloading ? 'Generating PDF…' : 'Download PDF'}
              </button>
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}
