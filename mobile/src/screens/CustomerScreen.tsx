import React, { useState } from 'react';
import { View, StyleSheet, FlatList, ScrollView, Linking } from 'react-native';
import { Text, Searchbar, Card, SegmentedButtons, Portal, Dialog, Button, ActivityIndicator, useTheme, Divider, IconButton } from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

export const CustomerScreen = () => {
  const theme = useTheme();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState(''); // '', 'outstanding'
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  // 1. Fetch customer list
  const { data: listData, isLoading: listLoading } = useQuery({
    queryKey: ['customersList', page, search, status],
    queryFn: async () => {
      const res = await api.get('/customers', {
        params: {
          page,
          pageSize: 20,
          search,
          status,
        },
      });
      return res.data;
    },
  });

  // 2. Fetch selected customer details & ledger logs
  const { data: detailsData, isLoading: detailsLoading } = useQuery({
    queryKey: ['customerDetails', selectedCustomerId],
    queryFn: async () => {
      if (!selectedCustomerId) return null;
      const res = await api.get('/customers', {
        params: { id: selectedCustomerId },
      });
      return res.data.data;
    },
    enabled: !!selectedCustomerId,
  });

  const handleCall = (mobile: string) => {
    if (!mobile) return;
    Linking.openURL(`tel:${mobile}`);
  };

  const renderItem = ({ item }: { item: any }) => {
    const hasDues = item.currentBalance > 0;
    
    return (
      <Card style={styles.card} onPress={() => setSelectedCustomerId(item.id)}>
        <Card.Content style={styles.cardContent}>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={{ color: theme.colors.outline, fontSize: 12, marginTop: 4 }}>
              Mob: {item.mobile || 'N/A'} | Address: {item.address || 'N/A'}
            </Text>
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
      {/* Searchbar */}
      <Searchbar
        placeholder="Search customer by name or phone..."
        value={search}
        onChangeText={(text) => {
          setSearch(text);
          setPage(1);
        }}
        style={styles.searchbar}
      />

      {/* Segmented Buttons for Outstanding/All */}
      <SegmentedButtons
        value={status}
        onValueChange={(val) => {
          setStatus(val);
          setPage(1);
        }}
        buttons={[
          { value: '', label: 'All Customers' },
          { value: 'outstanding', label: 'Outstanding / ਉਧਾਰ' },
        ]}
        style={styles.segmented}
      />

      {/* List */}
      {listLoading && page === 1 ? (
        <ActivityIndicator style={{ flex: 1 }} color="#FF6B6B" />
      ) : (
        <FlatList
          data={listData?.data || []}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 24 }}
          ListEmptyComponent={
            <Text style={styles.empty}>No customer records found.</Text>
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

      {/* Customer Profile & Ledger History Dialog */}
      <Portal>
        <Dialog visible={!!selectedCustomerId} onDismiss={() => setSelectedCustomerId(null)} style={styles.dialog}>
          <Dialog.Title style={styles.dialogTitle}>Customer Profile / ਖਾਤਾ ਵੇਰਵਾ</Dialog.Title>
          <Dialog.Content>
            {detailsLoading ? (
              <ActivityIndicator size="large" color="#FF6B6B" />
            ) : detailsData ? (
              <ScrollView style={{ maxHeight: 350 }}>
                {/* Profile Meta details */}
                <View style={styles.profileHeader}>
                  <View style={{ flex: 1 }}>
                    <Text variant="titleLarge" style={styles.profileName}>{detailsData.name}</Text>
                    <Text style={{ color: '#A0A0A0', fontSize: 13, marginTop: 2 }}>
                      Address: {detailsData.address || 'N/A'}
                    </Text>
                    {detailsData.notes ? (
                      <Text style={{ color: '#A0A0A0', fontSize: 12, fontStyle: 'italic', marginTop: 4 }}>
                        Note: {detailsData.notes}
                      </Text>
                    ) : null}
                  </View>
                  {detailsData.mobile ? (
                    <IconButton
                      icon="phone"
                      mode="contained"
                      containerColor="#FF6B6B"
                      iconColor="#FFFFFF"
                      size={24}
                      onPress={() => handleCall(detailsData.mobile)}
                    />
                  ) : null}
                </View>

                <View style={styles.khataSummary}>
                  <Text style={{ color: '#A0A0A0', fontSize: 13 }}>Outstanding Khata Balance / ਉਧਾਰ ਦੇਣਦਾਰੀ</Text>
                  <Text style={[styles.khataBalance, { color: detailsData.currentBalance > 0 ? '#E74C3C' : '#2ECC71' }]}>
                    ₹{detailsData.currentBalance}
                  </Text>
                </View>

                <Divider style={{ marginVertical: 12 }} />

                {/* Ledger logs history */}
                <Text style={styles.historyTitle}>Ledger History / ਲੈਣ-ਦੇਣ ਖਾਤਾ</Text>
                {detailsData.ledger && detailsData.ledger.length > 0 ? (
                  detailsData.ledger.map((log: any) => {
                    const isPurchase = log.type === 'SALE';
                    const isPayment = log.type === 'PAYMENT';

                    let typeLabel = log.type;
                    let typeColor = '#FFFFFF';
                    if (isPurchase) {
                      typeLabel = log.invoiceNumber ? `Purchase (${log.invoiceNumber})` : 'Purchase';
                      typeColor = '#E74C3C';
                    } else if (isPayment) {
                      typeLabel = 'Payment Received / ਜਮ੍ਹਾ';
                      typeColor = '#2ECC71';
                    }

                    return (
                      <View key={log.id} style={styles.ledgerRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.ledgerType, { color: typeColor }]}>{typeLabel}</Text>
                          <Text style={styles.ledgerDate}>
                            {new Date(log.createdAt).toLocaleString()}
                          </Text>
                          {log.note ? <Text style={styles.ledgerNote}>{log.note}</Text> : null}
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={[styles.ledgerAmount, { color: isPayment ? '#2ECC71' : '#E74C3C' }]}>
                            {isPayment ? '-' : '+'}₹{log.amount}
                          </Text>
                          <Text style={styles.ledgerBalance}>Bal: ₹{log.balanceAfter}</Text>
                        </View>
                      </View>
                    );
                  })
                ) : (
                  <Text style={styles.noHistory}>No transaction history logged.</Text>
                )}
              </ScrollView>
            ) : null}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setSelectedCustomerId(null)} labelStyle={{ color: '#FF6B6B' }}>
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
  dialog: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
  },
  dialogTitle: {
    color: '#FF6B6B',
    fontWeight: 'bold',
  },
  profileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  profileName: {
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  khataSummary: {
    backgroundColor: '#2D2D2D',
    padding: 12,
    borderRadius: 8,
    marginVertical: 8,
  },
  khataBalance: {
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 4,
  },
  historyTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  ledgerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#2D2D2D',
  },
  ledgerType: {
    fontWeight: 'bold',
    fontSize: 13,
  },
  ledgerDate: {
    fontSize: 10,
    color: '#888888',
    marginTop: 2,
  },
  ledgerNote: {
    fontSize: 11,
    color: '#A0A0A0',
    marginTop: 2,
    fontStyle: 'italic',
  },
  ledgerAmount: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  ledgerBalance: {
    fontSize: 11,
    color: '#888888',
    marginTop: 2,
  },
  noHistory: {
    color: '#888888',
    fontStyle: 'italic',
    textAlign: 'center',
    marginVertical: 12,
  },
});
