import { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  RefreshControl, StatusBar, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { payrollApi, formatCurrency } from '../../src/utils/api';

interface PayrollRecord {
  id: string;
  presentDays: number;
  absentDays: number;
  basicSalary: number;
  overtimePay: number;
  netSalary: number;
  isPaid: boolean;
  month: number;
  year: number;
  worker: { fullName: string; phone: string; category: string };
}

interface Summary {
  totalWorkers: number;
  totalNet: number;
  totalPaid: number;
  totalPending: number;
  paidCount: number;
  pendingCount: number;
}

export default function PayrollScreen() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const [rRes, sRes] = await Promise.all([
        payrollApi.list(month, year),
        payrollApi.summary(month, year),
      ]);
      setRecords(rRes.data.data);
      setSummary(sRes.data.data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, [month, year]);

  const generate = async () => {
    setGenerating(true);
    try {
      await payrollApi.generate(month, year);
      await load();
    } finally {
      setGenerating(false);
    }
  };

  const navigateMonth = (dir: number) => {
    const d = new Date(year, month - 1 + dir);
    setMonth(d.getMonth() + 1);
    setYear(d.getFullYear());
  };

  const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long', year: 'numeric' });

  const renderRecord = ({ item }: { item: PayrollRecord }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.workerInfo}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{item.worker.fullName[0]}</Text>
          </View>
          <View>
            <Text style={styles.workerName}>{item.worker.fullName}</Text>
            <Text style={styles.attendance}>P: {item.presentDays} · A: {item.absentDays}</Text>
          </View>
        </View>
        <View style={styles.netSalary}>
          <Text style={styles.netAmount}>{formatCurrency(Number(item.netSalary))}</Text>
          <View style={[styles.statusBadge, { backgroundColor: item.isPaid ? '#f0fdf4' : '#fff7ed' }]}>
            <Text style={[styles.statusText, { color: item.isPaid ? '#16a34a' : '#ea580c' }]}>
              {item.isPaid ? 'Paid' : 'Pending'}
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.breakdown}>
        <Text style={styles.breakdownText}>Basic: {formatCurrency(Number(item.basicSalary))}</Text>
        <Text style={styles.breakdownText}>OT: +{formatCurrency(Number(item.overtimePay))}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="white" />

      <View style={styles.header}>
        <Text style={styles.title}>Payroll</Text>
        <TouchableOpacity
          style={[styles.genBtn, generating && styles.genBtnDisabled]}
          onPress={generate} disabled={generating}
        >
          {generating
            ? <ActivityIndicator size="small" color="white" />
            : <Ionicons name="flash" size={16} color="white" />
          }
          <Text style={styles.genBtnText}>{generating ? 'Generating...' : 'Generate'}</Text>
        </TouchableOpacity>
      </View>

      {/* Month nav */}
      <View style={styles.monthNav}>
        <TouchableOpacity style={styles.monthBtn} onPress={() => navigateMonth(-1)}>
          <Ionicons name="chevron-back" size={20} color="#2563eb" />
        </TouchableOpacity>
        <Text style={styles.monthLabel}>{monthName}</Text>
        <TouchableOpacity style={styles.monthBtn} onPress={() => navigateMonth(1)}>
          <Ionicons name="chevron-forward" size={20} color="#2563eb" />
        </TouchableOpacity>
      </View>

      {/* Summary */}
      {summary && (
        <View style={styles.summaryRow}>
          <View style={[styles.sumCard, { backgroundColor: '#eff6ff' }]}>
            <Text style={[styles.sumVal, { color: '#2563eb' }]}>{formatCurrency(summary.totalNet)}</Text>
            <Text style={styles.sumLabel}>Total Payroll</Text>
          </View>
          <View style={[styles.sumCard, { backgroundColor: '#f0fdf4' }]}>
            <Text style={[styles.sumVal, { color: '#16a34a' }]}>{formatCurrency(summary.totalPaid)}</Text>
            <Text style={styles.sumLabel}>Paid ({summary.paidCount})</Text>
          </View>
          <View style={[styles.sumCard, { backgroundColor: '#fff7ed' }]}>
            <Text style={[styles.sumVal, { color: '#ea580c' }]}>{formatCurrency(summary.totalPending)}</Text>
            <Text style={styles.sumLabel}>Pending ({summary.pendingCount})</Text>
          </View>
        </View>
      )}

      <FlatList
        data={records}
        renderItem={renderRecord}
        keyExtractor={i => i.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#2563eb" />}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Ionicons name="cash-outline" size={48} color="#e2e8f0" />
              <Text style={styles.emptyText}>No payroll records</Text>
              <Text style={styles.emptySubText}>Tap Generate to calculate salaries</Text>
            </View>
          ) : null
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: 'white',
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  title: { fontSize: 20, fontWeight: '800', color: '#1e293b' },
  genBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#2563eb', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
  },
  genBtnDisabled: { opacity: 0.6 },
  genBtnText: { color: 'white', fontWeight: '700', fontSize: 13 },
  monthNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 16, padding: 12, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  monthBtn: { padding: 8 },
  monthLabel: { fontSize: 16, fontWeight: '700', color: '#1e293b', minWidth: 160, textAlign: 'center' },
  summaryRow: { flexDirection: 'row', gap: 8, padding: 12 },
  sumCard: { flex: 1, padding: 10, borderRadius: 12 },
  sumVal: { fontSize: 14, fontWeight: '800' },
  sumLabel: { fontSize: 10, color: '#64748b', marginTop: 2 },
  list: { padding: 12, paddingBottom: 20 },
  card: {
    backgroundColor: 'white', borderRadius: 16, padding: 14, marginBottom: 8,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
    borderWidth: 1, borderColor: '#f1f5f9',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  workerInfo: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  avatar: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 16, fontWeight: '800', color: '#2563eb' },
  workerName: { fontSize: 14, fontWeight: '700', color: '#1e293b' },
  attendance: { fontSize: 11, color: '#94a3b8', marginTop: 1 },
  netSalary: { alignItems: 'flex-end' },
  netAmount: { fontSize: 16, fontWeight: '800', color: '#1e293b' },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, marginTop: 4 },
  statusText: { fontSize: 10, fontWeight: '700' },
  breakdown: { flexDirection: 'row', gap: 12, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f8fafc' },
  breakdownText: { fontSize: 11, color: '#64748b' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyText: { fontSize: 15, color: '#94a3b8', fontWeight: '600' },
  emptySubText: { fontSize: 12, color: '#cbd5e1' },
});
