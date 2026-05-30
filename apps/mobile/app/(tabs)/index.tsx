import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/store/auth';
import { dashboardApi, formatCurrency } from '../../src/utils/api';
import { useRouter } from 'expo-router';

interface Stats {
  totalWorkers: number;
  activeWorkers: number;
  presentToday: number;
  absentToday: number;
  lateToday: number;
  pendingSalaries: number;
  pendingCount: number;
  monthlyExpense: number;
  totalAdvances: number;
  notMarkedToday: number;
}

export default function DashboardScreen() {
  const { user, company, logout } = useAuthStore();
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const res = await dashboardApi.stats();
      setStats(res.data.data);
    } catch { /* ignore */ }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  useEffect(() => { load(); }, []);

  const statCards = stats ? [
    { label: 'Total Workers', value: stats.totalWorkers, icon: 'people', color: '#3b82f6', bg: '#eff6ff' },
    { label: 'Present Today', value: stats.presentToday, icon: 'checkmark-circle', color: '#22c55e', bg: '#f0fdf4' },
    { label: 'Absent Today', value: stats.absentToday, icon: 'close-circle', color: '#ef4444', bg: '#fef2f2' },
    { label: 'Late Today', value: stats.lateToday, icon: 'time', color: '#f59e0b', bg: '#fffbeb' },
    { label: 'Pending Salary', value: formatCurrency(stats.pendingSalaries), icon: 'cash', color: '#f97316', bg: '#fff7ed' },
    { label: 'Monthly Expense', value: formatCurrency(stats.monthlyExpense), icon: 'trending-up', color: '#8b5cf6', bg: '#f5f3ff' },
  ] : [];

  const quickActions = [
    { label: 'Mark Attendance', icon: 'calendar', color: '#22c55e', route: '/(tabs)/attendance' },
    { label: 'Add Worker', icon: 'person-add', color: '#3b82f6', route: '/(tabs)/workers' },
    { label: 'View Payroll', icon: 'cash', color: '#8b5cf6', route: '/(tabs)/payroll' },
    { label: 'Ask AI', icon: 'sparkles', color: '#f59e0b', route: '/(tabs)/ai' },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="white" />
      <ScrollView
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563eb" />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Good morning 👋</Text>
            <Text style={styles.companyName}>{company?.name || 'Labour Manager'}</Text>
          </View>
          <View style={styles.headerRight}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{user?.name?.[0]?.toUpperCase() || 'A'}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.date}>
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </Text>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          {statCards.map((card, i) => (
            <View key={i} style={[styles.statCard, { backgroundColor: card.bg }]}>
              <View style={[styles.statIcon, { backgroundColor: card.color + '20' }]}>
                <Ionicons name={card.icon as 'people'} size={20} color={card.color} />
              </View>
              <Text style={styles.statValue}>{card.value}</Text>
              <Text style={styles.statLabel}>{card.label}</Text>
            </View>
          ))}
        </View>

        {/* Not marked alert */}
        {stats && stats.notMarkedToday > 0 && (
          <TouchableOpacity
            style={styles.alertBox}
            onPress={() => router.push('/(tabs)/attendance')}
          >
            <Ionicons name="warning" size={20} color="#f59e0b" />
            <Text style={styles.alertText}>
              {stats.notMarkedToday} workers not marked today
            </Text>
            <Ionicons name="chevron-forward" size={16} color="#f59e0b" />
          </TouchableOpacity>
        )}

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickGrid}>
          {quickActions.map((action, i) => (
            <TouchableOpacity
              key={i}
              style={styles.quickBtn}
              onPress={() => router.push(action.route as `/${string}`)}
              activeOpacity={0.75}
            >
              <View style={[styles.quickIcon, { backgroundColor: action.color + '20' }]}>
                <Ionicons name={action.icon as 'sparkles'} size={24} color={action.color} />
              </View>
              <Text style={styles.quickLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f8fafc' },
  container: { flex: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4,
  },
  greeting: { fontSize: 13, color: '#64748b' },
  companyName: { fontSize: 20, fontWeight: '800', color: '#1e293b' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: 'white', fontWeight: '700', fontSize: 16 },
  date: { paddingHorizontal: 20, fontSize: 12, color: '#94a3b8', marginBottom: 16 },
  statsGrid: {
    paddingHorizontal: 16,
    flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12,
  },
  statCard: {
    width: '47%', borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)',
  },
  statIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  statValue: { fontSize: 20, fontWeight: '800', color: '#1e293b' },
  statLabel: { fontSize: 11, color: '#64748b', marginTop: 2, fontWeight: '500' },
  alertBox: {
    marginHorizontal: 16, marginBottom: 16,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fffbeb', borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: '#fde68a',
  },
  alertText: { flex: 1, fontSize: 13, color: '#92400e', fontWeight: '500' },
  sectionTitle: { paddingHorizontal: 20, fontSize: 15, fontWeight: '700', color: '#1e293b', marginBottom: 12 },
  quickGrid: {
    paddingHorizontal: 16, flexDirection: 'row',
    flexWrap: 'wrap', gap: 10, marginBottom: 20,
  },
  quickBtn: {
    width: '47%', backgroundColor: 'white', borderRadius: 16,
    padding: 16, alignItems: 'center', gap: 10,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
    borderWidth: 1, borderColor: '#f1f5f9',
  },
  quickIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { fontSize: 12, fontWeight: '600', color: '#374151', textAlign: 'center' },
});
