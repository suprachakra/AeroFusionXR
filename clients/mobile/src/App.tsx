import React, { useEffect, useState, useCallback } from 'react';
import {
  StatusBar,
  AppState,
  AppStateStatus,
  Platform,
  Alert,
  Linking,
  BackHandler,
  PermissionsAndroid,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';
import DeviceInfo from 'react-native-device-info';
import { enableScreens } from 'react-native-screens';
import SplashScreen from 'react-native-splash-screen';
import Toast from 'react-native-toast-message';
import { enableLatestRenderer } from 'react-native-maps';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Biometrics and Security
import TouchID from 'react-native-touch-id';
import Keychain from 'react-native-keychain';

// AR and Camera
import { ViroARSceneNavigator } from '@viro-community/react-viro';
import { RNCamera } from 'react-native-camera';

// Push Notifications
import messaging from '@react-native-firebase/messaging';
import notifee, { EventType } from '@notifee/react-native';

// Store and Theme
import { store, persistor } from './store';
import { ThemeProvider } from './providers/ThemeProvider';
import { AuthProvider } from './providers/AuthProvider';
import { LocationProvider } from './providers/LocationProvider';
import { OfflineProvider } from './providers/OfflineProvider';

// Navigation
import AuthNavigator from './navigation/AuthNavigator';
import MainTabNavigator from './navigation/MainTabNavigator';

// Screens
import LoadingScreen from './screens/LoadingScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import ARNavigationScreen from './screens/ARNavigationScreen';
import QRScannerScreen from './screens/QRScannerScreen';

// Components
import OfflineBanner from './components/OfflineBanner';
import NotificationHandler from './components/NotificationHandler';
import ErrorBoundary from './components/ErrorBoundary';
import BiometricPrompt from './components/BiometricPrompt';

// Hooks
import { useAuth } from './hooks/useAuth';
import { useTheme } from './hooks/useTheme';
import { useNetworkStatus } from './hooks/useNetworkStatus';
import { useAppState } from './hooks/useAppState';
import { usePermissions } from './hooks/usePermissions';
import { useLocation } from './hooks/useLocation';

// Utils
import { initializeAnalytics } from './utils/analytics';
import { initializeCrashlytics } from './utils/crashlytics';
import { syncOfflineData } from './utils/offline';
import { logPerformance } from './utils/performance';

// Types
import { RootStackParamList } from './types/navigation';

// Enable screens optimization
enableScreens();
enableLatestRenderer();

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      retry: (failureCount, error: any) => {
        // Don't retry on 401/403 errors
        if (error?.status === 401 || error?.status === 403) {
          return false;
        }
        return failureCount < 3;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      retry: 1,
    },
  },
});

interface AppProps {}

const App: React.FC<AppProps> = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isAppReady, setIsAppReady] = useState(false);

  // Initialize app
  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // Initialize analytics and crash reporting
      await initializeAnalytics();
      await initializeCrashlytics();

      // Check if first launch
      const hasCompletedOnboarding = await AsyncStorage.getItem('hasCompletedOnboarding');
      setShowOnboarding(!hasCompletedOnboarding);

      // Request permissions
      await requestPermissions();

      // Initialize push notifications
      await initializePushNotifications();

      // Setup background tasks
      setupBackgroundTasks();

      // Mark app as ready
      setIsAppReady(true);
      setIsLoading(false);
      
      // Hide splash screen
      SplashScreen.hide();

      logPerformance('app_initialization_complete');
    } catch (error) {
      console.error('Failed to initialize app:', error);
      Alert.alert('Initialization Error', 'Failed to initialize the application. Please restart the app.');
    }
  };

  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.CAMERA,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
        ]);

        const allPermissionsGranted = Object.values(granted).every(
          permission => permission === PermissionsAndroid.RESULTS.GRANTED
        );

        if (!allPermissionsGranted) {
          Alert.alert(
            'Permissions Required',
            'Some features may not work without the required permissions.',
            [
              { text: 'Settings', onPress: () => Linking.openSettings() },
              { text: 'OK' }
            ]
          );
        }
      } catch (error) {
        console.error('Permission request failed:', error);
      }
    }
  };

  const initializePushNotifications = async () => {
    try {
      // Request permission for notifications
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (enabled) {
        // Get FCM token
        const token = await messaging().getToken();
        console.log('FCM Token:', token);
        
        // Store token for backend
        await AsyncStorage.setItem('fcmToken', token);

        // Listen for token refresh
        messaging().onTokenRefresh(async (token) => {
          await AsyncStorage.setItem('fcmToken', token);
          // Send updated token to backend
        });

        // Handle foreground messages
        messaging().onMessage(async (remoteMessage) => {
          console.log('Foreground message:', remoteMessage);
          // Show in-app notification
          await notifee.displayNotification({
            title: remoteMessage.notification?.title,
            body: remoteMessage.notification?.body,
            data: remoteMessage.data,
          });
        });

        // Handle background/quit state messages
        messaging().setBackgroundMessageHandler(async (remoteMessage) => {
          console.log('Background message:', remoteMessage);
        });
      }
    } catch (error) {
      console.error('Failed to initialize push notifications:', error);
    }
  };

  const setupBackgroundTasks = () => {
    // Handle app state changes
    AppState.addEventListener('change', handleAppStateChange);

    // Handle network state changes
    const unsubscribeNetInfo = NetInfo.addEventListener(state => {
      if (state.isConnected) {
        // Sync offline data when connection is restored
        syncOfflineData();
      }
    });

    // Handle deep links
    const handleDeepLink = (url: string) => {
      console.log('Deep link received:', url);
      // Parse and navigate to appropriate screen
    };

    Linking.addEventListener('url', handleDeepLink);

    // Handle hardware back button
    const backAction = () => {
      // Custom back button handling
      return true;
    };

    BackHandler.addEventListener('hardwareBackPress', backAction);

    return () => {
      AppState.removeEventListener('change', handleAppStateChange);
      unsubscribeNetInfo();
      Linking.removeEventListener('url', handleDeepLink);
      BackHandler.removeEventListener('hardwareBackPress', backAction);
    };
  };

  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (nextAppState === 'background') {
      logPerformance('app_backgrounded');
    } else if (nextAppState === 'active') {
      logPerformance('app_foregrounded');
      // Refresh data when app comes to foreground
      queryClient.invalidateQueries();
    }
  };

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <Provider store={store}>
            <PersistGate loading={<LoadingScreen />} persistor={persistor}>
              <QueryClientProvider client={queryClient}>
                <ThemeProvider>
                  <AuthProvider>
                    <LocationProvider>
                      <OfflineProvider>
                        <StatusBar
                          barStyle="dark-content"
                          backgroundColor="transparent"
                          translucent
                        />
                        <NavigationContainer>
                          <AppContent 
                            showOnboarding={showOnboarding}
                            onOnboardingComplete={() => setShowOnboarding(false)}
                          />
                        </NavigationContainer>
                        <OfflineBanner />
                        <NotificationHandler />
                        <Toast />
                      </OfflineProvider>
                    </LocationProvider>
                  </AuthProvider>
                </ThemeProvider>
              </QueryClientProvider>
            </PersistGate>
          </Provider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
};

interface AppContentProps {
  showOnboarding: boolean;
  onOnboardingComplete: () => void;
}

const AppContent: React.FC<AppContentProps> = ({ showOnboarding, onOnboardingComplete }) => {
  const { isAuthenticated, isLoading: authLoading, requiresBiometric } = useAuth();
  const { isConnected } = useNetworkStatus();
  const [showBiometricPrompt, setShowBiometricPrompt] = useState(false);

  useEffect(() => {
    if (requiresBiometric && isAuthenticated) {
      setShowBiometricPrompt(true);
    }
  }, [requiresBiometric, isAuthenticated]);

  const handleBiometricSuccess = () => {
    setShowBiometricPrompt(false);
  };

  const handleBiometricError = () => {
    setShowBiometricPrompt(false);
    // Handle biometric authentication failure
  };

  if (authLoading) {
    return <LoadingScreen />;
  }

  if (showOnboarding) {
    return (
      <OnboardingScreen 
        onComplete={async () => {
          await AsyncStorage.setItem('hasCompletedOnboarding', 'true');
          onOnboardingComplete();
        }}
      />
    );
  }

  if (showBiometricPrompt) {
    return (
      <BiometricPrompt
        onSuccess={handleBiometricSuccess}
        onError={handleBiometricError}
      />
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!isAuthenticated ? (
        <Stack.Screen name="Auth" component={AuthNavigator} />
      ) : (
        <>
          <Stack.Screen name="Main" component={MainTabNavigator} />
          <Stack.Screen 
            name="ARNavigation" 
            component={ARNavigationScreen}
            options={{
              presentation: 'fullScreenModal',
              gestureEnabled: false,
            }}
          />
          <Stack.Screen 
            name="QRScanner" 
            component={QRScannerScreen}
            options={{
              presentation: 'modal',
            }}
          />
        </>
      )}
    </Stack.Navigator>
  );
};

export default App; 