import React, { useState } from 'react';
import { View, StyleSheet, FlatList, ScrollView } from 'react-native';
import { Text, Searchbar, Card, Chip, Portal, Dialog, Button, ActivityIndicator, useTheme } from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

export const InventoryScreen = () => {
  const theme = useTheme();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);

  // 1. Fetch categories from settings (shares cache with SettingsScreen)
  const { data: settingsData } = useQuery({
    queryKey: ['shopSettings'],
    queryFn: async () => {
      const res = await api.get('/settings');
      return res.data.data;
    },
  });
  const categories = settingsData?.categories || [];

  // 2. Fetch products list
  const { data: inventoryData, isLoading } = useQuery({
    queryKey: ['inventoryList', page, search, selectedCategory],
    queryFn: async () => {
      const res = await api.get('/inventory', {
        params: {
          page,
          pageSize: 20,
          search,
          categoryId: selectedCategory,
        },
      });
      return res.data;
    },
  });

  const renderItem = ({ item }: { item: any }) => {
    const isLow = item.currentQuantity <= item.minStock;
    const isOut = item.currentQuantity <= 0;
    
    let statusColor = '#2ECC71';
    let statusText = 'In Stock';
    if (isOut) {
      statusColor = '#E74C3C';
      statusText = 'Out of Stock';
    } else if (isLow) {
      statusColor = '#E67E22';
      statusText = 'Low Stock';
    }

    return (
      <Card style={styles.card} onPress={() => setSelectedProduct(item)}>
        <Card.Content style={styles.cardContent}>
          <View style={{ flex: 1 }}>
            <Text style={styles.nameEn}>{item.nameEn}</Text>
            <Text style={styles.namePa}>{item.namePa || 'No Punjabi translation'}</Text>
            <Text style={{ color: theme.colors.outline, fontSize: 11, marginTop: 4 }}>
              Category: {item.category}
            </Text>
          </View>
          <View style={styles.stockContainer}>
            <Text style={[styles.qty, { color: statusColor }]}>
              {item.currentQuantity} {item.unit}
            </Text>
            <Text style={[styles.badge, { backgroundColor: statusColor }]}>
              {statusText.toUpperCase()}
            </Text>
          </View>
        </Card.Content>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      {/* Search Input */}
      <Searchbar
        placeholder="Search product..."
        value={search}
        onChangeText={(text) => {
          setSearch(text);
          setPage(1);
        }}
        style={styles.searchbar}
      />

      {/* Category Horizontal filter chips */}
      <View style={styles.filterWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
          <Chip
            selected={selectedCategory === ''}
            onPress={() => {
              setSelectedCategory('');
              setPage(1);
            }}
            style={styles.chip}
            selectedColor="#FF6B6B"
            showSelectedOverlay
          >
            All Stock
          </Chip>
          {categories.map((cat: any) => (
            <Chip
              key={cat.id}
              selected={selectedCategory === cat.id}
              onPress={() => {
                setSelectedCategory(cat.id);
                setPage(1);
              }}
              style={styles.chip}
              selectedColor="#FF6B6B"
              showSelectedOverlay
            >
              {cat.name}
            </Chip>
          ))}
        </ScrollView>
      </View>

      {/* Products List View */}
      {isLoading && page === 1 ? (
        <ActivityIndicator style={{ flex: 1 }} color="#FF6B6B" />
      ) : (
        <FlatList
          data={inventoryData?.data || []}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 24 }}
          ListEmptyComponent={
            <Text style={styles.empty}>No inventory records found.</Text>
          }
          onEndReached={() => {
            const totalPages = inventoryData?.pagination?.totalPages || 1;
            if (page < totalPages) {
              setPage((prev) => prev + 1);
            }
          }}
          onEndReachedThreshold={0.5}
        />
      )}

      {/* Product Details dialog popup */}
      <Portal>
        <Dialog visible={!!selectedProduct} onDismiss={() => setSelectedProduct(null)} style={styles.dialog}>
          <Dialog.Title style={styles.dialogTitle}>Product Details</Dialog.Title>
          <Dialog.Content>
            {selectedProduct && (
              <View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Product Name (EN):</Text>
                  <Text style={styles.detailValue}>{selectedProduct.nameEn}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Product Name (PA):</Text>
                  <Text style={styles.detailValuePa}>{selectedProduct.namePa || 'N/A'}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Category:</Text>
                  <Text style={styles.detailValue}>{selectedProduct.category}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Selling Price:</Text>
                  <Text style={[styles.detailValue, { color: '#2ECC71', fontWeight: 'bold' }]}>
                    ₹{selectedProduct.sellingPrice}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Purchase Price:</Text>
                  <Text style={styles.detailValue}>₹{selectedProduct.purchasePrice}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Current Stock:</Text>
                  <Text style={[styles.detailValue, { fontWeight: 'bold' }]}>
                    {selectedProduct.currentQuantity} {selectedProduct.unit}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Low Stock Threshold:</Text>
                  <Text style={styles.detailValue}>
                    {selectedProduct.minStock} {selectedProduct.unit}
                  </Text>
                </View>
              </View>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setSelectedProduct(null)} labelStyle={{ color: '#FF6B6B' }}>
              Close / ਬੰਦ ਕਰੋ
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
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
    marginBottom: 8,
    backgroundColor: '#1E1E1E',
  },
  filterWrapper: {
    marginBottom: 12,
  },
  chipScroll: {
    paddingVertical: 4,
  },
  chip: {
    marginRight: 8,
    backgroundColor: '#1E1E1E',
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
    marginTop: 2,
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
    marginTop: 4,
    textAlign: 'center',
  },
  empty: {
    textAlign: 'center',
    marginTop: 36,
    color: '#A0A0A0',
  },
  dialog: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
  },
  dialogTitle: {
    color: '#FF6B6B',
    fontWeight: 'bold',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: '#2D2D2D',
  },
  detailLabel: {
    color: '#A0A0A0',
    fontWeight: '500',
  },
  detailValue: {
    color: '#FFFFFF',
  },
  detailValuePa: {
    color: '#E0E0E0',
  },
});
