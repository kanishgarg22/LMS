import { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  TextInput, RefreshControl, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { workersApi, formatCurrency } from '../../src/utils/api';

interface Worker {
  id: string; fullName: string; phone: string; category: string;
  dailyWage?: number; monthlySalary?: number; isActive: boolean;
  joiningDate: string;
}

export default function WorkersScreen() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (q?: string) => {
    try {
      const res = await workersApi.list(q ? { search: q } : {});
      setWorkers(res.data.data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const t = setTimeout(() => load(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const renderItem = ({ item }: { item: Worker }) => (
    <View style={styles.card}>
      <View style={styles.cardLeft}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{item.fullName[0].toUpperCase()}</Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.workerName}>{item.fullName}</Text>
          <View style={styles.phonRow}>
            <Ionicons name="call-outline" size={12} color="#94a3b8" />
            <Text style={styles.phone}>{item.phone}</Text>
          </View>
          <View style={styles.tagRow}>
            <View style={[styles.tag, { backgroundColor: '#eff6ff' }]}>
              <Text style={[styles.tagText, { color: '#2563eb' }]}>
                {item.category === 'DAILY_WAGE' ? 'Daily' : 'Monthly'}
              </Text>
            </View>
            <View style={[styles.tag, { backgroundColor: item.isActive ? '#f0fdf4' : '#f9fafb' }]}>
              <Text style={[styles.tagText, { color: item.isActive ? '#16a34a' : '#94a3b8' }]}>
                {item.isActive ? 'Active' : 'Inactive'}
              </Text>
            </View>
          </View>
        </View>
      </View>
      <View style={styles.cardRight}>
        <Text style={styles.wage}>
          {item.category === 'DAILY_WAGE'
            ? formatCurrency(item.dailyWage || 0)
            : formatCurrency(item.monthlySalary || 0)}
        </Text>
        <Text style={styles.wageLabel}>
          {item.category === 'DAILY_WAGE' ? '/day' : '/month'}
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="white" />
      <View style={styles.header}>
        <Text style={styles.title}>Workers</Text>
        <Text style={styles.subtitle}>{workers.length} total</Text>
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color="#94a3b8" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name or phone..."
          placeholderTextColor="#94a3b8"
        />
      </View>

      <FlatList
        data={workers}
        renderItem={renderItem}
        keyExtractor={i => i.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#2563eb" />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={48} color="#e2e8f0" />
            <Text style={styles.emptyText}>No workers found</Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f8fafc' },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  title: { fontSize: 20, fontWeight: '800', color: '#1e293b' },
  subtitle: { fontSize: 12, color: '#94a3b8' },
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    margin: 12, backgroundColor: 'white',
    borderRadius: 14, paddingHorizontal: 12, height: 44,
    borderWidth: 1.5, borderColor: '#e2e8f0',
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: '#1e293b' },
  list: { paddingHorizontal: 12, paddingBottom: 20 },
  card: {
    flexDirection: 'row', backgroundColor: 'white', borderRadius: 16,
    padding: 14, marginBottom: 8, justifyContent: 'space-between', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
    borderWidth: 1, borderColor: '#f1f5f9',
  },
  cardLeft: { flexDirection: 'row', gap: 12, flex: 1 },
  avatar: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '800', color: '#2563eb' },
  cardInfo: { flex: 1 },
  workerName: { fontSize: 14, fontWeight: '700', color: '#1e293b' },
  phonRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  phone: { fontSize: 12, color: '#94a3b8' },
  tagRow: { flexDirection: 'row', gap: 4, marginTop: 6 },
  tag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  tagText: { fontSize: 10, fontWeight: '700' },
  cardRight: { alignItems: 'flex-end' },
  wage: { fontSize: 15, fontWeight: '800', color: '#1e293b' },
  wageLabel: { fontSize: 11, color: '#94a3b8' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 14, color: '#94a3b8', fontWeight: '500' },
});
