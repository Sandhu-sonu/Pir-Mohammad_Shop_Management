import React from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { Text, Card, ActivityIndicator, Divider, useTheme } from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

export const ClosingScreen = () => {
  const theme = useTheme();

  const { data, isLoading } = useQuery({
    queryKey: ['closingsHistory'],
    queryFn: async () => {
      const res = await api.get('/closing', {
        params: { page: 1, pageSize: 20 },
      });
      return res.data;
    },
  });

  const renderItem = ({ item }: { item: any }) => {
    const diff = item.difference;
    const hasDiff = Math.abs(diff) > 0;
    const diffColor = diff < 0 ? '#E74C3C' : '#2ECC71';

    return (
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.row}>
            <Text style={styles.date}>{new Date(item.date).toLocaleDateString()}</Text>
            <Text style={[styles.diffBadge, { color: hasDiff ? diffColor : '#FFFFFF' }]}>
              {diff === 0 ? 'Balanced' : diff > 0 ? `+₹${diff}` : `-₹${Math.abs(diff)}`}
            </Text>
          </View>
          <Divider style={styles.divider} />
          <View style={styles.row}><Text>Opening Cash:</Text><Text>₹{item.openingCash}</Text></View>
          <View style={styles.row}><Text>Sales Cash Flow:</Text><Text>₹{item.salesCash}</Text></View>
          <View style={styles.row}><Text>Expenses Cash Flow:</Text><Text style={{ color: '#E74C3C' }}>-₹{item.expensesCash}</Text></View>
          <View style={styles.row}><Text>Payments Collected:</Text><Text style={{ color: '#2ECC71' }}>+₹{item.paymentsReceivedCash}</Text></View>
          <View style={styles.row}><Text style={styles.bold}>Actual Closing Cash:</Text><Text style={[styles.bold, { color: '#1ABC9C' }]}>₹{item.closingCash}</Text></View>
          {item.notes ? (
            <Text style={styles.notes}>Note: {item.notes}</Text>
          ) : null}
        </Card.Content>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      {isLoading ? (
        <ActivityIndicator style={{ flex: 1 }} />
      ) : (
        <FlatList
          data={data?.data || []}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 24 }}
          ListEmptyComponent={
            <Text style={styles.empty}>No closing logs found.</Text>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    padding: 12,
  },
  card: {
    marginVertical: 8,
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  date: {
    fontWeight: 'bold',
    fontSize: 15,
    color: '#FF6B6B',
  },
  diffBadge: {
    fontWeight: 'bold',
    fontSize: 13,
  },
  divider: {
    marginVertical: 8,
    backgroundColor: '#2D2D2D',
  },
  bold: {
    fontWeight: 'bold',
  },
  notes: {
    fontSize: 12,
    color: '#A0A0A0',
    fontStyle: 'italic',
    marginTop: 8,
  },
  empty: {
    textAlign: 'center',
    marginTop: 36,
    color: '#A0A0A0',
  },
});
