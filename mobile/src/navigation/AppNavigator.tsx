import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuthStore } from '../stores/authStore';
import { LoginScreen } from '../screens/LoginScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { SalesScreen } from '../screens/SalesScreen';
import { InventoryScreen } from '../screens/InventoryScreen';
import { CustomerScreen } from '../screens/CustomerScreen';
import { SupplierScreen } from '../screens/SupplierScreen';
import { ReportScreen } from '../screens/ReportScreen';
import { ClosingScreen } from '../screens/ClosingScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { IconButton } from 'react-native-paper';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const TabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
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
          title: 'Summary',
          tabBarIcon: ({ color, size }) => <IconButton icon="view-dashboard" iconColor={color} size={size - 4} />,
        }}
      />
      <Tab.Screen
        name="Sales"
        component={SalesScreen}
        options={{
          title: 'Bills',
          tabBarIcon: ({ color, size }) => <IconButton icon="receipt" iconColor={color} size={size - 4} />,
        }}
      />
      <Tab.Screen
        name="Inventory"
        component={InventoryScreen}
        options={{
          title: 'Stock',
          tabBarIcon: ({ color, size }) => <IconButton icon="package-variant-closed" iconColor={color} size={size - 4} />,
        }}
      />
      <Tab.Screen
        name="Customers"
        component={CustomerScreen}
        options={{
          title: 'Khata',
          tabBarIcon: ({ color, size }) => <IconButton icon="account-group" iconColor={color} size={size - 4} />,
        }}
      />
      <Tab.Screen
        name="Suppliers"
        component={SupplierScreen}
        options={{
          title: 'Suppliers',
          tabBarIcon: ({ color, size }) => <IconButton icon="truck" iconColor={color} size={size - 4} />,
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
        <>
          <Stack.Screen
            name="MainTabs"
            component={TabNavigator}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Reports"
            component={ReportScreen}
            options={{ title: 'Business Reports' }}
          />
          <Stack.Screen
            name="Closing"
            component={ClosingScreen}
            options={{ title: 'Closing Logs' }}
          />
          <Stack.Screen
            name="Settings"
            component={SettingsScreen}
            options={{ title: 'Shop Settings' }}
          />
        </>
      )}
    </Stack.Navigator>
  );
};
