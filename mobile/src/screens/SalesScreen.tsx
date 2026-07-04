import React, { useState } from 'react';
import { View, StyleSheet, FlatList, ViewStyle } from 'react-native';
import { Text, Searchbar, Card, Portal, Dialog, Button, useTheme, ActivityIndicator, Divider } from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

export const SalesScreen = () => {
  const theme = useTheme();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);

  // Fetch sales list
  const { data: listData, isLoading: listLoading, refetch } = useQuery({
    queryKey: ['salesList', page, search],
    queryFn: async () => {
      const res = await api.get('/sales', {
        params: {
          page,
          pageSize: 20,
          search,
        },
      });
      return res.data;
    },
  });

  // Fetch single invoice detail
  const { data: detailData, isLoading: detailLoading } = useQuery({
    queryKey: ['saleDetails', selectedSaleId],
    queryFn: async () => {
      if (!selectedSaleId) return null;
      const res = await api.get('/sales', {
        params: { id: selectedSaleId },
      });
      return res.data.data;
    },
    enabled: !!selectedSaleId,
  });

  const renderItem = ({ item }: { item: any }) => (
    <Card style={styles.card} onPress={() => setSelectedSaleId(item.id)}>
      <Card.Content style={styles.cardContent}>
        <View>
          <Text style={styles.invoice}>{item.invoiceNumber}</Text>
          <Text style={{ color: theme.colors.outline, fontSize: 12 }}>
            {new Date(item.date).toLocaleDateString()} | {item.customerName}
          </Text>
        </View>
        <View style={styles.amountContainer}>
          <Text style={styles.amount}>₹{item.total}</Text>
          <Text style={[styles.method, { backgroundColor: item.paymentMethod === 'CREDIT' ? '#E74C3C' : '#2D2D2D' }]}>
            {item.paymentMethod}
          </Text>
        </View>
      </Card.Content>
    </Card>
  );

  return (
    <View style={styles.container}>
      <Searchbar
        placeholder="Search invoice number or Gurbaksh..."
        value={search}
        onChangeText={(text) => {
          setSearch(text);
          setPage(1);
        }}
        style={styles.searchbar}
      />

      {listLoading && page === 1 ? (
        <ActivityIndicator style={{ flex: 1 }} />
      ) : (
        <FlatList
          data={listData?.data || []}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 24 }}
          ListEmptyComponent={
            <Text style={styles.empty}>No sales records found.</Text>
          }
          onEndReached={() => {
            const totalPages = listData?.pagination?.totalPages || 1;
            if (page < totalPages) {
              setPage((prev) => prev + 1);
            }
          }}
          onEndReachedThreshold={0.5}
        />
      )}

      {/* PORTAL INVOICE RECEIPT VIEW DIALOG */}
      <Portal>
        <Dialog visible={!!selectedSaleId} onDismiss={() => setSelectedSaleId(null)} style={styles.dialog}>
          <Dialog.Title style={styles.dialogTitle}>Invoice Detail / ਬਿੱਲ ਰਸੀਦ</Dialog.Title>
          <Dialog.Content>
            {detailLoading ? (
              <ActivityIndicator size="large" />
            ) : detailData ? (
              <View>
                <View style={styles.row}>
                  <Text style={styles.bold}>Invoice No:</Text>
                  <Text>{detailData.invoiceNumber}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.bold}>Date:</Text>
                  <Text>{new Date(detailData.date).toLocaleString()}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.bold}>Customer:</Text>
                  <Text>{detailData.customer ? detailData.customer.name : 'Walk-in'}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.bold}>Cashier:</Text>
                  <Text>{detailData.cashier}</Text>
                </View>

                <Divider style={{ marginVertical: 8 }} />

                <Text style={styles.bold}>Items Breakdown:</Text>
                {detailData.items.map((item: any) => (
                  <View key={item.id} style={styles.itemRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#FFFFFF' }}>{item.nameEn}</Text>
                      <Text style={{ fontSize: 11, color: '#A0A0A0' }}>{item.namePa}</Text>
                    </View>
                    <Text style={{ width: 80, textAlign: 'right' }}>
                      {item.quantity} × ₹{item.sellingPrice}
                    </Text>
                    <Text style={{ width: 80, textAlign: 'right', fontWeight: 'bold', color: '#2ECC71' }}>
                      ₹{item.total}
                    </Text>
                  </View>
                ))}

                <Divider style={{ marginVertical: 8 }} />

                <View style={styles.row}>
                  <Text>Subtotal:</Text>
                  <Text>₹{detailData.subTotal}</Text>
                </View>
                <View style={styles.row}>
                  <Text>Discount:</Text>
                  <Text style={{ color: '#E74C3C' }}>-₹{detailData.discount}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.bold}>Total Amount:</Text>
                  <Text style={[styles.bold, { color: '#2ECC71', fontSize: 16 }]}>₹{detailData.total}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.bold}>Payment Method:</Text>
                  <Text>{detailData.paymentMethod}</Text>
                </View>
                <View style={styles.row}>
                  <Text>Amount Paid:</Text>
                  <Text>₹{detailData.paidAmount}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.bold}>Outstanding Due:</Text>
                  <Text style={[styles.bold, { color: '#E74C3C' }]}>₹{detailData.dueAmount}</Text>
                </View>
              </View>
            ) : null}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setSelectedSaleId(null)}>Close / ਬੰਦ ਕਰੋ</Button>
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
    marginBottom: 12,
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
  invoice: {
    fontWeight: 'bold',
    fontSize: 15,
    color: '#FFFFFF',
  },
  amountContainer: {
    alignItems: 'flex-end',
  },
  amount: {
    fontWeight: 'bold',
    fontSize: 16,
    color: '#2ECC71',
  },
  method: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#FFFFFF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
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
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 0.2,
    borderBottomColor: '#3A3A3A',
  },
  bold: {
    fontWeight: 'bold',
  },
});
