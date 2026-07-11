import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card, Button, Divider, ActivityIndicator, List, useTheme } from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';
import { api, getFriendlyErrorMessage } from '../services/api';
import { useAuthStore } from '../stores/authStore';

export const SettingsScreen = () => {
  const theme = useTheme();
  const user = useAuthStore((state) => state.user);
  const clearSession = useAuthStore((state) => state.clearSession);

  // Local state for Language & Theme visual toggle
  const [lang, setLang] = useState('en'); // 'en' or 'pa'
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Fetch shop settings information
  const { data: shopSettings, isLoading, error } = useQuery({
    queryKey: ['shopSettings'],
    queryFn: async () => {
      const res = await api.get('/settings');
      return res.data.data;
    },
  });

  const handleLogout = async () => {
    await clearSession();
  };

  return (
    <ScrollView style={styles.container}>
      {/* 1. Owner Profile Section */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.title}>
            Owner Profile / ਮਾਲਕ ਪ੍ਰੋਫਾਈਲ
          </Text>
          <Divider style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.bold}>Owner Name:</Text>
            <Text style={styles.value}>{user?.name || 'N/A'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.bold}>Mobile Number:</Text>
            <Text style={styles.value}>{user?.mobile || 'N/A'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.bold}>Access Role:</Text>
            <Text style={[styles.value, { color: '#FF6B6B', fontWeight: 'bold' }]}>
              {user?.role || 'OWNER'}
            </Text>
          </View>
        </Card.Content>
      </Card>

      {/* 2. Shop Details Section */}
      {isLoading ? (
        <ActivityIndicator size="small" color="#FF6B6B" style={{ marginVertical: 24 }} />
      ) : error || !shopSettings ? (
        <Card style={styles.card}>
          <Card.Content>
            <Text style={{ color: theme.colors.error, textAlign: 'center', fontWeight: 'bold' }}>
              Failed to load shop profile data.
            </Text>
            <Text style={{ color: theme.colors.outline, textAlign: 'center', marginTop: 8, fontSize: 11 }}>
              {error ? getFriendlyErrorMessage(error) : 'No settings received'}
            </Text>
          </Card.Content>
        </Card>
      ) : (
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.title}>
              Shop Information / ਦੁਕਾਨ ਦਾ ਵੇਰਵਾ
            </Text>
            <Divider style={styles.divider} />
            <View style={styles.row}>
              <Text style={styles.bold}>Shop Name:</Text>
              <Text style={styles.value}>{shopSettings.name}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.bold}>Address:</Text>
              <Text style={[styles.value, { maxWidth: 200, textAlign: 'right' }]}>
                {shopSettings.address || 'N/A'}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.bold}>Phone / Phone:</Text>
              <Text style={styles.value}>{shopSettings.phone || 'N/A'}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.bold}>GSTIN:</Text>
              <Text style={styles.value}>{shopSettings.gst || 'N/A'}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.bold}>Business Type:</Text>
              <Text style={styles.value}>{shopSettings.businessType}</Text>
            </View>
          </Card.Content>
        </Card>
      )}

      {/* 3. Language Selection */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.title}>
            Language / ਭਾਸ਼ਾ
          </Text>
          <Divider style={styles.divider} />
          <View style={styles.buttonToggleRow}>
            <Button
              mode={lang === 'en' ? 'contained' : 'outlined'}
              onPress={() => setLang('en')}
              style={styles.toggleBtn}
              compact
            >
              English
            </Button>
            <Button
              mode={lang === 'pa' ? 'contained' : 'outlined'}
              onPress={() => setLang('pa')}
              style={styles.toggleBtn}
              compact
            >
              ਪੰਜਾਬੀ
            </Button>
          </View>
        </Card.Content>
      </Card>

      {/* 4. Theme Selection */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.title}>
            Theme / ਥੀਮ
          </Text>
          <Divider style={styles.divider} />
          <View style={styles.buttonToggleRow}>
            <Button
              mode={!isDarkMode ? 'contained' : 'outlined'}
              onPress={() => setIsDarkMode(false)}
              style={styles.toggleBtn}
              icon="weather-sunny"
              compact
            >
              Light
            </Button>
            <Button
              mode={isDarkMode ? 'contained' : 'outlined'}
              onPress={() => setIsDarkMode(true)}
              style={styles.toggleBtn}
              icon="weather-night"
              compact
            >
              Dark
            </Button>
          </View>
        </Card.Content>
      </Card>

      {/* 5. Software Details & Logout */}
      <Card style={styles.card}>
        <Card.Content style={{ alignItems: 'center' }}>
          <Text style={{ color: theme.colors.outline, fontSize: 13 }}>
            PRMS Mobile App v1.0.0 (Minimal Scope)
          </Text>
          <Text style={{ color: theme.colors.outline, fontSize: 11, marginTop: 4, textAlign: 'center' }}>
            Sher-E-Punjab Retail Management System
          </Text>
          
          <Button
            mode="contained"
            icon="logout"
            onPress={handleLogout}
            style={styles.logoutButton}
            contentStyle={{ height: 44 }}
          >
            Log Out / ਲਾਗ ਆਉਟ
          </Button>
        </Card.Content>
      </Card>

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
    alignItems: 'center',
    paddingVertical: 8,
  },
  bold: {
    fontWeight: 'bold',
    color: '#A0A0A0',
  },
  value: {
    color: '#FFFFFF',
  },
  buttonToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  toggleBtn: {
    flex: 1,
    marginHorizontal: 4,
    borderRadius: 8,
  },
  logoutButton: {
    marginTop: 20,
    width: '100%',
    backgroundColor: '#E74C3C',
    borderRadius: 8,
  },
});
