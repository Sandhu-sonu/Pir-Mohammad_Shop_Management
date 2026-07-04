import React, { useState } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { Text, Searchbar, Card, SegmentedButtons, ActivityIndicator, useTheme } from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

export const InventoryScreen = () => {
  const theme = useTheme();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState(''); // '', 'low', 'out'

  const { data, isLoading } = useQuery({
    queryKey: ['inventoryList', page, search, status],
    queryFn: async () => {
      const res = await api.get('/inventory', {
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
    const isLow = item.currentQuantity <= item.minStock;
    const isOut = item.currentQuantity <= 0;
    
    let badgeColor = '#2ECC71';
    let badgeText = 'IN STOCK';
    if (isOut) {
      badgeColor = '#E74C3C';
      badgeText = 'OUT OF STOCK';
    } else if (isLow) {
      badgeColor = '#E67E22';
      badgeText = 'LOW STOCK';
    }

    return (
      <Card style={styles.card}>
        <Card.Content style={styles.cardContent}>
          <View style={{ flex: 1 }}>
            <Text style={styles.nameEn}>{item.nameEn}</Text>
            <Text style={styles.namePa}>{item.namePa || 'No Punjabi translation'}</Text>
            <Text style={{ color: theme.colors.outline, fontSize: 11, marginTop: 4 }}>
              SKU: {item.sku} | Barcode: {item.barcode || 'N/A'}
            </Text>
          </View>
          <View style={styles.stockContainer}>
            <Text style={[styles.qty, { color: badgeColor }]}>
              {item.currentQuantity} {item.unit}
            </Text>
            <Text style={[styles.badge, { backgroundColor: badgeColor }]}>
              {badgeText}
            </Text>
            <Text style={styles.price}>
              Sell: ₹{item.sellingPrice}
            </Text>
          </View>
        </Card.Content>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <Searchbar
        placeholder="Search product by name, SKU..."
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
          { value: '', label: 'All Stock' },
          { value: 'low', label: 'Low Stock' },
          { value: 'out', label: 'Out of Stock' },
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
            <Text style={styles.empty}>No inventory records found.</Text>
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
  nameEn: {
    fontWeight: 'bold',
    fontSize: 15,
    color: '#FFFFFF',
  },
  namePa: {
    fontSize: 13,
    color: '#A0A0A0',
  },
  stockContainer: {
    alignItems: 'flex-end',
  },
  qty: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  badge: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#FFFFFF',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    marginTop: 2,
    textAlign: 'center',
  },
  price: {
    fontSize: 11,
    color: '#FFFFFF',
    marginTop: 4,
    fontWeight: '500',
  },
  empty: {
    textAlign: 'center',
    marginTop: 36,
    color: '#A0A0A0',
  },
});
