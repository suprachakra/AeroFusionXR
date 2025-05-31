/**
 * AeroFusionXR Mobile Application
 * ==============================
 * 
 * Enterprise-grade React Native mobile application for the AeroFusionXR Aviation Platform.
 * 
 * Features:
 * - 🛫 Real-time flight tracking with push notifications
 * - 📱 Mobile-optimized booking experience
 * - 🎯 Location-based services and indoor navigation
 * - 📷 Camera integration for QR/barcode scanning
 * - 🔔 Push notifications for flight updates
 * - 🧳 Baggage tracking with RFID/NFC scanning
 * - 💳 Mobile payments and digital wallet
 * - 🗺️ Offline maps and navigation
 * - 🤖 Voice-enabled AI concierge
 * - 👆 Biometric authentication
 * - 🌐 Multi-language support
 * - ♿ Accessibility features
 * - 📱 Native platform integrations
 * - 🔄 Offline-first architecture
 * 
 * Architecture:
 * - React Native with TypeScript
 * - Expo managed workflow
 * - Redux Toolkit for state management
 * - React Navigation for navigation
 * - React Query for API state management
 * - Expo SecureStore for secure storage
 * - Expo Location for GPS services
 * - Expo Camera for scanning
 * - Expo Notifications for push notifications
 * - React Native Paper for UI components
 * - i18next for internationalization
 * 
 * Author: AeroFusionXR Team
 * License: Proprietary
 */

import React, { useEffect, useState } from 'react';
import { StatusBar, Platform, Alert, Linking } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { enableScreens } from 'react-native-screens';
import notifee, { AuthorizationStatus } from '@notifee/react-native';
import messaging from '@react-native-firebase/messaging';
import NetInfo from '@react-native-community/netinfo';
import { PaperProvider } from 'react-native-paper';
import { PortalProvider } from '@gorhom/portal';
import Icon from 'react-native-vector-icons/MaterialIcons';

// Store & Theme
import { store } from './src/store/store';
import { theme } from './src/theme/theme';

// Navigation
import { RootStackParamList, MainTabParamList } from './src/types/navigation';

// Screens
import SplashScreen from './src/screens/SplashScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import LoginScreen from './src/screens/auth/LoginScreen';
import RegisterScreen from './src/screens/auth/RegisterScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import FlightInfoScreen from './src/screens/FlightInfoScreen';
import BaggageTrackerScreen from './src/screens/BaggageTrackerScreen';
import WayfindingScreen from './src/screens/WayfindingScreen';
import ARNavigationScreen from './src/screens/ARNavigationScreen';
import AIConciergeScreen from './src/screens/AIConciergeScreen';
import CommerceScreen from './src/screens/CommerceScreen';
import BookingScreen from './src/screens/BookingScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import QRScannerScreen from './src/screens/QRScannerScreen';
import OfflineScreen from './src/screens/OfflineScreen';

// Hooks & Services
import { useAuth } from './src/hooks/useAuth';
import { usePermissions } from './src/hooks/usePermissions';
import { useNotifications } from './src/hooks/useNotifications';
import { LocationService } from './src/services/LocationService';
import { AnalyticsService } from './src/services/AnalyticsService';
import { CrashReportingService } from './src/services/CrashReportingService';
import { OfflineService } from './src/services/OfflineService';

// Components
import LoadingOverlay from './src/components/common/LoadingOverlay';
import ErrorBoundary from './src/components/common/ErrorBoundary';
import NetworkStatusBar from './src/components/common/NetworkStatusBar';

// Types
import { NavigationState } from '@react-navigation/native';

// Enable screens for better performance
enableScreens();

// Navigation Stacks
const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

// Query Client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
});

// Tab Navigator Component
const TabNavigator: React.FC = () => {
  const { isConnected } = useAuth();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: string;

          switch (route.name) {
            case 'Dashboard':
              iconName = 'dashboard';
              break;
            case 'Flights':
              iconName = 'flight';
              break;
            case 'Baggage':
              iconName = 'luggage';
              break;
            case 'Navigate':
              iconName = 'navigation';
              break;
            case 'Concierge':
              iconName = 'chat';
              break;
            default:
              iconName = 'circle';
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.disabled,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.outline,
        },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Flights" component={FlightInfoScreen} />
      <Tab.Screen name="Baggage" component={BaggageTrackerScreen} />
      <Tab.Screen name="Navigate" component={WayfindingScreen} />
      <Tab.Screen name="Concierge" component={AIConciergeScreen} />
    </Tab.Navigator>
  );
};

// Main App Content
const AppContent: React.FC = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const { isAuthenticated, isLoading, user, initialize } = useAuth();
  const { requestPermissions } = usePermissions();
  const { initialize: initializeNotifications } = useNotifications();

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // Initialize crash reporting
      await CrashReportingService.initialize();

      // Initialize analytics
      await AnalyticsService.initialize();

      // Check network connectivity
      const netInfo = await NetInfo.fetch();
      setIsConnected(netInfo.isConnected ?? false);

      // Set up network listener
      const unsubscribeNetInfo = NetInfo.addEventListener(state => {
        setIsConnected(state.isConnected ?? false);
      });

      // Initialize auth
      await initialize();

      // Request necessary permissions
      await requestPermissions();

      // Initialize notifications
      await initializeNotifications();

      // Initialize location services
      await LocationService.initialize();

      // Initialize offline capabilities
      await OfflineService.initialize();

      // Request notification permissions
      await requestNotificationPermissions();

      setIsInitialized(true);

      return () => {
        unsubscribeNetInfo();
      };
    } catch (error) {
      console.error('App initialization error:', error);
      CrashReportingService.recordError(error as Error);
      Alert.alert(
        'Initialization Error',
        'There was an error starting the app. Please restart and try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const requestNotificationPermissions = async () => {
    try {
      // Request notification permissions with notifee
      const settings = await notifee.requestPermission();
      
      if (settings.authorizationStatus >= AuthorizationStatus.AUTHORIZED) {
        console.log('Notification permissions granted');
      }

      // Request Firebase messaging permissions
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (enabled) {
        console.log('Firebase messaging permissions granted');
        
        // Get FCM token
        const token = await messaging().getToken();
        console.log('FCM Token:', token);
        
        // Save token to user profile
        if (user?.id) {
          AnalyticsService.setUserId(user.id);
          // TODO: Send token to backend
        }
      }
    } catch (error) {
      console.error('Notification permission error:', error);
    }
  };

  const handleDeepLink = (url: string) => {
    console.log('Deep link received:', url);
    // TODO: Handle deep link navigation
  };

  useEffect(() => {
    // Handle deep links
    const handleUrl = ({ url }: { url: string }) => {
      handleDeepLink(url);
    };

    const subscription = Linking.addEventListener('url', handleUrl);

    // Handle app launch from deep link
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink(url);
      }
    });

    return () => {
      subscription?.remove();
    };
  }, []);

  const handleNavigationStateChange = (state: NavigationState | undefined) => {
    if (state) {
      // Track screen views
      const currentRoute = state.routes[state.index];
      AnalyticsService.trackScreenView(currentRoute.name);
    }
  };

  if (!isInitialized || isLoading) {
    return <SplashScreen />;
  }

  if (!isConnected) {
    return <OfflineScreen onRetry={() => NetInfo.refresh()} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar
          barStyle={Platform.OS === 'ios' ? 'dark-content' : 'light-content'}
          backgroundColor={theme.colors.primary}
        />
        <NetworkStatusBar />
        
        <NavigationContainer
          onStateChange={handleNavigationStateChange}
          fallback={<LoadingOverlay />}
        >
          <Stack.Navigator
            screenOptions={{
              headerShown: false,
              animation: 'slide_from_right',
            }}
          >
            {!isAuthenticated ? (
              // Auth Flow
              <>
                <Stack.Screen name="Onboarding" component={OnboardingScreen} />
                <Stack.Screen name="Login" component={LoginScreen} />
                <Stack.Screen name="Register" component={RegisterScreen} />
              </>
            ) : (
              // Main App Flow
              <>
                <Stack.Screen name="Main" component={TabNavigator} />
                <Stack.Screen name="ARNavigation" component={ARNavigationScreen} />
                <Stack.Screen name="Commerce" component={CommerceScreen} />
                <Stack.Screen name="Booking" component={BookingScreen} />
                <Stack.Screen name="Profile" component={ProfileScreen} />
                <Stack.Screen name="Settings" component={SettingsScreen} />
                <Stack.Screen name="QRScanner" component={QRScannerScreen} />
              </>
            )}
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

// Main App Component with Providers
const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <PaperProvider theme={theme}>
            <PortalProvider>
              <AppContent />
            </PortalProvider>
          </PaperProvider>
        </QueryClientProvider>
      </Provider>
    </ErrorBoundary>
  );
};

export default App; 