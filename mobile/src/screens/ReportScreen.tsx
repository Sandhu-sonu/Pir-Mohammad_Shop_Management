import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card, SegmentedButtons, ActivityIndicator, Divider, useTheme } from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

export const ReportScreen = () => {
  const theme = useTheme();
  const [reportType, setReportType] = useState('profit'); // 'profit', 'daily', 'monthly', 'products', 'customers'

  // Profit Report Query
  const { data: profitData, isLoading: profitLoading } = useQuery({
    queryKey: ['reportProfit'],
    queryFn: async () => {
      const res = await api.get('/reports/profit');
      return res.data.data;
    },
    enabled: reportType === 'profit',
  });

  // Daily Report Query
  const { data: dailyData, isLoading: dailyLoading } = useQuery({
    queryKey: ['reportDaily'],
    queryFn: async () => {
      const res = await api.get('/reports/daily');
      return res.data.data;
    },
    enabled: reportType === 'daily',
  });

  // Monthly Report Query
  const { data: monthlyData, isLoading: monthlyLoading } = useQuery({
    queryKey: ['reportMonthly'],
    queryFn: async () => {
      const res = await api.get('/reports/monthly');
      return res.data.data;
    },
    enabled: reportType === 'monthly',
  });

  // Top Products Report Query
  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ['reportProducts'],
    queryFn: async () => {
      const res = await api.get('/reports/top-products');
      return res.data.data;
    },
    enabled: reportType === 'products',
  });

  // Top Customers Report Query
  const { data: customersData, isLoading: customersLoading } = useQuery({
    queryKey: ['reportCustomers'],
    queryFn: async () => {
      const res = await api.get('/reports/top-customers');
      return res.data.data;
    },
    enabled: reportType === 'customers',
  });

  const renderContent = () => {
    if (profitLoading || dailyLoading || monthlyLoading || productsLoading || customersLoading) {
      return <ActivityIndicator size="large" style={{ marginTop: 48 }} />;
    }

    switch (reportType) {
      case 'profit':
        return profitData ? (
          <Card style={styles.card}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.title}>Profit Statement / ਲਾਭ-ਹਾਨੀ ਖਾਤਾ</Text>
              <Divider style={styles.divider} />
              <View style={styles.row}><Text>Total Sales revenue:</Text><Text style={styles.green}>₹{profitData.sales}</Text></View>
              <View style={styles.row}><Text>Total Purchases cost:</Text><Text style={styles.orange}>₹{profitData.purchases}</Text></View>
              <View style={styles.row}><Text>Total Expenses cost:</Text><Text style={styles.orange}>₹{profitData.expenses}</Text></View>
              <View style={styles.row}><Text>Reversals:</Text><Text>₹{profitData.reversals}</Text></View>
              <Divider style={styles.divider} />
              <View style={styles.row}><Text style={styles.bold}>Gross Profit Margin:</Text><Text style={[styles.bold, styles.green]}>₹{profitData.grossProfit}</Text></View>
              <View style={styles.row}><Text style={styles.bold}>Net Profit Margin:</Text><Text style={[styles.bold, styles.green, { fontSize: 18 }]}>₹{profitData.netProfit}</Text></View>
            </Card.Content>
          </Card>
        ) : null;

      case 'daily':
        return dailyData ? (
          <Card style={styles.card}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.title}>Daily Transaction Summary</Text>
              <Divider style={styles.divider} />
              <View style={styles.row}><Text>Sales Revenue Total:</Text><Text style={styles.green}>₹{dailyData.salesTotal}</Text></View>
              <View style={styles.row}><Text>Total Bills generated:</Text><Text>{dailyData.salesCount}</Text></View>
              <View style={styles.row}><Text>Supplier Procurements:</Text><Text style={styles.orange}>₹{dailyData.purchasesTotal}</Text></View>
              <View style={styles.row}><Text>Expenses Logged:</Text><Text style={styles.orange}>₹{dailyData.expensesTotal}</Text></View>
            </Card.Content>
          </Card>
        ) : null;

      case 'monthly':
        return monthlyData ? (
          <Card style={styles.card}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.title}>Monthly Transaction Summary</Text>
              <Divider style={styles.divider} />
              <View style={styles.row}><Text>Sales Revenue Total:</Text><Text style={styles.green}>₹{monthlyData.salesTotal}</Text></View>
              <View style={styles.row}><Text>Total Bills generated:</Text><Text>{monthlyData.salesCount}</Text></View>
              <View style={styles.row}><Text>Supplier Procurements:</Text><Text style={styles.orange}>₹{monthlyData.purchasesTotal}</Text></View>
              <View style={styles.row}><Text>Expenses Logged:</Text><Text style={styles.orange}>₹{monthlyData.expensesTotal}</Text></View>
            </Card.Content>
          </Card>
        ) : null;

      case 'products':
        return productsData ? (
          <Card style={styles.card}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.title}>Top 10 Selling Products</Text>
              <Divider style={styles.divider} />
              {productsData.map((p: any, idx: number) => (
                <View key={p.id} style={styles.listItem}>
                  <Text style={styles.bold}>{idx + 1}. {p.nameEn} ({p.namePa})</Text>
                  <Text style={styles.green}>{p.totalQty} {p.unit} (₹{p.totalSales})</Text>
                </View>
              ))}
            </Card.Content>
          </Card>
        ) : null;

      case 'customers':
        return customersData ? (
          <Card style={styles.card}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.title}>Top 10 Customers (Revenue)</Text>
              <Divider style={styles.divider} />
              {customersData.map((c: any, idx: number) => (
                <View key={c.id} style={styles.listItem}>
                  <Text style={styles.bold}>{idx + 1}. {c.name}</Text>
                  <Text style={styles.green}>Spent: ₹{c.totalSpent}</Text>
                </View>
              ))}
            </Card.Content>
          </Card>
        ) : null;

      default:
        return null;
    }
  };

  return (
    <ScrollView style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollTabs}>
        <SegmentedButtons
          value={reportType}
          onValueChange={setReportType}
          buttons={[
            { value: 'profit', label: 'Profit' },
            { value: 'daily', label: 'Daily' },
            { value: 'monthly', label: 'Monthly' },
            { value: 'products', label: 'Top Products' },
            { value: 'customers', label: 'Top Customers' },
          ]}
          style={styles.tabs}
        />
      </ScrollView>

      <View style={{ paddingVertical: 12 }}>
        {renderContent()}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    padding: 12,
  },
  scrollTabs: {
    marginVertical: 6,
  },
  tabs: {
    minWidth: 500,
  },
  card: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
  },
  title: {
    fontWeight: 'bold',
    color: '#FF6B6B',
  },
  divider: {
    marginVertical: 12,
    backgroundColor: '#2D2D2D',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  bold: {
    fontWeight: 'bold',
  },
  green: {
    color: '#2ECC71',
    fontWeight: 'bold',
  },
  orange: {
    color: '#E67E22',
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 0.2,
    borderBottomColor: '#3A3A3A',
  },
});
