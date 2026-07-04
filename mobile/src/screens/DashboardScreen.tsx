import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Text, Card, useTheme, ActivityIndicator, Divider } from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { MetricCard } from '../components/MetricCard';
import { LineChart } from '../components/LineChart';
import { useAuthStore } from '../stores/authStore';

export const DashboardScreen = () => {
  const theme = useTheme();
  const user = useAuthStore((state) => state.user);
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['dashboardStats'],
    queryFn: async () => {
      const res = await api.get('/dashboard');
      return res.data.data;
    },
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 12 }}>Loading business summary...</Text>
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={styles.centered}>
        <Text style={{ color: theme.colors.error, fontWeight: 'bold' }}>
          Failed to load summary stats.
        </Text>
        <Text style={{ color: theme.colors.outline, marginTop: 8 }}>
          Verify connection to your backend server.
        </Text>
      </View>
    );
  }

  // Format SVG chart coordinates
  const chartPoints = data.salesTrend.map((t: any) => ({
    label: t.dayEn,
    value: t.amount,
  }));

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <Text variant="headlineSmall" style={styles.welcome}>
          ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ, {user?.name || 'Owner'}!
        </Text>
        <Text variant="bodyMedium" style={{ color: theme.colors.outline }}>
          Shop: {user?.shopName} | Business Summary
        </Text>
      </View>

      {/* Row 1: Sales and Profit KPIs */}
      <View style={styles.row}>
        <MetricCard
          title="Today's Sales / ਅੱਜ ਦੀ ਵਿਕਰੀ"
          value={`₹${data.todaySales}`}
          subtitle={`${data.todayBills} Bills generated`}
          color="#2ECC71"
        />
        <MetricCard
          title="Today's Profit / ਲਾਭ"
          value={`₹${data.todayProfit}`}
          color="#3498DB"
        />
      </View>

      {/* Row 2: Monthly sales and profit KPIs */}
      <View style={styles.row}>
        <MetricCard
          title="Monthly Sales / ਮਹੀਨੇ ਦੀ ਵਿਕਰੀ"
          value={`₹${data.monthlySales}`}
          color="#F1C40F"
        />
        <MetricCard
          title="Monthly Profit"
          value={`₹${data.monthlyProfit}`}
          color="#9B59B6"
        />
      </View>

      {/* Row 3: Outstanding Ledger Balances */}
      <View style={styles.row}>
        <MetricCard
          title="Customer Due / ਉਧਾਰ ਖਾਤਾ"
          value={`₹${data.customerDue}`}
          color="#E74C3C"
        />
        <MetricCard
          title="Supplier Due / ਲੈਣਦਾਰੀ"
          value={`₹${data.supplierDue}`}
          color="#E67E22"
        />
      </View>

      {/* Row 4: Cash in Hand & Stock indicators */}
      <View style={styles.row}>
        <MetricCard
          title="Cash In Hand / ਕੈਸ਼"
          value={`₹${data.cashInHand}`}
          color="#1ABC9C"
        />
        <MetricCard
          title="Stock / ਸਟਾਕ ਅਲਰਟ"
          value={`${data.lowStock}`}
          subtitle={`${data.outOfStock} Out of Stock`}
          color="#E74C3C"
        />
      </View>

      {/* Sales Trend Chart */}
      <View style={styles.section}>
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Weekly Sales Trend / ਹਫਤਾਵਾਰੀ ਰੁਝਾਨ
        </Text>
        <LineChart data={chartPoints} />
      </View>

      {/* Top 10 Selling Products List */}
      <Card style={styles.sectionCard}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Top Selling Products / ਪ੍ਰਮੁੱਖ ਉਤਪਾਦ
          </Text>
          <Divider style={{ marginVertical: 8 }} />
          {data.topSellingProducts.map((p: any, idx: number) => (
            <View key={p.id} style={styles.listItem}>
              <View style={styles.listItemLeft}>
                <Text style={styles.listIdx}>{idx + 1}.</Text>
                <View>
                  <Text style={styles.listTextEn}>{p.nameEn}</Text>
                  <Text style={styles.listTextPa}>{p.namePa}</Text>
                </View>
              </View>
              <Text style={styles.listQty}>
                {p.totalQty} {p.unit}
              </Text>
            </View>
          ))}
          {data.topSellingProducts.length === 0 && (
            <Text style={{ textAlign: 'center', marginVertical: 12, color: theme.colors.outline }}>
              No sales logged yet.
            </Text>
          )}
        </Card.Content>
      </Card>
      
      <View style={{ height: 24 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    padding: 12,
  },
  centered: {
    flex: 1,
    backgroundColor: '#121212',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    marginVertical: 12,
    paddingLeft: 6,
  },
  welcome: {
    fontWeight: 'bold',
    color: '#FF6B6B',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  section: {
    marginVertical: 12,
    paddingHorizontal: 6,
  },
  sectionTitle: {
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  sectionCard: {
    marginVertical: 12,
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#2D2D2D',
  },
  listItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  listIdx: {
    fontWeight: 'bold',
    marginRight: 8,
    color: '#FF6B6B',
  },
  listTextEn: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  listTextPa: {
    color: '#A0A0A0',
    fontSize: 12,
  },
  listQty: {
    color: '#2ECC71',
    fontWeight: 'bold',
  },
});
