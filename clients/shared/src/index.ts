/**
 * AeroFusionXR Shared Components Library
 * =====================================
 * 
 * Enterprise-grade shared components, hooks, utilities, and types
 * for the AeroFusionXR Aviation Platform.
 * 
 * Features:
 * - 🎯 Complete TypeScript support with strict typing
 * - 🧩 Modular component architecture
 * - 🔧 Comprehensive utility functions
 * - 🎨 Design system components
 * - 📱 Cross-platform compatibility
 * - 🌐 Internationalization support
 * - ♿ Accessibility features
 * - 🔒 Security utilities
 * - 📊 Analytics integration
 * - 🚀 Performance optimizations
 * 
 * @version 1.0.0
 * @author AeroFusionXR Team
 * @license MIT
 */

// =============================================================================
// CORE TYPES AND INTERFACES
// =============================================================================

export * from './types/aviation';
export * from './types/user';
export * from './types/booking';
export * from './types/flight';
export * from './types/airport';
export * from './types/baggage';
export * from './types/commerce';
export * from './types/navigation';
export * from './types/ar';
export * from './types/api';
export * from './types/common';

// =============================================================================
// UI COMPONENTS
// =============================================================================

// Layout Components
export { default as Layout } from './components/layout/Layout';
export { default as Header } from './components/layout/Header';
export { default as Footer } from './components/layout/Footer';
export { default as Sidebar } from './components/layout/Sidebar';
export { default as Container } from './components/layout/Container';
export { default as Grid } from './components/layout/Grid';
export { default as Flex } from './components/layout/Flex';
export { default as Stack } from './components/layout/Stack';
export { default as Spacer } from './components/layout/Spacer';

// Navigation Components
export { default as NavigationMenu } from './components/navigation/NavigationMenu';
export { default as Breadcrumb } from './components/navigation/Breadcrumb';
export { default as Tabs } from './components/navigation/Tabs';
export { default as Pagination } from './components/navigation/Pagination';
export { default as Stepper } from './components/navigation/Stepper';
export { default as BackButton } from './components/navigation/BackButton';

// Form Components
export { default as Form } from './components/forms/Form';
export { default as Input } from './components/forms/Input';
export { default as TextArea } from './components/forms/TextArea';
export { default as Select } from './components/forms/Select';
export { default as Checkbox } from './components/forms/Checkbox';
export { default as Radio } from './components/forms/Radio';
export { default as Switch } from './components/forms/Switch';
export { default as Slider } from './components/forms/Slider';
export { default as DatePicker } from './components/forms/DatePicker';
export { default as TimePicker } from './components/forms/TimePicker';
export { default as FileUpload } from './components/forms/FileUpload';
export { default as SearchInput } from './components/forms/SearchInput';
export { default as FormField } from './components/forms/FormField';
export { default as FormValidation } from './components/forms/FormValidation';

// Button Components
export { default as Button } from './components/buttons/Button';
export { default as IconButton } from './components/buttons/IconButton';
export { default as FloatingActionButton } from './components/buttons/FloatingActionButton';
export { default as ButtonGroup } from './components/buttons/ButtonGroup';
export { default as ToggleButton } from './components/buttons/ToggleButton';
export { default as SplitButton } from './components/buttons/SplitButton';

// Data Display Components
export { default as Table } from './components/data/Table';
export { default as DataGrid } from './components/data/DataGrid';
export { default as List } from './components/data/List';
export { default as Card } from './components/data/Card';
export { default as Avatar } from './components/data/Avatar';
export { default as Badge } from './components/data/Badge';
export { default as Chip } from './components/data/Chip';
export { default as Tag } from './components/data/Tag';
export { default as Timeline } from './components/data/Timeline';
export { default as Tree } from './components/data/Tree';
export { default as Accordion } from './components/data/Accordion';
export { default as Carousel } from './components/data/Carousel';

// Feedback Components
export { default as Alert } from './components/feedback/Alert';
export { default as Toast } from './components/feedback/Toast';
export { default as Notification } from './components/feedback/Notification';
export { default as ProgressBar } from './components/feedback/ProgressBar';
export { default as Spinner } from './components/feedback/Spinner';
export { default as Skeleton } from './components/feedback/Skeleton';
export { default as EmptyState } from './components/feedback/EmptyState';
export { default as ErrorBoundary } from './components/feedback/ErrorBoundary';

// Overlay Components
export { default as Modal } from './components/overlay/Modal';
export { default as Dialog } from './components/overlay/Dialog';
export { default as Drawer } from './components/overlay/Drawer';
export { default as Popover } from './components/overlay/Popover';
export { default as Tooltip } from './components/overlay/Tooltip';
export { default as ContextMenu } from './components/overlay/ContextMenu';
export { default as BottomSheet } from './components/overlay/BottomSheet';

// Media Components
export { default as Image } from './components/media/Image';
export { default as Video } from './components/media/Video';
export { default as Audio } from './components/media/Audio';
export { default as ImageGallery } from './components/media/ImageGallery';
export { default as VideoPlayer } from './components/media/VideoPlayer';
export { default as QRCodeScanner } from './components/media/QRCodeScanner';
export { default as CameraCapture } from './components/media/CameraCapture';

// Chart Components
export { default as LineChart } from './components/charts/LineChart';
export { default as BarChart } from './components/charts/BarChart';
export { default as PieChart } from './components/charts/PieChart';
export { default as AreaChart } from './components/charts/AreaChart';
export { default as ScatterChart } from './components/charts/ScatterChart';
export { default as Gauge } from './components/charts/Gauge';
export { default as Heatmap } from './components/charts/Heatmap';

// =============================================================================
// AVIATION-SPECIFIC COMPONENTS
// =============================================================================

// Flight Components
export { default as FlightCard } from './components/aviation/FlightCard';
export { default as FlightStatus } from './components/aviation/FlightStatus';
export { default as FlightSchedule } from './components/aviation/FlightSchedule';
export { default as FlightSearch } from './components/aviation/FlightSearch';
export { default as FlightDetails } from './components/aviation/FlightDetails';
export { default as FlightMap } from './components/aviation/FlightMap';
export { default as FlightTracker } from './components/aviation/FlightTracker';
export { default as BoardingPass } from './components/aviation/BoardingPass';
export { default as SeatMap } from './components/aviation/SeatMap';
export { default as GateInfo } from './components/aviation/GateInfo';

// Airport Components
export { default as AirportMap } from './components/aviation/AirportMap';
export { default as AirportInfo } from './components/aviation/AirportInfo';
export { default as TerminalMap } from './components/aviation/TerminalMap';
export { default as AirportServices } from './components/aviation/AirportServices';
export { default as SecurityWaitTimes } from './components/aviation/SecurityWaitTimes';
export { default as WeatherWidget } from './components/aviation/WeatherWidget';

// Baggage Components
export { default as BaggageTracker } from './components/aviation/BaggageTracker';
export { default as BaggageStatus } from './components/aviation/BaggageStatus';
export { default as BaggageCarousel } from './components/aviation/BaggageCarousel';
export { default as BaggageAllowance } from './components/aviation/BaggageAllowance';

// Booking Components
export { default as BookingForm } from './components/aviation/BookingForm';
export { default as BookingConfirmation } from './components/aviation/BookingConfirmation';
export { default as BookingHistory } from './components/aviation/BookingHistory';
export { default as BookingModification } from './components/aviation/BookingModification';
export { default as PriceComparison } from './components/aviation/PriceComparison';

// =============================================================================
// AR/XR COMPONENTS
// =============================================================================

export { default as ARViewer } from './components/ar/ARViewer';
export { default as ARNavigation } from './components/ar/ARNavigation';
export { default as ARWaypoint } from './components/ar/ARWaypoint';
export { default as AROverlay } from './components/ar/AROverlay';
export { default as ARMarker } from './components/ar/ARMarker';
export { default as ARScene } from './components/ar/ARScene';
export { default as VREnvironment } from './components/ar/VREnvironment';
export { default as XRController } from './components/ar/XRController';
export { default as SpatialUI } from './components/ar/SpatialUI';
export { default as HandTracking } from './components/ar/HandTracking';
export { default as EyeTracking } from './components/ar/EyeTracking';
export { default as VoiceCommands } from './components/ar/VoiceCommands';

// =============================================================================
// COMMERCE COMPONENTS
// =============================================================================

export { default as ProductCard } from './components/commerce/ProductCard';
export { default as ProductGrid } from './components/commerce/ProductGrid';
export { default as ProductDetails } from './components/commerce/ProductDetails';
export { default as ShoppingCart } from './components/commerce/ShoppingCart';
export { default as Checkout } from './components/commerce/Checkout';
export { default as PaymentForm } from './components/commerce/PaymentForm';
export { default as OrderSummary } from './components/commerce/OrderSummary';
export { default as OrderHistory } from './components/commerce/OrderHistory';
export { default as WishList } from './components/commerce/WishList';
export { default as ProductSearch } from './components/commerce/ProductSearch';
export { default as ProductFilter } from './components/commerce/ProductFilter';
export { default as PriceDisplay } from './components/commerce/PriceDisplay';
export { default as InventoryStatus } from './components/commerce/InventoryStatus';
export { default as ReviewRating } from './components/commerce/ReviewRating';

// =============================================================================
// HOOKS
// =============================================================================

// Core Hooks
export { default as useLocalStorage } from './hooks/useLocalStorage';
export { default as useSessionStorage } from './hooks/useSessionStorage';
export { default as useDebounce } from './hooks/useDebounce';
export { default as useThrottle } from './hooks/useThrottle';
export { default as useAsync } from './hooks/useAsync';
export { default as useFetch } from './hooks/useFetch';
export { default as useWebSocket } from './hooks/useWebSocket';
export { default as useEventListener } from './hooks/useEventListener';
export { default as useClickOutside } from './hooks/useClickOutside';
export { default as useKeyPress } from './hooks/useKeyPress';
export { default as useMediaQuery } from './hooks/useMediaQuery';
export { default as useIntersectionObserver } from './hooks/useIntersectionObserver';
export { default as useGeolocation } from './hooks/useGeolocation';
export { default as useOnlineStatus } from './hooks/useOnlineStatus';
export { default as useBattery } from './hooks/useBattery';
export { default as useDeviceOrientation } from './hooks/useDeviceOrientation';
export { default as useClipboard } from './hooks/useClipboard';
export { default as useFullscreen } from './hooks/useFullscreen';
export { default as useIdle } from './hooks/useIdle';
export { default as useToggle } from './hooks/useToggle';
export { default as useCounter } from './hooks/useCounter';
export { default as usePrevious } from './hooks/usePrevious';
export { default as useUpdateEffect } from './hooks/useUpdateEffect';
export { default as useMountedState } from './hooks/useMountedState';

// UI Hooks
export { default as useTheme } from './hooks/ui/useTheme';
export { default as useBreakpoint } from './hooks/ui/useBreakpoint';
export { default as useColorMode } from './hooks/ui/useColorMode';
export { default as useDisclosure } from './hooks/ui/useDisclosure';
export { default as useToast } from './hooks/ui/useToast';
export { default as useModal } from './hooks/ui/useModal';
export { default as useDragAndDrop } from './hooks/ui/useDragAndDrop';
export { default as useResizeObserver } from './hooks/ui/useResizeObserver';
export { default as useScrollPosition } from './hooks/ui/useScrollPosition';
export { default as useVirtualList } from './hooks/ui/useVirtualList';

// Form Hooks
export { default as useForm } from './hooks/forms/useForm';
export { default as useFormValidation } from './hooks/forms/useFormValidation';
export { default as useFieldArray } from './hooks/forms/useFieldArray';
export { default as useFormPersist } from './hooks/forms/useFormPersist';

// Aviation Hooks
export { default as useFlightData } from './hooks/aviation/useFlightData';
export { default as useAirportData } from './hooks/aviation/useAirportData';
export { default as useBaggageTracking } from './hooks/aviation/useBaggageTracking';
export { default as useBookingData } from './hooks/aviation/useBookingData';
export { default as useFlightStatus } from './hooks/aviation/useFlightStatus';
export { default as useAirportServices } from './hooks/aviation/useAirportServices';
export { default as useWeatherData } from './hooks/aviation/useWeatherData';
export { default as useFlightSearch } from './hooks/aviation/useFlightSearch';

// AR/XR Hooks
export { default as useARSession } from './hooks/ar/useARSession';
export { default as useXRDevice } from './hooks/ar/useXRDevice';
export { default as useHandTracking } from './hooks/ar/useHandTracking';
export { default as useEyeTracking } from './hooks/ar/useEyeTracking';
export { default as useVoiceRecognition } from './hooks/ar/useVoiceRecognition';
export { default as useSpatialTracking } from './hooks/ar/useSpatialTracking';
export { default as useARNavigation } from './hooks/ar/useARNavigation';
export { default as useXRPerformance } from './hooks/ar/useXRPerformance';

// Commerce Hooks
export { default as useCart } from './hooks/commerce/useCart';
export { default as useWishlist } from './hooks/commerce/useWishlist';
export { default as usePayment } from './hooks/commerce/usePayment';
export { default as useInventory } from './hooks/commerce/useInventory';
export { default as useProductSearch } from './hooks/commerce/useProductSearch';
export { default as useOrderTracking } from './hooks/commerce/useOrderTracking';

// Authentication Hooks
export { default as useAuth } from './hooks/auth/useAuth';
export { default as useBiometric } from './hooks/auth/useBiometric';
export { default as usePermissions } from './hooks/auth/usePermissions';
export { default as useSession } from './hooks/auth/useSession';

// Analytics Hooks
export { default as useAnalytics } from './hooks/analytics/useAnalytics';
export { default as usePerformanceMetrics } from './hooks/analytics/usePerformanceMetrics';
export { default as useUserBehavior } from './hooks/analytics/useUserBehavior';
export { default as useErrorTracking } from './hooks/analytics/useErrorTracking';

// =============================================================================
// UTILITIES
// =============================================================================

// Core Utilities
export * from './utils/array';
export * from './utils/object';
export * from './utils/string';
export * from './utils/number';
export * from './utils/date';
export * from './utils/url';
export * from './utils/validation';
export * from './utils/formatting';
export * from './utils/conversion';
export * from './utils/math';
export * from './utils/color';
export * from './utils/device';
export * from './utils/browser';
export * from './utils/storage';
export * from './utils/crypto';
export * from './utils/performance';
export * from './utils/accessibility';

// API Utilities
export * from './utils/api/client';
export * from './utils/api/cache';
export * from './utils/api/retry';
export * from './utils/api/interceptors';
export * from './utils/api/types';

// Aviation Utilities
export * from './utils/aviation/flight';
export * from './utils/aviation/airport';
export * from './utils/aviation/baggage';
export * from './utils/aviation/booking';
export * from './utils/aviation/schedule';
export * from './utils/aviation/pricing';
export * from './utils/aviation/weather';
export * from './utils/aviation/distance';
export * from './utils/aviation/timezone';

// AR/XR Utilities
export * from './utils/ar/spatial';
export * from './utils/ar/tracking';
export * from './utils/ar/rendering';
export * from './utils/ar/interaction';
export * from './utils/ar/calibration';
export * from './utils/ar/performance';

// Commerce Utilities
export * from './utils/commerce/pricing';
export * from './utils/commerce/inventory';
export * from './utils/commerce/payment';
export * from './utils/commerce/shipping';
export * from './utils/commerce/tax';
export * from './utils/commerce/currency';

// Security Utilities
export * from './utils/security/encryption';
export * from './utils/security/authentication';
export * from './utils/security/authorization';
export * from './utils/security/sanitization';
export * from './utils/security/validation';

// Internationalization Utilities
export * from './utils/i18n/locale';
export * from './utils/i18n/currency';
export * from './utils/i18n/datetime';
export * from './utils/i18n/number';
export * from './utils/i18n/text';

// =============================================================================
// SERVICES
// =============================================================================

export { default as ApiService } from './services/ApiService';
export { default as AuthService } from './services/AuthService';
export { default as CacheService } from './services/CacheService';
export { default as StorageService } from './services/StorageService';
export { default as NotificationService } from './services/NotificationService';
export { default as AnalyticsService } from './services/AnalyticsService';
export { default as ErrorService } from './services/ErrorService';
export { default as LoggingService } from './services/LoggingService';
export { default as ConfigService } from './services/ConfigService';
export { default as ThemeService } from './services/ThemeService';
export { default as I18nService } from './services/I18nService';
export { default as GeolocationService } from './services/GeolocationService';
export { default as CameraService } from './services/CameraService';
export { default as BiometricService } from './services/BiometricService';
export { default as VoiceService } from './services/VoiceService';
export { default as HapticService } from './services/HapticService';
export { default as NetworkService } from './services/NetworkService';
export { default as SyncService } from './services/SyncService';
export { default as BackupService } from './services/BackupService';
export { default as SecurityService } from './services/SecurityService';
export { default as PerformanceService } from './services/PerformanceService';

// Aviation Services
export { default as FlightService } from './services/aviation/FlightService';
export { default as AirportService } from './services/aviation/AirportService';
export { default as BaggageService } from './services/aviation/BaggageService';
export { default as BookingService } from './services/aviation/BookingService';
export { default as WeatherService } from './services/aviation/WeatherService';
export { default as NavigationService } from './services/aviation/NavigationService';
export { default as CheckInService } from './services/aviation/CheckInService';

// AR/XR Services
export { default as ARService } from './services/ar/ARService';
export { default as XRService } from './services/ar/XRService';
export { default as SpatialService } from './services/ar/SpatialService';
export { default as TrackingService } from './services/ar/TrackingService';
export { default as RenderingService } from './services/ar/RenderingService';
export { default as InteractionService } from './services/ar/InteractionService';

// Commerce Services
export { default as ProductService } from './services/commerce/ProductService';
export { default as CartService } from './services/commerce/CartService';
export { default as PaymentService } from './services/commerce/PaymentService';
export { default as OrderService } from './services/commerce/OrderService';
export { default as InventoryService } from './services/commerce/InventoryService';
export { default as ShippingService } from './services/commerce/ShippingService';

// =============================================================================
// CONTEXTS
// =============================================================================

export { default as ThemeContext, ThemeProvider } from './contexts/ThemeContext';
export { default as AuthContext, AuthProvider } from './contexts/AuthContext';
export { default as I18nContext, I18nProvider } from './contexts/I18nContext';
export { default as ConfigContext, ConfigProvider } from './contexts/ConfigContext';
export { default as NotificationContext, NotificationProvider } from './contexts/NotificationContext';
export { default as AnalyticsContext, AnalyticsProvider } from './contexts/AnalyticsContext';
export { default as ErrorContext, ErrorProvider } from './contexts/ErrorContext';
export { default as LoadingContext, LoadingProvider } from './contexts/LoadingContext';
export { default as ModalContext, ModalProvider } from './contexts/ModalContext';
export { default as ToastContext, ToastProvider } from './contexts/ToastContext';

// Aviation Contexts
export { default as FlightContext, FlightProvider } from './contexts/aviation/FlightContext';
export { default as BookingContext, BookingProvider } from './contexts/aviation/BookingContext';
export { default as BaggageContext, BaggageProvider } from './contexts/aviation/BaggageContext';
export { default as NavigationContext, NavigationProvider } from './contexts/aviation/NavigationContext';

// AR/XR Contexts
export { default as ARContext, ARProvider } from './contexts/ar/ARContext';
export { default as XRContext, XRProvider } from './contexts/ar/XRContext';
export { default as SpatialContext, SpatialProvider } from './contexts/ar/SpatialContext';

// Commerce Contexts
export { default as CartContext, CartProvider } from './contexts/commerce/CartContext';
export { default as WishlistContext, WishlistProvider } from './contexts/commerce/WishlistContext';
export { default as CheckoutContext, CheckoutProvider } from './contexts/commerce/CheckoutContext';

// =============================================================================
// CONSTANTS
// =============================================================================

export * from './constants/api';
export * from './constants/routes';
export * from './constants/colors';
export * from './constants/typography';
export * from './constants/spacing';
export * from './constants/breakpoints';
export * from './constants/animations';
export * from './constants/zIndex';
export * from './constants/errors';
export * from './constants/events';
export * from './constants/storage';
export * from './constants/permissions';
export * from './constants/analytics';

// Aviation Constants
export * from './constants/aviation/airlines';
export * from './constants/aviation/airports';
export * from './constants/aviation/aircraft';
export * from './constants/aviation/classes';
export * from './constants/aviation/statuses';
export * from './constants/aviation/codes';

// AR/XR Constants
export * from './constants/ar/devices';
export * from './constants/ar/tracking';
export * from './constants/ar/rendering';
export * from './constants/ar/interaction';

// Commerce Constants
export * from './constants/commerce/categories';
export * from './constants/commerce/payment';
export * from './constants/commerce/shipping';
export * from './constants/commerce/currencies';

// =============================================================================
// VALIDATORS
// =============================================================================

export * from './validators/common';
export * from './validators/email';
export * from './validators/phone';
export * from './validators/password';
export * from './validators/credit-card';
export * from './validators/passport';
export * from './validators/aviation';
export * from './validators/address';
export * from './validators/date';
export * from './validators/file';
export * from './validators/url';

// =============================================================================
// FORMATTERS
// =============================================================================

export * from './formatters/date';
export * from './formatters/time';
export * from './formatters/currency';
export * from './formatters/number';
export * from './formatters/phone';
export * from './formatters/address';
export * from './formatters/flight';
export * from './formatters/duration';
export * from './formatters/distance';
export * from './formatters/file-size';

// =============================================================================
// TRANSFORMERS
// =============================================================================

export * from './transformers/api';
export * from './transformers/flight';
export * from './transformers/booking';
export * from './transformers/user';
export * from './transformers/payment';
export * from './transformers/analytics';

// =============================================================================
// MIDDLEWARE
// =============================================================================

export * from './middleware/auth';
export * from './middleware/logging';
export * from './middleware/error';
export * from './middleware/cache';
export * from './middleware/retry';
export * from './middleware/rate-limit';
export * from './middleware/validation';
export * from './middleware/analytics';

// =============================================================================
// PROVIDERS
// =============================================================================

export { default as AppProvider } from './providers/AppProvider';
export { default as QueryProvider } from './providers/QueryProvider';
export { default as RouterProvider } from './providers/RouterProvider';
export { default as StoreProvider } from './providers/StoreProvider';

// =============================================================================
// STORE
// =============================================================================

export * from './store/slices/auth';
export * from './store/slices/user';
export * from './store/slices/theme';
export * from './store/slices/i18n';
export * from './store/slices/config';
export * from './store/slices/notifications';
export * from './store/slices/analytics';
export * from './store/slices/error';
export * from './store/slices/loading';

// Aviation Store
export * from './store/slices/aviation/flights';
export * from './store/slices/aviation/bookings';
export * from './store/slices/aviation/baggage';
export * from './store/slices/aviation/airports';
export * from './store/slices/aviation/navigation';

// AR/XR Store
export * from './store/slices/ar/session';
export * from './store/slices/ar/tracking';
export * from './store/slices/ar/spatial';
export * from './store/slices/ar/interaction';

// Commerce Store
export * from './store/slices/commerce/cart';
export * from './store/slices/commerce/wishlist';
export * from './store/slices/commerce/products';
export * from './store/slices/commerce/orders';
export * from './store/slices/commerce/payment';

// =============================================================================
// TESTING UTILITIES
// =============================================================================

export * from './testing/mocks';
export * from './testing/fixtures';
export * from './testing/helpers';
export * from './testing/matchers';
export * from './testing/providers';

// =============================================================================
// VERSION AND METADATA
// =============================================================================

export const VERSION = '1.0.0';
export const BUILD_DATE = new Date().toISOString();
export const LIBRARY_NAME = 'AeroFusionXR Shared Components';

// =============================================================================
// DEFAULT EXPORT
// =============================================================================

export default {
  VERSION,
  BUILD_DATE,
  LIBRARY_NAME,
}; 