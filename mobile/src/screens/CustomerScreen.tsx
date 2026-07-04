import React, { useState } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { Text, Searchbar, Card, SegmentedButtons, ActivityIndicator, useTheme } from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

export const CustomerScreen = () => {
  const theme = useTheme();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState(''); // '', 'outstanding'

  const { data, isLoading } = useQuery({
    queryKey: ['customersList', page, search, status],
    queryFn: async () => {
      const res = await api.get('/customers', {
        params: {
          page,
          pageSize: 25,
          search,
          status,
        },
      });
      return res.data;
    },
  });

  const renderItem = ({ item }: { item: any }) => {
    const hasDues = item.currentBalance > 0;
    
    return (
      <Card style={styles.card}>
        <Card.Content style={styles.cardContent}>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={{ color: theme.colors.outline, fontSize: 12 }}>
              Mob: {item.mobile || 'N/A'} | Address: {item.address || 'N/A'}
            </Text>
            {item.lastVisit ? (
              <Text style={{ color: theme.colors.primary, fontSize: 10, marginTop: 4 }}>
                Last purchase: {new Date(item.lastVisit).toLocaleDateString()}
              </Text>
            ) : null}
          </View>
          <View style={styles.balanceContainer}>
            <Text style={[styles.balance, { color: hasDues ? '#E74C3C' : '#2ECC71' }]}>
              ₹{item.currentBalance}
            </Text>
            <Text style={styles.label}>
              {hasDues ? 'OUTSTANDING' : 'CLEAR'}
            </Text>
          </View>
        </Card.Content>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <Searchbar
        placeholder="Search customer by name or phone..."
        value={search}
        onChangeText={(text) => {
          setSearch(text);
          setPage(1);
        }}
        style={styles.searchbar}
      />

      <SegmentedButtons
        value={status}
        onValueChange={(val) => {
          setStatus(val);
          setPage(1);
        }}
        buttons={[
          { value: '', label: 'All Customers' },
          { value: 'outstanding', label: 'Udhaar / Outstanding' },
        ]}
        style={styles.segmented}
      />

      {isLoading && page === 1 ? (
        <ActivityIndicator style={{ flex: 1 }} />
      ) : (
        <FlatList
          data={data?.data || []}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 24 }}
          ListEmptyComponent={
            <Text style={styles.empty}>No customer records found.</Text>
          }
          onEndReached={() => {
            const totalPages = data?.pagination?.totalPages || 1;
            if (page < totalPages) {
              setPage((prev) => prev + 1);
            }
          }}
          onEndReachedThreshold={0.5}
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
  searchbar: {
    marginBottom: 12,
    backgroundColor: '#1E1E1E',
  },
  segmented: {
    marginBottom: 12,
  },
  card: {
    marginVertical: 6,
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
  },
  cardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  name: {
    fontWeight: 'bold',
    fontSize: 15,
    color: '#FFFFFF',
  },
  balanceContainer: {
    alignItems: 'flex-end',
  },
  balance: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  label: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#FFFFFF',
    backgroundColor: '#2D2D2D',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    marginTop: 4,
  },
  empty: {
    textAlign: 'center',
    marginTop: 36,
    color: '#A0A0A0',
  },
});
