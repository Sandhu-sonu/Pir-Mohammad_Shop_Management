import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuthStore } from '../stores/authStore';
import { LoginScreen } from '../screens/LoginScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { InventoryScreen } from '../screens/InventoryScreen';
import { CustomerScreen } from '../screens/CustomerScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { IconButton } from 'react-native-paper';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const TabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={() => ({
        tabBarActiveTintColor: '#FF6B6B',
        tabBarInactiveTintColor: '#888888',
        tabBarStyle: {
          backgroundColor: '#1E1E1E',
          borderTopColor: '#2D2D2D',
          height: 60,
          paddingBottom: 8,
        },
        headerStyle: {
          backgroundColor: '#1E1E1E',
          borderBottomColor: '#2D2D2D',
          shadowColor: 'transparent',
        },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      })}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          title: 'Summary / ਖੁਲਾਸਾ',
          tabBarIcon: ({ color, size }) => <IconButton icon="view-dashboard" iconColor={color} size={size - 4} />,
        }}
      />
      <Tab.Screen
        name="Inventory"
        component={InventoryScreen}
        options={{
          title: 'Stock / ਸਟਾਕ',
          tabBarIcon: ({ color, size }) => <IconButton icon="package-variant-closed" iconColor={color} size={size - 4} />,
        }}
      />
      <Tab.Screen
        name="Customers"
        component={CustomerScreen}
        options={{
          title: 'Khata / ਖਾਤਾ',
          tabBarIcon: ({ color, size }) => <IconButton icon="account-group" iconColor={color} size={size - 4} />,
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: 'Settings / ਸੈਟਿੰਗਾਂ',
          tabBarIcon: ({ color, size }) => <IconButton icon="cog" iconColor={color} size={size - 4} />,
        }}
      />
    </Tab.Navigator>
  );
};

export const AppNavigator = () => {
  const token = useAuthStore((state) => state.token);

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: '#1E1E1E',
        },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      {token === null ? (
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ headerShown: false }}
        />
      ) : (
        <Stack.Screen
          name="MainTabs"
          component={TabNavigator}
          options={{ headerShown: false }}
        />
      )}
    </Stack.Navigator>
  );
};
