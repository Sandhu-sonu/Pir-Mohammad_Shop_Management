import React, { useState, useEffect } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { TextInput, Button, Text, Checkbox, useTheme, ActivityIndicator } from 'react-native-paper';
import { useAuthStore } from '../stores/authStore';
import axios from 'axios';
import * as LocalAuthentication from 'expo-local-authentication';
import { API_BASE_URL } from '../services/api';

export const LoginScreen = () => {
  const theme = useTheme();
  const setSession = useAuthStore((state) => state.setSession);
  const rememberMe = useAuthStore((state) => state.rememberMe);
  const setRememberMe = useAuthStore((state) => state.setRememberMe);

  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasBiometrics, setHasBiometrics] = useState(false);

  useEffect(() => {
    (async () => {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      setHasBiometrics(compatible && enrolled);
    })();
  }, []);

  const handleLogin = async () => {
    if (!mobile || !password) {
      setError('ਕਿਰਪਾ ਕਰਕੇ ਮੋਬਾਈਲ ਅਤੇ ਪਾਸਵਰਡ ਭਰੋ (Enter mobile and password)');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await axios.post(`${API_BASE_URL}/auth`, {
        mobile,
        password,
      });

      if (res.data.success) {
        await setSession(res.data.token, res.data.user);
      } else {
        setError(res.data.error || 'Login failed');
      }
    } catch (err: any) {
      console.error(err);
      setError(
        err.response?.data?.error || 
        'ਕਨੈਕਸ਼ਨ ਅਸਫਲ ਰਿਹਾ (Backend connection failed. Verify URL/Network.)'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricAuth = async () => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Authenticate to access PRMS',
      fallbackLabel: 'Use Password',
    });

    if (result.success) {
      // Stub: in real usage, we decrypt credentials saved in SecureStore to log in
      setError('Biometric authentication succeeded!');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text variant="headlineMedium" style={styles.title}>
            PRMS Owner App
          </Text>
          <Text variant="bodyLarge" style={{ color: theme.colors.outline }}>
            ਸ਼ੇਰ-ਏ-ਪੰਜਾਬ ਰਿਟੇਲ ਮੈਨੇਜਮੈਂਟ
          </Text>
        </View>

        <View style={styles.form}>
          {error ? (
            <Text style={[styles.error, { color: theme.colors.error }]} variant="bodyMedium">
              {error}
            </Text>
          ) : null}

          <TextInput
            label="Mobile Number / ਮੋਬਾਈਲ"
            value={mobile}
            onChangeText={setMobile}
            mode="outlined"
            keyboardType="phone-pad"
            style={styles.input}
            left={<TextInput.Icon icon="phone" />}
          />

          <TextInput
            label="Password / ਪਾਸਵਰਡ"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            mode="outlined"
            style={styles.input}
            left={<TextInput.Icon icon="lock" />}
          />

          <View style={styles.row}>
            <View style={styles.checkboxRow}>
              <Checkbox
                status={rememberMe ? 'checked' : 'unchecked'}
                onPress={() => setRememberMe(!rememberMe)}
              />
              <Text variant="bodyMedium">Remember Me</Text>
            </View>
          </View>

          <Button
            mode="contained"
            onPress={handleLogin}
            disabled={loading}
            style={styles.button}
            contentStyle={styles.buttonContent}
          >
            {loading ? <ActivityIndicator color="#FFFFFF" /> : 'Log In / ਲਾਗਇਨ'}
          </Button>

          {hasBiometrics && (
            <Button
              mode="outlined"
              onPress={handleBiometricAuth}
              style={styles.biometricBtn}
              icon="fingerprint"
            >
              Use Biometrics
            </Button>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 36,
  },
  title: {
    fontWeight: 'bold',
    color: '#FF6B6B',
  },
  form: {
    backgroundColor: '#1E1E1E',
    padding: 20,
    borderRadius: 16,
  },
  input: {
    marginBottom: 16,
    backgroundColor: '#1E1E1E',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  button: {
    marginTop: 8,
    borderRadius: 8,
  },
  buttonContent: {
    height: 48,
  },
  biometricBtn: {
    marginTop: 16,
    borderRadius: 8,
  },
  error: {
    marginBottom: 16,
    textAlign: 'center',
    fontWeight: 'bold',
  },
});
