'use client';

import { useMemo, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useStore, AttRecord } from '@/lib/store';
import { today, formatShortDate } from '@/lib/utils';
import { Search, X, Save, Plus, Clock, Zap, IndianRupee, AlertCircle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

const C = { morning: '#6FCF97', evening: '#A2CB8B', late: '#FF5656', ot: '#FEE2AD' };

interface Worker { id: string; fullName: string; phone: string; category: string; }
interface WorkerModal { worker: Worker; current: AttRecord | null; date: string; }
interface ModalEdit { morning: boolean; evening: boolean; lateMinutes: string; otHours: string; otMinutes: string; }

function fmtTime(m: number) { if (!m || m <= 0) return ''; const h = Math.floor(m/60), r = m%60; return h > 0 && r > 0 ? `${h}h${r}m` : h > 0 ? `${h}h` : `${r}m`; }
function fmtOT(h: number) { if (!h || h <= 0) return ''; const hh = Math.floor(h), m = Math.round((h%1)*60); return hh > 0 && m > 0 ? `${hh}h${m}m` : hh > 0 ? `${hh}h` : `${m}m`; }

function attToEdit(att: AttRecord): ModalEdit {
  const s = att.status, ot = att.overtimeHours || 0, ses = att.halfDaySession;
  let morning = false, evening = false;
  if (s === 'PRESENT' || s === 'LATE') { morning = true; evening = true; }
  else if (s === 'HALF_DAY') { morning = ses !== 'E'; evening = ses === 'E'; }
  return { morning, evening, lateMinutes: String(att.lateMinutes ?? 0), otHours: String(Math.floor(ot)), otMinutes: String(Math.round((ot % 1) * 60)) };
}

const DEFAULT_EDIT: ModalEdit = { morning: false, evening: false, lateMinutes: '0', otHours: '0', otMinutes: '0' };

function AttCell({ att }: { att: AttRecord | null }) {
  if (!att) return <div className="h-10 flex items-center justify-center text-gray-200 text-xs">—</div>;
  const s = att.status;
  const lm = att.lateMinutes, ot = att.overtimeHours;
  return (
    <div className="h-10 flex items-center gap-1 py-1">
      {(s === 'PRESENT' || s === 'LATE') && <>
        <span className="w-5 h-full rounded text-[10px] font-bold flex items-center justify-center text-white" style={{ background: C.morning }}>M</span>
        <span className="w-5 h-full rounded text-[10px] font-bold flex items-center justify-center text-white" style={{ background: C.evening }}>E</span>
      </>}
      {s === 'HALF_DAY' && <>
        {att.halfDaySession !== 'E' && <span className="w-5 h-full rounded text-[10px] font-bold flex items-center justify-center text-white" style={{ background: C.morning }}>M</span>}
        {att.halfDaySession === 'E' && <span className="w-5 h-full rounded text-[10px] font-bold flex items-center justify-center text-white" style={{ background: C.evening }}>E</span>}
      </>}
      {s === 'ABSENT' && <span className="w-10 h-full rounded text-[10px] font-bold flex items-center justify-center bg-red-100 text-red-600">ABS</span>}
      <div className="flex flex-col gap-0.5">
        {(lm ?? 0) > 0 && <span className="text-[9px] font-bold rounded px-1" style={{ background: C.late, color: '#fff' }}>LT{fmtTime(lm!)}</span>}
        {(ot ?? 0) > 0 && <span className="text-[9px] font-bold rounded px-1" style={{ background: C.ot, color: '#92400E' }}>OT{fmtOT(ot!)}</span>}
      </div>
    </div>
  );
}

export default function AttendancePage() {
  const workers = useStore(s => s.workers);
  const attendance = useStore(s => s.attendance);
  const markAttendance = useStore(s => s.markAttendance);
  const addAdvance = useStore(s => s.addAdvance);

  const [regDays, setRegDays] = useState(5);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<WorkerModal | null>(null);
  const [edit, setEdit] = useState<ModalEdit>(DEFAULT_EDIT);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payPurpose, setPayPurpose] = useState('');
  const [payDate, setPayDate] = useState(today());
  const [paySuccess, setPaySuccess] = useState(false);
  const [payError, setPayError] = useState('');
  const [addingPay, setAddingPay] = useState(false);

  const regDates = useMemo(() => {
    const dates: string[] = [];
    for (let i = regDays - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      dates.push(d.toISOString().split('T')[0]);
    }
    return dates;
  }, [regDays]);

  const activeWorkers = useMemo(() =>
    workers.filter(w => w.isActive).sort((a, b) => a.fullName.localeCompare(b.fullName)),
    [workers]
  );

  const regRows = useMemo(() => {
    return activeWorkers.map(worker => {
      const attMap: Record<string, AttRecord | null> = {};
      for (const date of regDates) {
        attMap[date] = attendance.find(a => a.workerId === worker.id && a.date === date) ?? null;
      }
      return { worker, attendance: attMap };
    });
  }, [activeWorkers, attendance, regDates]);

  const filtered = regRows.filter(r => r.worker.fullName.toLowerCase().includes(search.toLowerCase()));

  const openModal = (worker: Worker, att: AttRecord | null, date: string) => {
    setModal({ worker, current: att, date });
    setPaySuccess(false); setSaveError(''); setPayError('');
    setEdit(att ? attToEdit(att) : DEFAULT_EDIT);
  };

  const computeStatus = (e: ModalEdit) => {
    if (!e.morning && !e.evening) return 'ABSENT';
    if (parseInt(e.lateMinutes) > 0) return 'LATE';
    if (e.morning && e.evening) return 'PRESENT';
    return 'HALF_DAY';
  };

  const saveAttendance = () => {
    if (!modal) return;
    setSaving(true); setSaveError('');
    try {
      const status = computeStatus(edit);
      const lateMins = parseInt(edit.lateMinutes) || 0;
      const otDecimal = (parseInt(edit.otHours) || 0) + (parseInt(edit.otMinutes) || 0) / 60;
      markAttendance({
        workerId: modal.worker.id,
        date: modal.date,
        status: status as AttRecord['status'],
        overtime: otDecimal > 0 ? 'OT' : 'NONE',
        overtimeHours: otDecimal > 0 ? otDecimal : null,
        lateMinutes: lateMins > 0 ? lateMins : null,
        halfDaySession: status === 'HALF_DAY' ? (edit.morning ? 'M' : 'E') : null,
      });
      setModal(null);
    } catch (e) {
      setSaveError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const addPayment = () => {
    if (!modal || !payAmount) return;
    setAddingPay(true); setPayError('');
    try {
      addAdvance({ workerId: modal.worker.id, amount: parseFloat(payAmount), purpose: payPurpose || undefined, date: payDate });
      setPayAmount(''); setPayPurpose('');
      setPaySuccess(true);
      setTimeout(() => setPaySuccess(false), 3000);
    } catch (e) {
      setPayError(String(e));
    } finally {
      setAddingPay(false);
    }
  };

  const lateMinsNum = parseInt(edit.lateMinutes) || 0;
  const otDecimalNum = (parseInt(edit.otHours) || 0) + (parseInt(edit.otMinutes) || 0) / 60;
  const statusPreview = (() => {
    if (!edit.morning && !edit.evening) return { text: 'Absent', bg: '#FFF0F0', color: C.late };
    if (lateMinsNum > 0) return { text: `Late — ${fmtTime(lateMinsNum)}`, bg: '#FFF0F0', color: C.late };
    if (edit.morning && edit.evening) return { text: otDecimalNum > 0 ? `Present + OT ${fmtOT(otDecimalNum)}` : 'Present — Full Day ✓', bg: '#F0FFF4', color: '#166534' };
    return { text: 'Half Day', bg: '#F5F3FF', color: '#6D28D9' };
  })();

  return (
    <AppShell>
      <div className="p-4 lg:p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Attendance</h2>
            <p className="text-xs text-gray-400 mt-0.5">{activeWorkers.length} workers</p>
          </div>
          <RefreshCw className="w-4 h-4 text-gray-400" />
        </div>

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
                className={cn('px-3 py-1.5 rounded-lg text-sm font-medium transition-all', regDays === d ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700')}>
                {d}d
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 bg-gray-50 rounded-xl px-3 py-2 mb-4">
          {[{ hex: C.morning, label: 'M — Morning' }, { hex: C.evening, label: 'E — Evening' }, { hex: C.late, label: 'LT — Late' }, { hex: C.ot, label: 'OT — Overtime' }].map(({ hex, label }) => (
            <span key={label} className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded-sm flex-shrink-0" style={{ backgroundColor: hex }} />{label}</span>
          ))}
        </div>

        {activeWorkers.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="font-medium">No active workers</p>
            <p className="text-sm mt-1">Add workers from the Workers page first</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border-2 border-gray-300 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #9CA3AF', backgroundColor: '#F3F4F6' }}>
                    <th className="text-left px-4 py-3 text-sm font-bold text-gray-700 sticky left-0 min-w-[160px]" style={{ borderRight: '2px solid #9CA3AF', backgroundColor: '#F3F4F6' }}>Worker</th>
                    {regDates.map(d => (
                      <th key={d} className="px-2 py-2 text-center min-w-[120px]" style={{ borderRight: '1px solid #D1D5DB' }}>
                        <div className="text-sm font-bold text-gray-700">{new Date(d + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'short' })}</div>
                        <div className={cn('text-sm font-bold mt-0.5 px-2 py-0.5 rounded-full inline-block', d === today() ? 'bg-primary text-white' : 'text-gray-600')}>
                          {formatShortDate(d)}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row, idx) => (
                    <tr key={row.worker.id} style={{ borderBottom: '1px solid #D1D5DB', backgroundColor: idx % 2 === 0 ? '#fff' : '#F9FAFB' }}>
                      <td className="px-4 py-3 sticky left-0" style={{ borderRight: '2px solid #9CA3AF', backgroundColor: idx % 2 === 0 ? '#fff' : '#F9FAFB' }}>
                        <p className="text-sm font-bold text-gray-900 leading-tight">{row.worker.fullName}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{row.worker.category === 'DAILY_WAGE' ? 'Daily' : 'Monthly'}</p>
                      </td>
                      {regDates.map(d => (
                        <td key={d} className="px-2 py-1" style={{ borderRight: '1px solid #D1D5DB' }}>
                          <button onClick={() => openModal(row.worker, row.attendance[d], d)}
                            className="w-full rounded-lg px-2 py-1 text-left transition-all hover:bg-blue-50 active:scale-95">
                            <AttCell att={row.attendance[d]} />
                          </button>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {modal && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm" onClick={() => !saving && setModal(null)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl max-h-[92vh] overflow-y-auto lg:inset-auto lg:top-1/2 lg:left-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2 lg:w-[440px] lg:rounded-2xl lg:max-h-[85vh]">
            <div className="flex justify-center pt-3 pb-1 lg:hidden"><div className="w-10 h-1 bg-gray-300 rounded-full" /></div>
            <div className="px-5 pb-8 pt-4">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center text-primary font-bold text-xl flex-shrink-0">{modal.worker.fullName[0].toUpperCase()}</div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-base leading-tight">{modal.worker.fullName}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">{new Date(modal.date + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</p>
                  </div>
                </div>
                <button onClick={() => !saving && setModal(null)} className="p-2 hover:bg-gray-100 rounded-xl"><X className="w-5 h-5 text-gray-500" /></button>
              </div>

              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Mark Attendance</p>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <button onClick={() => setEdit(e => ({ ...e, morning: !e.morning }))} className="py-5 rounded-2xl border-2 transition-all select-none"
                  style={{ backgroundColor: edit.morning ? C.morning : '#F9FAFB', borderColor: edit.morning ? '#4CAF7D' : '#E5E7EB', color: edit.morning ? '#fff' : '#9CA3AF', boxShadow: edit.morning ? `0 4px 14px ${C.morning}60` : 'none' }}>
                  <div className="text-3xl mb-1">🌅</div>
                  <div className="text-sm font-semibold">Morning</div>
                  <div className="text-2xl font-black mt-0.5">M</div>
                </button>
                <button onClick={() => setEdit(e => ({ ...e, evening: !e.evening }))} className="py-5 rounded-2xl border-2 transition-all select-none"
                  style={{ backgroundColor: edit.evening ? C.evening : '#F9FAFB', borderColor: edit.evening ? '#7BAF6A' : '#E5E7EB', color: edit.evening ? '#fff' : '#9CA3AF', boxShadow: edit.evening ? `0 4px 14px ${C.evening}60` : 'none' }}>
                  <div className="text-3xl mb-1">🌆</div>
                  <div className="text-sm font-semibold">Evening</div>
                  <div className="text-2xl font-black mt-0.5">E</div>
                </button>
              </div>

              <div className="text-center text-sm font-semibold py-2.5 px-4 rounded-xl mb-5 transition-all"
                style={{ backgroundColor: statusPreview.bg, color: statusPreview.color }}>
                → {statusPreview.text}
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-xl mb-2 border" style={{ backgroundColor: '#FFF5F5', borderColor: '#FFCDD2' }}>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" style={{ color: C.late }} />
                  <div>
                    <p className="text-sm font-semibold" style={{ color: C.late }}>Late</p>
                    <p className="text-[11px] text-gray-400">Enter 0 if not late</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input type="number" min="0" max="480" value={edit.lateMinutes}
                    onChange={e => setEdit(p => ({ ...p, lateMinutes: e.target.value }))}
                    className="w-20 px-3 py-2 border rounded-xl text-sm text-center font-bold focus:outline-none bg-white"
                    style={{ borderColor: '#FFCDD2', color: C.late }} />
                  <span className="text-sm font-medium" style={{ color: C.late }}>min</span>
                </div>
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-xl mb-5 border" style={{ backgroundColor: '#FFFBF0', borderColor: '#FDE68A' }}>
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-600" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800">Overtime</p>
                    <p className="text-[11px] text-gray-400">Enter 0 if none</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <input type="number" min="0" max="12" value={edit.otHours}
                    onChange={e => setEdit(p => ({ ...p, otHours: e.target.value }))}
                    className="w-14 px-2 py-2 border border-amber-200 rounded-xl text-sm text-center font-bold focus:outline-none bg-white text-amber-800" />
                  <span className="text-sm font-medium text-amber-700">h</span>
                  <input type="number" min="0" max="59" value={edit.otMinutes}
                    onChange={e => setEdit(p => ({ ...p, otMinutes: e.target.value }))}
                    className="w-14 px-2 py-2 border border-amber-200 rounded-xl text-sm text-center font-bold focus:outline-none bg-white text-amber-800" />
                  <span className="text-sm font-medium text-amber-700">m</span>
                </div>
              </div>

              {saveError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2.5 mb-3 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />{saveError}
                </div>
              )}

              <button onClick={saveAttendance} disabled={saving}
                className="w-full flex items-center justify-center gap-2 bg-primary text-white py-4 rounded-2xl font-bold text-sm mb-6 hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-60 shadow-lg shadow-primary/20">
                <Save className="w-4 h-4" />{saving ? 'Saving…' : 'Save Attendance'}
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px bg-gray-100" />
                <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">Payment Given</span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>

              <div className="flex items-center gap-2 mb-3">
                <IndianRupee className="w-4 h-4 text-orange-500" />
                <p className="text-sm font-semibold text-gray-700">Add Payment Given to Worker</p>
              </div>

              {paySuccess && <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl p-3 mb-3 text-sm font-medium">✓ Payment recorded successfully!</div>}
              {payError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2.5 mb-3 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />{payError}
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
                  <Plus className="w-4 h-4" />{addingPay ? 'Adding…' : 'Add Payment'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}
