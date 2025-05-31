/**
 * AeroFusionXR Kiosk Application
 * ==============================
 * 
 * Self-service kiosk interface for airport terminals, providing
 * touchscreen-optimized interactions for passenger services.
 * 
 * Features:
 * - 🎯 Large, touch-friendly interface
 * - 🛫 Flight information display
 * - 🎫 Check-in and boarding pass printing
 * - 🗺️ Interactive terminal maps
 * - 🔍 Wayfinding and directions
 * - 🛒 Airport services and amenities
 * - 📱 Mobile app download and QR codes
 * - ♿ Accessibility features
 * - 🌍 Multi-language support
 * - 💬 Help and customer service
 * 
 * Technical Stack:
 * - React 18 with TypeScript
 * - Material-UI for components
 * - React Query for state management
 * - Socket.IO for real-time updates
 * - React Spring for animations
 * - Leaflet for interactive maps
 * - react-qr-code for QR generation
 * - react-barcode for barcode printing
 * - Framer Motion for transitions
 * 
 * Design Principles:
 * - Minimum 44px touch targets
 * - High contrast colors
 * - Large, readable fonts
 * - Clear navigation hierarchy
 * - Timeout-based session management
 * - Error recovery mechanisms
 * 
 * Author: AeroFusionXR Team
 * License: Proprietary
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  ThemeProvider,
  CssBaseline,
  Box,
  AppBar,
  Toolbar,
  Typography,
  Container,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Alert,
  LinearProgress,
  Fade,
  Slide,
  useMediaQuery,
} from '@mui/material';
import {
  Flight as FlightIcon,
  CheckCircle as CheckInIcon,
  Map as MapIcon,
  Store as StoreIcon,
  Help as HelpIcon,
  Language as LanguageIcon,
  Accessibility as AccessibilityIcon,
  QrCode as QrCodeIcon,
  Print as PrintIcon,
  Home as HomeIcon,
  ArrowBack as BackIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import io from 'socket.io-client';
import QRCode from 'react-qr-code';

// Theme Configuration
import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
      light: '#42a5f5',
      dark: '#1565c0',
    },
    secondary: {
      main: '#ff9800',
      light: '#ffb74d',
      dark: '#f57c00',
    },
    success: {
      main: '#4caf50',
    },
    warning: {
      main: '#ff9800',
    },
    error: {
      main: '#f44336',
    },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
    },
  },
  typography: {
    fontSize: 18,
    h1: {
      fontSize: '3rem',
      fontWeight: 600,
    },
    h2: {
      fontSize: '2.5rem',
      fontWeight: 500,
    },
    h3: {
      fontSize: '2rem',
      fontWeight: 500,
    },
    h4: {
      fontSize: '1.5rem',
      fontWeight: 500,
    },
    body1: {
      fontSize: '1.2rem',
    },
    button: {
      fontSize: '1.1rem',
      fontWeight: 500,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          minHeight: 60,
          borderRadius: 12,
          textTransform: 'none',
          fontSize: '1.2rem',
          padding: '16px 32px',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
          transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
          },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          minWidth: 60,
          minHeight: 60,
        },
      },
    },
  },
});

// Types
interface KioskSession {
  id: string;
  startTime: Date;
  lastActivity: Date;
  language: string;
  accessibilityMode: boolean;
}

interface FlightInfo {
  flightNumber: string;
  airline: string;
  departure: {
    airport: string;
    gate: string;
    time: string;
    terminal: string;
  };
  arrival: {
    airport: string;
    gate: string;
    time: string;
    terminal: string;
  };
  status: 'on-time' | 'delayed' | 'boarding' | 'departed' | 'cancelled';
}

// Query Client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000, // 30 seconds
      refetchInterval: 60000, // 1 minute
    },
  },
});

// Session timeout (5 minutes)
const SESSION_TIMEOUT = 5 * 60 * 1000;

// Main Application Component
const KioskApp: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<string>('home');
  const [session, setSession] = useState<KioskSession | null>(null);
  const [showTimeout, setShowTimeout] = useState(false);
  const [timeoutCounter, setTimeoutCounter] = useState(30);
  const [language, setLanguage] = useState('en');
  const [accessibilityMode, setAccessibilityMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const isLargeScreen = useMediaQuery(theme.breakpoints.up('lg'));

  // Session Management
  useEffect(() => {
    startNewSession();
  }, []);

  useEffect(() => {
    if (!session) return;

    const checkTimeout = () => {
      const now = new Date();
      const timeSinceActivity = now.getTime() - session.lastActivity.getTime();
      
      if (timeSinceActivity > SESSION_TIMEOUT - 30000) {
        setShowTimeout(true);
        setTimeoutCounter(30);
      }
      
      if (timeSinceActivity > SESSION_TIMEOUT) {
        endSession();
      }
    };

    const interval = setInterval(checkTimeout, 1000);
    return () => clearInterval(interval);
  }, [session]);

  useEffect(() => {
    if (showTimeout && timeoutCounter > 0) {
      const timer = setTimeout(() => {
        setTimeoutCounter(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
    
    if (timeoutCounter === 0) {
      endSession();
    }
  }, [showTimeout, timeoutCounter]);

  const startNewSession = useCallback(() => {
    const newSession: KioskSession = {
      id: crypto.randomUUID(),
      startTime: new Date(),
      lastActivity: new Date(),
      language: 'en',
      accessibilityMode: false,
    };
    
    setSession(newSession);
    setCurrentScreen('home');
    setShowTimeout(false);
    console.log('New kiosk session started:', newSession.id);
  }, []);

  const updateActivity = useCallback(() => {
    if (!session) return;
    
    setSession(prev => prev ? {
      ...prev,
      lastActivity: new Date(),
    } : null);
    
    setShowTimeout(false);
  }, [session]);

  const endSession = useCallback(() => {
    console.log('Kiosk session ended');
    setSession(null);
    setCurrentScreen('home');
    setShowTimeout(false);
    setTimeout(startNewSession, 2000);
  }, [startNewSession]);

  const extendSession = useCallback(() => {
    updateActivity();
    setShowTimeout(false);
  }, [updateActivity]);

  // Screen Navigation
  const navigateToScreen = useCallback((screen: string) => {
    updateActivity();
    setCurrentScreen(screen);
  }, [updateActivity]);

  const goHome = useCallback(() => {
    navigateToScreen('home');
  }, [navigateToScreen]);

  const goBack = useCallback(() => {
    updateActivity();
    // Simple back navigation - in real app, would use navigation stack
    if (currentScreen !== 'home') {
      setCurrentScreen('home');
    }
  }, [updateActivity, currentScreen]);

  // Home Screen Component
  const HomeScreen: React.FC = () => (
    <Fade in timeout={500}>
      <Container maxWidth="xl">
        <Box sx={{ py: 4 }}>
          <Typography variant="h1" align="center" gutterBottom color="primary">
            Welcome to JFK Airport
          </Typography>
          <Typography variant="h4" align="center" color="text.secondary" sx={{ mb: 6 }}>
            How can we help you today?
          </Typography>
          
          <Grid container spacing={4} justifyContent="center">
            <Grid item xs={12} sm={6} lg={4}>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Card 
                  sx={{ height: 300, cursor: 'pointer' }}
                  onClick={() => navigateToScreen('flights')}
                >
                  <CardContent sx={{ textAlign: 'center', pt: 4 }}>
                    <FlightIcon sx={{ fontSize: 80, color: 'primary.main', mb: 2 }} />
                    <Typography variant="h3" gutterBottom>
                      Flight Information
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                      Check arrivals, departures, and flight status
                    </Typography>
                  </CardContent>
                </Card>
              </motion.div>
            </Grid>

            <Grid item xs={12} sm={6} lg={4}>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Card 
                  sx={{ height: 300, cursor: 'pointer' }}
                  onClick={() => navigateToScreen('checkin')}
                >
                  <CardContent sx={{ textAlign: 'center', pt: 4 }}>
                    <CheckInIcon sx={{ fontSize: 80, color: 'success.main', mb: 2 }} />
                    <Typography variant="h3" gutterBottom>
                      Check-In
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                      Check in and print boarding passes
                    </Typography>
                  </CardContent>
                </Card>
              </motion.div>
            </Grid>

            <Grid item xs={12} sm={6} lg={4}>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Card 
                  sx={{ height: 300, cursor: 'pointer' }}
                  onClick={() => navigateToScreen('wayfinding')}
                >
                  <CardContent sx={{ textAlign: 'center', pt: 4 }}>
                    <MapIcon sx={{ fontSize: 80, color: 'secondary.main', mb: 2 }} />
                    <Typography variant="h3" gutterBottom>
                      Wayfinding
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                      Find gates, shops, and airport services
                    </Typography>
                  </CardContent>
                </Card>
              </motion.div>
            </Grid>

            <Grid item xs={12} sm={6} lg={4}>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Card 
                  sx={{ height: 300, cursor: 'pointer' }}
                  onClick={() => navigateToScreen('services')}
                >
                  <CardContent sx={{ textAlign: 'center', pt: 4 }}>
                    <StoreIcon sx={{ fontSize: 80, color: 'info.main', mb: 2 }} />
                    <Typography variant="h3" gutterBottom>
                      Airport Services
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                      Shops, restaurants, and amenities
                    </Typography>
                  </CardContent>
                </Card>
              </motion.div>
            </Grid>

            <Grid item xs={12} sm={6} lg={4}>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Card 
                  sx={{ height: 300, cursor: 'pointer' }}
                  onClick={() => navigateToScreen('mobile')}
                >
                  <CardContent sx={{ textAlign: 'center', pt: 4 }}>
                    <QrCodeIcon sx={{ fontSize: 80, color: 'warning.main', mb: 2 }} />
                    <Typography variant="h3" gutterBottom>
                      Mobile App
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                      Download our mobile app
                    </Typography>
                  </CardContent>
                </Card>
              </motion.div>
            </Grid>

            <Grid item xs={12} sm={6} lg={4}>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Card 
                  sx={{ height: 300, cursor: 'pointer' }}
                  onClick={() => navigateToScreen('help')}
                >
                  <CardContent sx={{ textAlign: 'center', pt: 4 }}>
                    <HelpIcon sx={{ fontSize: 80, color: 'error.main', mb: 2 }} />
                    <Typography variant="h3" gutterBottom>
                      Help & Support
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                      Get assistance and contact information
                    </Typography>
                  </CardContent>
                </Card>
              </motion.div>
            </Grid>
          </Grid>
        </Box>
      </Container>
    </Fade>
  );

  // Mobile App Screen Component
  const MobileAppScreen: React.FC = () => (
    <Fade in timeout={500}>
      <Container maxWidth="md">
        <Box sx={{ py: 4, textAlign: 'center' }}>
          <Typography variant="h2" gutterBottom color="primary">
            Download AeroFusionXR Mobile App
          </Typography>
          <Typography variant="h5" color="text.secondary" sx={{ mb: 4 }}>
            Get real-time updates, AR navigation, and exclusive features
          </Typography>
          
          <Grid container spacing={4} justifyContent="center">
            <Grid item xs={12} md={6}>
              <Card sx={{ p: 4 }}>
                <Typography variant="h4" gutterBottom>
                  Scan to Download
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
                  <QRCode 
                    value="https://app.aerofusionxr.com/download" 
                    size={200}
                    bgColor="#ffffff"
                    fgColor="#1976d2"
                  />
                </Box>
                <Typography variant="body1" color="text.secondary">
                  Point your phone camera at the QR code to download
                </Typography>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Card sx={{ p: 4, height: '100%' }}>
                <Typography variant="h4" gutterBottom>
                  App Features
                </Typography>
                <Box sx={{ textAlign: 'left' }}>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    ✈️ Real-time flight tracking
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    🗺️ AR wayfinding and navigation
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    🎫 Mobile boarding passes
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    🛒 Shop and order ahead
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    🧳 Baggage tracking
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    🤖 AI travel assistant
                  </Typography>
                </Box>
              </Card>
            </Grid>
          </Grid>

          <Box sx={{ mt: 4 }}>
            <Button
              variant="outlined"
              size="large"
              onClick={goBack}
              startIcon={<BackIcon />}
              sx={{ mr: 2 }}
            >
              Back to Main Menu
            </Button>
          </Box>
        </Box>
      </Container>
    </Fade>
  );

  // Render current screen
  const renderCurrentScreen = () => {
    switch (currentScreen) {
      case 'home':
        return <HomeScreen />;
      case 'mobile':
        return <MobileAppScreen />;
      // Add other screens here
      default:
        return <HomeScreen />;
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box 
        sx={{ 
          minHeight: '100vh',
          backgroundColor: 'background.default',
          userSelect: 'none', // Prevent text selection on kiosk
        }}
        onClick={updateActivity}
      >
        {/* Header */}
        <AppBar position="static" elevation={0}>
          <Toolbar sx={{ justifyContent: 'space-between', py: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <IconButton
                color="inherit"
                onClick={goHome}
                sx={{ mr: 2 }}
                disabled={currentScreen === 'home'}
              >
                <HomeIcon sx={{ fontSize: 32 }} />
              </IconButton>
              <Typography variant="h4" component="div">
                AeroFusionXR Kiosk
              </Typography>
            </Box>
            
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {currentScreen !== 'home' && (
                <IconButton color="inherit" onClick={goBack}>
                  <BackIcon sx={{ fontSize: 32 }} />
                </IconButton>
              )}
              
              <IconButton 
                color="inherit"
                onClick={() => {
                  setAccessibilityMode(!accessibilityMode);
                  updateActivity();
                }}
              >
                <AccessibilityIcon sx={{ fontSize: 32 }} />
              </IconButton>
              
              <IconButton 
                color="inherit"
                onClick={() => navigateToScreen('help')}
              >
                <HelpIcon sx={{ fontSize: 32 }} />
              </IconButton>
            </Box>
          </Toolbar>
        </AppBar>

        {/* Loading Indicator */}
        {isLoading && <LinearProgress />}

        {/* Main Content */}
        <Box component="main" sx={{ minHeight: 'calc(100vh - 80px)' }}>
          <AnimatePresence mode="wait">
            {renderCurrentScreen()}
          </AnimatePresence>
        </Box>

        {/* Session Timeout Warning */}
        <Dialog
          open={showTimeout}
          maxWidth="sm"
          fullWidth
          disableEscapeKeyDown
        >
          <DialogTitle sx={{ textAlign: 'center' }}>
            <WarningIcon sx={{ fontSize: 60, color: 'warning.main', mb: 2 }} />
            <Typography variant="h4">Session Timeout Warning</Typography>
          </DialogTitle>
          
          <DialogContent>
            <Typography variant="h5" align="center" color="text.secondary">
              Your session will end in {timeoutCounter} seconds due to inactivity.
            </Typography>
            <Box sx={{ mt: 2 }}>
              <LinearProgress 
                variant="determinate" 
                value={(timeoutCounter / 30) * 100}
                sx={{ height: 8, borderRadius: 4 }}
              />
            </Box>
          </DialogContent>
          
          <DialogActions sx={{ justifyContent: 'center', pb: 3 }}>
            <Button
              variant="contained"
              size="large"
              onClick={extendSession}
              sx={{ px: 6 }}
            >
              Continue Session
            </Button>
          </DialogActions>
        </Dialog>

        {/* Session Ended Message */}
        <Dialog
          open={!session}
          maxWidth="sm"
          fullWidth
          disableEscapeKeyDown
        >
          <DialogContent sx={{ textAlign: 'center', py: 6 }}>
            <InfoIcon sx={{ fontSize: 80, color: 'info.main', mb: 3 }} />
            <Typography variant="h3" gutterBottom>
              Session Ended
            </Typography>
            <Typography variant="h5" color="text.secondary">
              Starting new session...
            </Typography>
            <Box sx={{ mt: 3 }}>
              <LinearProgress />
            </Box>
          </DialogContent>
        </Dialog>
      </Box>
    </ThemeProvider>
  );
};

// Main App with Providers
const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <KioskApp />
    </QueryClientProvider>
  );
};

export default App; 