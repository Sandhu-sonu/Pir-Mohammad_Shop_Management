import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { TextInput, Button, Text, Checkbox, useTheme, ActivityIndicator } from 'react-native-paper';
import { useAuthStore } from '../stores/authStore';
import axios from 'axios';
import { API_BASE_URL, getFriendlyErrorMessage } from '../services/api';

export const LoginScreen = () => {
  const theme = useTheme();
  const setSession = useAuthStore((state) => state.setSession);
  const rememberMe = useAuthStore((state) => state.rememberMe);
  const setRememberMe = useAuthStore((state) => state.setRememberMe);

  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    // 1. Clean Inputs
    const cleanMobile = mobile.trim();
    const cleanPassword = password.trim();

    // 2. Client-side Validation
    if (!cleanMobile) {
      setError('ਕਿਰਪਾ ਕਰਕੇ ਮੋਬਾਈਲ ਨੰਬਰ ਭਰੋ (Please enter mobile number)');
      return;
    }
    
    // Check for a standard Indian 10-digit mobile number format
    if (!/^\d{10}$/.test(cleanMobile)) {
      setError('ਕਿਰਪਾ ਕਰਕੇ 10-ਅੰਕਾਂ ਦਾ ਮੋਬਾਈਲ ਨੰਬਰ ਭਰੋ (Please enter a valid 10-digit mobile number)');
      return;
    }

    if (!cleanPassword) {
      setError('ਕਿਰਪਾ ਕਰਕੇ ਪਾਸਵਰਡ ਭਰੋ (Please enter password)');
      return;
    }

    if (cleanPassword.length < 6) {
      setError('ਪਾਸਵਰਡ ਘੱਟੋ-ਘੱਟ 6 ਅੱਖਰਾਂ ਦਾ ਹੋਣਾ ਚਾਹੀਦਾ ਹੈ (Password must be at least 6 characters)');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await axios.post(`${API_BASE_URL}/auth`, {
        mobile: cleanMobile,
        password: cleanPassword,
      });

      if (res.data.success) {
        await setSession(res.data.token, res.data.user);
      } else {
        setError(res.data.error || 'లాగిన్ విఫలమైంది (Login failed)');
      }
    } catch (err: any) {
      console.error('Login error details:', err);
      const friendlyErr = getFriendlyErrorMessage(err);
      setError(friendlyErr);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text variant="headlineMedium" style={styles.title}>
            PRMS Owner App
          </Text>
          <Text variant="bodyLarge" style={{ color: theme.colors.outline, marginTop: 4 }}>
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
            onChangeText={(text) => {
              setMobile(text);
              if (error) setError('');
            }}
            mode="outlined"
            keyboardType="phone-pad"
            style={styles.input}
            left={<TextInput.Icon icon="phone" />}
            disabled={loading}
            maxLength={10}
          />

          <TextInput
            label="Password / ਪਾਸਵਰਡ"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              if (error) setError('');
            }}
            secureTextEntry
            mode="outlined"
            style={styles.input}
            left={<TextInput.Icon icon="lock" />}
            disabled={loading}
          />

          <View style={styles.row}>
            <View style={styles.checkboxRow}>
              <Checkbox
                status={rememberMe ? 'checked' : 'unchecked'}
                onPress={() => setRememberMe(!rememberMe)}
                disabled={loading}
              />
              <Text variant="bodyMedium" style={{ color: '#FFFFFF' }}>Remember Me</Text>
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
    backgroundColor: '#FF6B6B',
  },
  buttonContent: {
    height: 48,
  },
  error: {
    marginBottom: 16,
    textAlign: 'center',
    fontWeight: 'bold',
  },
});
