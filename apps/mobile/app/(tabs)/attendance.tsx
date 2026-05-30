import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, Modal, StatusBar, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { attendanceApi } from '../../src/utils/api';
import * as Haptics from 'expo-haptics';

interface Worker { id: string; fullName: string; phone: string; category: string; }
interface AttRecord { id: string; status: string; overtime: string; overtimeHours?: number | null; }
interface RegisterRow { worker: Worker; attendance: Record<string, AttRecord | null>; }

const STATUS_CONFIG = {
  PRESENT: { label: 'P', bg: '#dcfce7', text: '#16a34a', border: '#bbf7d0' },
  ABSENT: { label: 'A', bg: '#fee2e2', text: '#dc2626', border: '#fecaca' },
  LATE: { label: 'L', bg: '#fef3c7', text: '#d97706', border: '#fde68a' },
  HALF_DAY: { label: 'H', bg: '#ede9fe', text: '#7c3aed', border: '#ddd6fe' },
  empty: { label: '—', bg: '#f9fafb', text: '#d1d5db', border: '#f3f4f6' },
};

function today() { return new Date().toISOString().split('T')[0]; }

export default function AttendanceScreen() {
  const [dates, setDates] = useState<string[]>([]);
  const [rows, setRows] = useState<RegisterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<{ workerId: string; workerName: string; date: string; current: AttRecord | null } | null>(null);
  const [saving, setSaving] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await attendanceApi.register(5);
      setDates(res.data.data.dates);
      setRows(res.data.data.rows);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const markAttendance = async (status: string, overtime = 'NONE', overtimeHours?: number) => {
    if (!selected) return;
    const key = `${selected.workerId}-${selected.date}`;
    setSaving(key);
    setSelected(null);

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      await attendanceApi.mark({ workerId: selected.workerId, date: selected.date, status, overtime, overtimeHours });
      setRows(prev => prev.map(row => {
        if (row.worker.id !== selected.workerId) return row;
        return {
          ...row,
          attendance: { ...row.attendance, [selected.date]: { id: 'temp', status, overtime, overtimeHours: overtimeHours || null } },
        };
      }));
    } finally {
      setSaving('');
    }
  };

  const getConfig = (att: AttRecord | null) => {
    if (!att) return STATUS_CONFIG.empty;
    return STATUS_CONFIG[att.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.empty;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="white" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Attendance Register</Text>
          <Text style={styles.headerSub}>{rows.length} workers</Text>
        </View>
        <TouchableOpacity onPress={() => { setRefreshing(true); load(); }} style={styles.refreshBtn}>
          <Ionicons name="refresh" size={20} color="#2563eb" />
        </TouchableOpacity>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        {Object.entries(STATUS_CONFIG).filter(([k]) => k !== 'empty').map(([key, cfg]) => (
          <View key={key} style={[styles.legendItem, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
            <Text style={[styles.legendText, { color: cfg.text }]}>{cfg.label} = {key.replace('_', ' ')}</Text>
          </View>
        ))}
      </View>

      {/* Table */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tableContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Header row */}
          <View style={styles.tableRow}>
            <View style={[styles.nameCell, styles.headerCell]}>
              <Text style={styles.headerCellText}>Worker</Text>
            </View>
            {dates.map(date => {
              const isToday = date === today();
              return (
                <View key={date} style={[styles.dateCell, styles.headerCell]}>
                  <Text style={styles.dateDayText}>
                    {new Date(date).toLocaleDateString('en-IN', { weekday: 'short' })}
                  </Text>
                  <View style={[styles.dateBadge, isToday && styles.todayBadge]}>
                    <Text style={[styles.dateBadgeText, isToday && styles.todayBadgeText]}>
                      {new Date(date).getDate()}/{new Date(date).getMonth() + 1}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>

          {/* Worker rows */}
          {rows.map((row, idx) => (
            <View key={row.worker.id} style={[styles.tableRow, idx % 2 === 1 && styles.tableRowAlt]}>
              <View style={styles.nameCell}>
                <Text style={styles.workerName} numberOfLines={1}>{row.worker.fullName}</Text>
                <Text style={styles.workerSub}>{row.worker.category === 'DAILY_WAGE' ? 'Daily' : 'Monthly'}</Text>
              </View>
              {dates.map(date => {
                const att = row.attendance[date];
                const cfg = getConfig(att);
                const key = `${row.worker.id}-${date}`;
                const isSaving = saving === key;

                return (
                  <TouchableOpacity
                    key={date}
                    style={[styles.attCell, { backgroundColor: cfg.bg, borderColor: cfg.border }]}
                    onPress={() => setSelected({ workerId: row.worker.id, workerName: row.worker.fullName, date, current: att })}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <ActivityIndicator size="small" color={cfg.text} />
                    ) : (
                      <Text style={[styles.attText, { color: cfg.text }]}>
                        {att ? cfg.label + (att.overtime === 'OT' ? '+OT' : '') : '—'}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </ScrollView>
      </ScrollView>

      {/* Quick Action Modal */}
      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBg} onPress={() => setSelected(null)} />
          <View style={styles.modalCard}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{selected?.workerName}</Text>
            <Text style={styles.modalDate}>
              {selected?.date && new Date(selected.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
            </Text>

            <View style={styles.modalBtns}>
              {[
                { status: 'PRESENT', label: 'Present', icon: 'checkmark-circle', color: '#22c55e' },
                { status: 'ABSENT', label: 'Absent', icon: 'close-circle', color: '#ef4444' },
                { status: 'LATE', label: 'Late', icon: 'time', color: '#f59e0b' },
                { status: 'HALF_DAY', label: 'Half Day', icon: 'remove-circle', color: '#8b5cf6' },
              ].map(opt => (
                <TouchableOpacity
                  key={opt.status}
                  style={[styles.modalBtn, { backgroundColor: opt.color + '15', borderColor: opt.color + '40' }]}
                  onPress={() => markAttendance(opt.status)}
                  activeOpacity={0.75}
                >
                  <Ionicons name={opt.icon as 'time'} size={24} color={opt.color} />
                  <Text style={[styles.modalBtnText, { color: opt.color }]}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.otRow}>
              <Text style={styles.otLabel}>+ Add Overtime</Text>
              {['1h', '2h', '3h', '4h'].map(h => (
                <TouchableOpacity
                  key={h}
                  style={styles.otBtn}
                  onPress={() => markAttendance(selected?.current?.status || 'PRESENT', 'OT', parseInt(h))}
                >
                  <Text style={styles.otBtnText}>{h}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.cancelBtn} onPress={() => setSelected(null)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f8fafc' },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14, backgroundColor: 'white',
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#1e293b' },
  headerSub: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  refreshBtn: { padding: 8 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 12, paddingVertical: 8 },
  legendItem: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  legendText: { fontSize: 10, fontWeight: '600' },
  tableContainer: { flex: 1 },
  tableRow: {
    flexDirection: 'row', backgroundColor: 'white',
    borderBottomWidth: 1, borderBottomColor: '#f8fafc',
  },
  tableRowAlt: { backgroundColor: '#fafafa' },
  headerCell: { backgroundColor: '#f8fafc' },
  headerCellText: { fontSize: 11, fontWeight: '700', color: '#64748b', textTransform: 'uppercase' },
  nameCell: {
    width: 130, paddingHorizontal: 12, paddingVertical: 10,
    justifyContent: 'center', borderRightWidth: 1, borderRightColor: '#f1f5f9',
  },
  workerName: { fontSize: 13, fontWeight: '600', color: '#1e293b' },
  workerSub: { fontSize: 11, color: '#94a3b8', marginTop: 1 },
  dateCell: {
    width: 70, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 8, paddingHorizontal: 4,
  },
  dateDayText: { fontSize: 10, color: '#94a3b8', fontWeight: '600' },
  dateBadge: { marginTop: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, backgroundColor: 'transparent' },
  dateBadgeText: { fontSize: 10, fontWeight: '700', color: '#374151' },
  todayBadge: { backgroundColor: '#2563eb' },
  todayBadgeText: { color: 'white' },
  attCell: {
    width: 70, height: 50, margin: 3, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },
  attText: { fontSize: 11, fontWeight: '700' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBg: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  modalCard: {
    backgroundColor: 'white', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 36,
  },
  modalHandle: {
    width: 40, height: 4, backgroundColor: '#e2e8f0', borderRadius: 2,
    alignSelf: 'center', marginBottom: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#1e293b', textAlign: 'center' },
  modalDate: { fontSize: 13, color: '#94a3b8', textAlign: 'center', marginTop: 4, marginBottom: 20 },
  modalBtns: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  modalBtn: {
    width: '45%', padding: 16, borderRadius: 16, alignItems: 'center', gap: 6,
    borderWidth: 1.5,
  },
  modalBtnText: { fontSize: 14, fontWeight: '700' },
  otRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 },
  otLabel: { fontSize: 13, fontWeight: '600', color: '#64748b', flex: 1 },
  otBtn: {
    paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#eff6ff',
    borderRadius: 10, borderWidth: 1, borderColor: '#bfdbfe',
  },
  otBtnText: { fontSize: 12, fontWeight: '700', color: '#2563eb' },
  cancelBtn: { marginTop: 16, padding: 14, alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 14 },
  cancelText: { fontSize: 14, fontWeight: '600', color: '#64748b' },
});
