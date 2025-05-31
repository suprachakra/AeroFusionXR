import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ThemeProvider, CssBaseline, GlobalStyles } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { SnackbarProvider } from 'notistack';
import { ErrorBoundary } from 'react-error-boundary';

// Store & Theme
import { store } from './store/store';
import { theme } from './theme/theme';
import { globalStyles } from './theme/globalStyles';

// Components
import LoadingSpinner from './components/common/LoadingSpinner';
import ErrorFallback from './components/common/ErrorFallback';
import Layout from './components/layout/Layout';
import ProtectedRoute from './components/auth/ProtectedRoute';

// Hooks
import { useAuth } from './hooks/useAuth';
import { useNotifications } from './hooks/useNotifications';

// Lazy Components for Code Splitting
const Dashboard = lazy(() => import('./pages/Dashboard'));
const FlightInfo = lazy(() => import('./pages/FlightInfo'));
const BaggageTracker = lazy(() => import('./pages/BaggageTracker'));
const Wayfinding = lazy(() => import('./pages/Wayfinding'));
const AIConcierge = lazy(() => import('./pages/AIConcierge'));
const Commerce = lazy(() => import('./pages/Commerce'));
const Booking = lazy(() => import('./pages/Booking'));
const Profile = lazy(() => import('./pages/Profile'));
const Login = lazy(() => import('./pages/auth/Login'));
const Register = lazy(() => import('./pages/auth/Register'));
const NotFound = lazy(() => import('./pages/NotFound'));

// Analytics & Monitoring
import { Analytics } from './utils/analytics';
import { PerformanceMonitor } from './utils/performance';

// Create React Query Client
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

// App Context Provider
const AppProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Provider store={store}>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <SnackbarProvider
            maxSnack={3}
            anchorOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
            autoHideDuration={6000}
          >
            <CssBaseline />
            <GlobalStyles styles={globalStyles} />
            {children}
            <ReactQueryDevtools initialIsOpen={false} />
          </SnackbarProvider>
        </LocalizationProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </Provider>
);

// Main App Component
const AppContent: React.FC = () => {
  const { isAuthenticated, isLoading, initialize } = useAuth();
  const { requestPermission } = useNotifications();

  useEffect(() => {
    // Initialize app
    initialize();
    
    // Request notification permissions
    requestPermission();

    // Initialize analytics
    Analytics.initialize();
    
    // Start performance monitoring
    PerformanceMonitor.start();

    // Register service worker for PWA
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('SW registered: ', registration);
        })
        .catch((registrationError) => {
          console.log('SW registration failed: ', registrationError);
        });
    }

    // Cleanup on unmount
    return () => {
      PerformanceMonitor.stop();
    };
  }, [initialize, requestPermission]);

  if (isLoading) {
    return <LoadingSpinner fullScreen message="Initializing AeroFusionXR..." />;
  }

  return (
    <Router>
      <Suspense fallback={<LoadingSpinner fullScreen message="Loading..." />}>
        <Routes>
          {/* Public Routes */}
          <Route 
            path="/login" 
            element={
              isAuthenticated ? <Navigate to="/" replace /> : <Login />
            } 
          />
          <Route 
            path="/register" 
            element={
              isAuthenticated ? <Navigate to="/" replace /> : <Register />
            } 
          />

          {/* Protected Routes */}
          <Route 
            path="/" 
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="flights" element={<FlightInfo />} />
            <Route path="baggage" element={<BaggageTracker />} />
            <Route path="wayfinding" element={<Wayfinding />} />
            <Route path="concierge" element={<AIConcierge />} />
            <Route path="commerce" element={<Commerce />} />
            <Route path="booking" element={<Booking />} />
            <Route path="profile" element={<Profile />} />
          </Route>

          {/* Catch All */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </Router>
  );
};

// Main App with Error Boundary
const App: React.FC = () => {
  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={(error, errorInfo) => {
        console.error('App Error:', error, errorInfo);
        Analytics.trackError(error, errorInfo);
      }}
    >
      <AppProviders>
        <AppContent />
      </AppProviders>
    </ErrorBoundary>
  );
};

export default App; 