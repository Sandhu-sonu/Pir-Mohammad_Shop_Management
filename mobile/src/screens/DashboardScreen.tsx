import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Text, Card, useTheme, ActivityIndicator, Button } from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { api } from '../services/api';
import { MetricCard } from '../components/MetricCard';
import { useAuthStore } from '../stores/authStore';

export const DashboardScreen = () => {
  const theme = useTheme();
  const navigation = useNavigation<any>();
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
        <ActivityIndicator size="large" color="#FF6B6B" />
        <Text style={{ marginTop: 12, color: '#A0A0A0' }}>Loading business summary...</Text>
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={styles.centered}>
        <Text style={{ color: theme.colors.error, fontWeight: 'bold' }}>
          Failed to load summary stats.
        </Text>
        <Text style={{ color: theme.colors.outline, marginTop: 8, textAlign: 'center', paddingHorizontal: 24 }}>
          Verify connection to your backend server.
        </Text>
        <Button mode="contained" onPress={() => refetch()} style={{ marginTop: 16, backgroundColor: '#FF6B6B' }}>
          Retry / ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ
        </Button>
      </View>
    );
  }

  // Format subscription expiry date
  const formatExpiryDate = (isoStr: string | null) => {
    if (!isoStr) return 'N/A';
    try {
      return new Date(isoStr).toLocaleDateString();
    } catch {
      return 'N/A';
    }
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF6B6B" />}
    >
      {/* Header Profile Title */}
      <View style={styles.header}>
        <Text variant="headlineSmall" style={styles.welcome}>
          ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ, {user?.name || 'Owner'}!
        </Text>
        <Text variant="bodyMedium" style={{ color: theme.colors.outline, marginTop: 4 }}>
          Shop: {user?.shopName} | Business Dashboard
        </Text>
      </View>

      {/* Quick Action Navigation Grid */}
      <Text variant="titleMedium" style={styles.sectionTitle}>
        Quick Actions / ਤੁਰੰਤ ਲਿੰਕ
      </Text>
      <View style={styles.actionRow}>
        <Button
          mode="contained-tonal"
          icon="package-variant-closed"
          onPress={() => navigation.navigate('Inventory')}
          style={styles.actionButton}
          labelStyle={styles.actionLabel}
        >
          Stock / ਸਟਾਕ
        </Button>
        <Button
          mode="contained-tonal"
          icon="account-group"
          onPress={() => navigation.navigate('Customers')}
          style={styles.actionButton}
          labelStyle={styles.actionLabel}
        >
          Khata / ਖਾਤਾ
        </Button>
        <Button
          mode="contained-tonal"
          icon="cog"
          onPress={() => navigation.navigate('Settings')}
          style={styles.actionButton}
          labelStyle={styles.actionLabel}
        >
          Settings / ਸੈਟਿੰਗਾਂ
        </Button>
      </View>

      {/* Subscription Card */}
      <Card style={styles.subCard}>
        <Card.Content style={styles.subContent}>
          <View>
            <Text style={styles.subTitle}>Subscription Plan / ਪਲਾਨ</Text>
            <Text style={styles.subPlan}>{data.planName || 'N/A'}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[styles.subStatus, { color: data.subscriptionStatus === 'ACTIVE' ? '#2ECC71' : '#E67E22' }]}>
              {data.subscriptionStatus}
            </Text>
            <Text style={styles.subExpiry}>
              Expires: {formatExpiryDate(data.subscriptionExpiry)}
            </Text>
          </View>
        </Card.Content>
      </Card>

      <Text variant="titleMedium" style={styles.sectionTitle}>
        Business Indicators / ਕਾਰੋਬਾਰੀ ਸੂਚਕ
      </Text>

      {/* Row 1: Sales & Collection */}
      <View style={styles.row}>
        <MetricCard
          title="Today's Sales / ਵਿਕਰੀ"
          value={`₹${data.todaySales}`}
          subtitle={`${data.todayBills} Bills generated`}
          color="#2ECC71"
        />
        <MetricCard
          title="Today's Collection / ਉਗਰਾਹੀ"
          value={`₹${data.todayCollection}`}
          subtitle="Payments received today"
          color="#1ABC9C"
        />
      </View>

      {/* Row 2: Monthly Sales & Outstanding Khata */}
      <View style={styles.row}>
        <MetricCard
          title="Monthly Sales / ਮਹੀਨੇ ਦੀ ਵਿਕਰੀ"
          value={`₹${data.monthlySales}`}
          color="#3498DB"
        />
        <MetricCard
          title="Outstanding Khata / ਉਧਾਰ ਖਾਤਾ"
          value={`₹${data.customerDue}`}
          color="#E74C3C"
        />
      </View>

      {/* Row 3: Current Stock & Low Stock Items */}
      <View style={styles.row}>
        <MetricCard
          title="Current Stock / ਕੁੱਲ ਉਤਪਾਦ"
          value={`${data.totalProducts}`}
          subtitle="Unique products in catalog"
          color="#9B59B6"
        />
        <MetricCard
          title="Low Stock / ਘੱਟ ਸਟਾਕ"
          value={`${data.lowStock}`}
          subtitle={`${data.outOfStock || 0} Out of Stock`}
          color={data.lowStock > 0 ? '#E67E22' : '#2ECC71'}
        />
      </View>

      <View style={{ height: 32 }} />
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
    padding: 24,
  },
  header: {
    marginVertical: 16,
    paddingLeft: 4,
  },
  welcome: {
    fontWeight: 'bold',
    color: '#FF6B6B',
  },
  sectionTitle: {
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 12,
    marginBottom: 8,
    paddingLeft: 4,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    marginHorizontal: 4,
    borderRadius: 8,
  },
  actionLabel: {
    fontSize: 11,
    marginHorizontal: 0,
  },
  subCard: {
    backgroundColor: '#1E1E1E',
    borderColor: '#2D2D2D',
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 16,
  },
  subContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subTitle: {
    fontSize: 11,
    color: '#A0A0A0',
  },
  subPlan: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 2,
  },
  subStatus: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  subExpiry: {
    fontSize: 10,
    color: '#A0A0A0',
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
});
