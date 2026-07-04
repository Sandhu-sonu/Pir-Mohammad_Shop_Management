import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card, Button, Divider, ActivityIndicator, List, useTheme, Portal, Dialog } from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { useAuthStore } from '../stores/authStore';

export const SettingsScreen = () => {
  const theme = useTheme();
  const clearSession = useAuthStore((state) => state.clearSession);
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupStatus, setBackupStatus] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['shopSettings'],
    queryFn: async () => {
      const res = await api.get('/settings');
      return res.data.data;
    },
  });

  const handleBackup = async () => {
    setBackupLoading(true);
    setBackupStatus('');
    try {
      const res = await api.post('/backup', { notes: 'Triggered from Owner Mobile App' });
      if (res.data.success) {
        setBackupStatus('ਬੈਕਅੱਪ ਸਫਲ (Backup successfully created!)');
      } else {
        setBackupStatus('Backup failed.');
      }
    } catch (err: any) {
      console.error(err);
      setBackupStatus(err.response?.data?.error || 'Backup creation failed.');
    } finally {
      setBackupLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      {isLoading ? (
        <ActivityIndicator size="large" style={{ marginTop: 48 }} />
      ) : data ? (
        <View>
          {/* Shop Profile Info */}
          <Card style={styles.card}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.title}>Shop Information / ਦੁਕਾਨ ਦਾ ਵੇਰਵਾ</Text>
              <Divider style={styles.divider} />
              <View style={styles.row}><Text style={styles.bold}>Shop Name:</Text><Text>{data.name}</Text></View>
              <View style={styles.row}><Text style={styles.bold}>Address:</Text><Text style={{ maxWidth: 200, textAlign: 'right' }}>{data.address}</Text></View>
              <View style={styles.row}><Text style={styles.bold}>GSTIN:</Text><Text>{data.gst}</Text></View>
              <View style={styles.row}><Text style={styles.bold}>Business Type:</Text><Text>{data.businessType}</Text></View>
            </Card.Content>
          </Card>

          {/* Sizing Statistics */}
          <Card style={styles.card}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.title}>Database Status / ਡਾਟਾਬੇਸ ਸਥਿਤੀ</Text>
              <Divider style={styles.divider} />
              <View style={styles.row}><Text>Total Products in Inventory:</Text><Text style={styles.bold}>{data.stats.productsCount}</Text></View>
              <View style={styles.row}><Text>Total Sales Invoices Logged:</Text><Text style={styles.bold}>{data.stats.salesCount}</Text></View>
              <View style={styles.row}><Text>Total Registered Customers:</Text><Text style={styles.bold}>{data.stats.customersCount}</Text></View>
            </Card.Content>
          </Card>

          {/* Actions & Utilities */}
          <Card style={styles.card}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.title}>Backup Utilities / ਬੈਕਅੱਪ</Text>
              <Divider style={styles.divider} />
              {backupStatus ? (
                <Text style={{ textAlign: 'center', marginVertical: 8, fontWeight: 'bold', color: theme.colors.primary }}>
                  {backupStatus}
                </Text>
              ) : null}
              <Button
                mode="outlined"
                icon="cloud-upload"
                onPress={handleBackup}
                loading={backupLoading}
                disabled={backupLoading}
                style={styles.button}
              >
                Trigger Manual Backup
              </Button>
            </Card.Content>
          </Card>

          {/* Software Version details */}
          <Card style={styles.card}>
            <Card.Content style={{ alignItems: 'center' }}>
              <Text style={{ color: theme.colors.outline }}>PRMS Mobile App v1.0.0 (Beta)</Text>
              <Text style={{ color: theme.colors.outline, fontSize: 11, marginTop: 4 }}>
                Powered by Sher-E-Punjab Retail Backend
              </Text>
              <Button
                mode="contained"
                onPress={() => clearSession()}
                style={[styles.button, { marginTop: 16, width: '100%', backgroundColor: '#E74C3C' }]}
                contentStyle={{ height: 44 }}
              >
                Log Out / ਲਾਗ ਆਉਟ
              </Button>
            </Card.Content>
          </Card>
        </View>
      ) : null}
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
  card: {
    marginVertical: 8,
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
  },
  title: {
    fontWeight: 'bold',
    color: '#FF6B6B',
  },
  divider: {
    marginVertical: 8,
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
  button: {
    borderRadius: 8,
    marginVertical: 6,
  },
});
