import React, { useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline, CircularProgress, Box } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { SnackbarProvider } from 'notistack';
import { ErrorBoundary } from 'react-error-boundary';

// Store
import { store, persistor } from './store';

// Components
import Header from './components/Layout/Header';
import Sidebar from './components/Layout/Sidebar';
import Footer from './components/Layout/Footer';
import LoadingSpinner from './components/Common/LoadingSpinner';
import ErrorFallback from './components/Common/ErrorFallback';
import ProtectedRoute from './components/Auth/ProtectedRoute';

// Lazy loaded pages
const Home = lazy(() => import('./pages/Home'));
const FlightSearch = lazy(() => import('./pages/FlightSearch'));
const BookingFlow = lazy(() => import('./pages/BookingFlow'));
const MyBookings = lazy(() => import('./pages/MyBookings'));
const CheckIn = lazy(() => import('./pages/CheckIn'));
const FlightStatus = lazy(() => import('./pages/FlightStatus'));
const BaggageTracker = lazy(() => import('./pages/BaggageTracker'));
const ARNavigation = lazy(() => import('./pages/ARNavigation'));
const TerminalMap = lazy(() => import('./pages/TerminalMap'));
const Services = lazy(() => import('./pages/Services'));
const Shopping = lazy(() => import('./pages/Shopping'));
const Dining = lazy(() => import('./pages/Dining'));
const Lounges = lazy(() => import('./pages/Lounges'));
const Transportation = lazy(() => import('./pages/Transportation'));
const CustomerService = lazy(() => import('./pages/CustomerService'));
const Profile = lazy(() => import('./pages/Profile'));
const Settings = lazy(() => import('./pages/Settings'));
const Login = lazy(() => import('./pages/Auth/Login'));
const Register = lazy(() => import('./pages/Auth/Register'));
const Dashboard = lazy(() => import('./pages/Dashboard'));

// Hooks
import { useAuth } from './hooks/useAuth';
import { useTheme as useCustomTheme } from './hooks/useTheme';
import { useNotifications } from './hooks/useNotifications';

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      retry: 3,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
});

const App: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, isLoading: authLoading } = useAuth();
  const { theme, isDarkMode, toggleTheme } = useCustomTheme();
  const { initializeNotifications } = useNotifications();

  // Initialize notifications on app start
  useEffect(() => {
    initializeNotifications();
  }, [initializeNotifications]);

  // Create MUI theme
  const muiTheme = createTheme({
    palette: {
      mode: isDarkMode ? 'dark' : 'light',
      primary: {
        main: '#1976d2',
        light: '#42a5f5',
        dark: '#1565c0',
      },
      secondary: {
        main: '#dc004e',
        light: '#ff4569',
        dark: '#9a0036',
      },
      background: {
        default: isDarkMode ? '#121212' : '#f5f5f5',
        paper: isDarkMode ? '#1e1e1e' : '#ffffff',
      },
    },
    typography: {
      fontFamily: [
        'Inter',
        '-apple-system',
        'BlinkMacSystemFont',
        '"Segoe UI"',
        'Roboto',
        '"Helvetica Neue"',
        'Arial',
        'sans-serif',
      ].join(','),
      h1: {
        fontWeight: 600,
      },
      h2: {
        fontWeight: 600,
      },
      h3: {
        fontWeight: 500,
      },
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            textTransform: 'none',
            fontWeight: 500,
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: 8,
            },
          },
        },
      },
    },
  });

  const handleSidebarToggle = () => {
    setSidebarOpen(!sidebarOpen);
  };

  if (authLoading) {
    return (
      <Box 
        display="flex" 
        justifyContent="center" 
        alignItems="center" 
        minHeight="100vh"
      >
        <LoadingSpinner size={60} />
      </Box>
    );
  }

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <Provider store={store}>
        <PersistGate loading={<LoadingSpinner />} persistor={persistor}>
          <QueryClientProvider client={queryClient}>
            <ThemeProvider theme={muiTheme}>
              <CssBaseline />
              <SnackbarProvider 
                maxSnack={3}
                anchorOrigin={{
                  vertical: 'top',
                  horizontal: 'right',
                }}
              >
                <Router>
                  <Box sx={{ display: 'flex', minHeight: '100vh' }}>
                    {/* Header */}
                    <Header 
                      onMenuClick={handleSidebarToggle}
                      isDarkMode={isDarkMode}
                      onThemeToggle={toggleTheme}
                    />

                    {/* Sidebar */}
                    <Sidebar 
                      open={sidebarOpen}
                      onClose={() => setSidebarOpen(false)}
                      user={user}
                    />

                    {/* Main Content */}
                    <Box
                      component="main"
                      sx={{
                        flexGrow: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        mt: { xs: 7, sm: 8 },
                        ml: { md: sidebarOpen ? 30 : 0 },
                        transition: 'margin-left 0.3s',
                      }}
                    >
                      <Box sx={{ flexGrow: 1, p: { xs: 2, md: 3 } }}>
                        <Suspense fallback={<LoadingSpinner />}>
                          <Routes>
                            {/* Public Routes */}
                            <Route path="/" element={<Home />} />
                            <Route path="/login" element={<Login />} />
                            <Route path="/register" element={<Register />} />
                            <Route path="/flight-status" element={<FlightStatus />} />
                            <Route path="/terminal-map" element={<TerminalMap />} />
                            <Route path="/services" element={<Services />} />
                            <Route path="/shopping" element={<Shopping />} />
                            <Route path="/dining" element={<Dining />} />
                            <Route path="/customer-service" element={<CustomerService />} />

                            {/* Protected Routes */}
                            <Route path="/dashboard" element={
                              <ProtectedRoute>
                                <Dashboard />
                              </ProtectedRoute>
                            } />
                            <Route path="/search" element={
                              <ProtectedRoute>
                                <FlightSearch />
                              </ProtectedRoute>
                            } />
                            <Route path="/booking/*" element={
                              <ProtectedRoute>
                                <BookingFlow />
                              </ProtectedRoute>
                            } />
                            <Route path="/my-bookings" element={
                              <ProtectedRoute>
                                <MyBookings />
                              </ProtectedRoute>
                            } />
                            <Route path="/check-in" element={
                              <ProtectedRoute>
                                <CheckIn />
                              </ProtectedRoute>
                            } />
                            <Route path="/baggage" element={
                              <ProtectedRoute>
                                <BaggageTracker />
                              </ProtectedRoute>
                            } />
                            <Route path="/navigation" element={
                              <ProtectedRoute>
                                <ARNavigation />
                              </ProtectedRoute>
                            } />
                            <Route path="/lounges" element={
                              <ProtectedRoute>
                                <Lounges />
                              </ProtectedRoute>
                            } />
                            <Route path="/transportation" element={
                              <ProtectedRoute>
                                <Transportation />
                              </ProtectedRoute>
                            } />
                            <Route path="/profile" element={
                              <ProtectedRoute>
                                <Profile />
                              </ProtectedRoute>
                            } />
                            <Route path="/settings" element={
                              <ProtectedRoute>
                                <Settings />
                              </ProtectedRoute>
                            } />

                            {/* Redirect unknown routes */}
                            <Route path="*" element={<Navigate to="/" replace />} />
                          </Routes>
                        </Suspense>
                      </Box>

                      {/* Footer */}
                      <Footer />
                    </Box>
                  </Box>
                </Router>
              </SnackbarProvider>
            </ThemeProvider>
            <ReactQueryDevtools initialIsOpen={false} />
          </QueryClientProvider>
        </PersistGate>
      </Provider>
    </ErrorBoundary>
  );
};

export default App; 