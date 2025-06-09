/**
 * @fileoverview AeroFusionXR AI Concierge Service - Main Application
 * @version 3.0.0
 * @author AeroFusionXR AI Engineering Team
 * @created 2024-01-10
 * @updated 2024-01-15
 * 
 * Complete AI Concierge Service with 23 comprehensive features:
 * 1. Multilingual Virtual Assistant
 * 2. Intelligent Airport Wayfinding
 * 3. Real-time Flight Updates & Notifications  
 * 4. Personalized Concierge Services
 * 5. VIP & Special Assistance Coordination
 * 6. Dynamic Itinerary & Booking Management
 * 7. Predictive Analytics & Recommendations
 * 8. Social Engagement & Community Platform
 * 9. Emergency Assistance & Support
 * 10. In-Flight Experience Enhancement
 * 11. Virtual Concierge Kiosks
 * 12. Accessibility & Inclusive Design
 * 13. Premium Lounge & Services Integration
 * 14. Advanced Analytics & Insights
 * 15. Gamification & Loyalty Rewards
 * 16. Augmented Reality Previews
 * 17. Voice & Conversational AI
 * 18. Biometric & Touchless Services
 * 19. Offline & Low-Bandwidth Support
 * 20. Emergency & Crisis Management
 * 21. Hyper-Personalized Content & Entertainment
 * 22. Language Translation & Cultural Tips
 * 23. Data Privacy, Security & Compliance
 */

import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import winston from 'winston';

// Import all feature routes
import { assistantRoutes } from './routes/assistantRoutes';
import { wayfindingRoutes } from './routes/wayfindingRoutes';
import { flightRoutes } from './routes/flightRoutes';
import { conciergeRoutes } from './routes/conciergeRoutes';
import { vipRoutes } from './routes/vipRoutes';
import { itineraryRoutes } from './routes/itineraryRoutes';
import { analyticsRoutes } from './routes/analyticsRoutes';
import { socialRoutes } from './routes/socialRoutes';
import { emergencyRoutes as emergencyAssistanceRoutes } from './routes/emergencyAssistanceRoutes';
import { inflightRoutes } from './routes/inflightRoutes';
import { kioskRoutes } from './routes/kioskRoutes';
import { accessibilityRoutes } from './routes/accessibilityRoutes';
import { loungeRoutes } from './routes/loungeRoutes';
import { insightsRoutes } from './routes/insightsRoutes';
import { gamificationRoutes } from './routes/gamificationRoutes';
import { arRoutes } from './routes/arRoutes';
import { voiceRoutes } from './routes/voiceRoutes';
import { biometricRoutes } from './routes/biometricRoutes';
import { offlineRoutes } from './routes/offlineRoutes';
import { emergencyRoutes } from './routes/emergencyRoutes';
import { contentRoutes } from './routes/contentRoutes';
import { translationRoutes } from './routes/translationRoutes';
import { privacyRoutes } from './routes/privacyRoutes';
import { corporateDashboardRoutes } from './routes/corporateDashboardRoutes';
import { retentionEngineRoutes } from './routes/retentionEngineRoutes';

// Core configuration and utilities
import { ConfigurationManager } from './core/ConfigurationManager';

class AeroFusionXRConcierge {
  private app: Express;
  private logger: winston.Logger;
  private config: ConfigurationManager;

  constructor() {
    this.app = express();
    this.initializeLogger();
    this.config = new ConfigurationManager();
    
    this.initializeMiddleware();
    this.initializeRoutes();
    this.initializeErrorHandling();
    
    this.logger.info('AeroFusionXR AI Concierge Service initialized successfully', {
      component: 'AeroFusionXRConcierge',
      features: 23,
      endpoints: '70+',
      capabilities: [
        'multilingual_ai_assistant',
        'intelligent_wayfinding',
        'real_time_flight_updates',
        'personalized_concierge',
        'vip_assistance_coordination',
        'dynamic_itinerary_management',
        'predictive_analytics',
        'social_engagement_platform',
        'emergency_assistance',
        'inflight_experience_enhancement',
        'virtual_concierge_kiosks',
        'accessibility_inclusive_design',
        'premium_lounge_integration',
        'advanced_analytics_insights',
        'gamification_loyalty_rewards',
        'augmented_reality_previews',
        'voice_conversational_ai',
        'biometric_touchless_services',
        'offline_low_bandwidth_support',
        'emergency_crisis_management',
        'hyper_personalized_content',
        'language_translation_cultural_tips',
        'data_privacy_security_compliance'
      ]
    });
  }

  private initializeLogger(): void {
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: 'aerofusionxr-concierge' },
      transports: [
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/combined.log' }),
        new winston.transports.Console({
          format: winston.format.simple()
        })
      ]
    });
  }

  private initializeMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", "wss:", "https:"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"]
        }
      },
      crossOriginEmbedderPolicy: false
    }));

    // CORS configuration
    this.app.use(cors({
      origin: [
        'https://emirates.com',
        'https://*.emirates.com',
        'https://aerofusionxr.emirates.com',
        'http://localhost:3000' // Development
      ],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-User-ID', 'X-Session-ID']
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 1000, // Limit each IP to 1000 requests per windowMs
      message: 'Too many requests from this IP, please try again later.',
      standardHeaders: true,
      legacyHeaders: false
    });
    this.app.use(limiter);

    // Body parsing and compression
    this.app.use(compression());
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging
    this.app.use((req: Request, res: Response, next) => {
      this.logger.info('Incoming request', {
        method: req.method,
        url: req.url,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });
      next();
    });
  }

  private initializeRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({
        status: 'healthy',
        service: 'AeroFusionXR AI Concierge Service',
        version: '3.0.0',
        features: 23,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development'
      });
    });

    // API documentation endpoint
    this.app.get('/api/docs', (req: Request, res: Response) => {
      res.json({
        service: 'AeroFusionXR AI Concierge Service',
        version: '3.0.0',
        description: 'Comprehensive AI-powered concierge service for Emirates Airlines with 23 enterprise features',
        features: {
          total: 23,
          list: [
            {
              id: 1,
              name: 'Multilingual Virtual Assistant',
              description: 'AI-powered chat and voice assistant with 8+ language support',
              endpoints: ['/api/v1/assistant/chat', '/api/v1/assistant/voice', '/api/v1/assistant/context']
            },
            {
              id: 2,
              name: 'Intelligent Airport Wayfinding',
              description: 'Real-time indoor navigation with AR overlays and accessibility support',
              endpoints: ['/api/v1/wayfinding/navigate', '/api/v1/wayfinding/ar-overlay', '/api/v1/wayfinding/accessibility']
            },
            {
              id: 3,
              name: 'Real-time Flight Updates & Notifications',
              description: 'Proactive flight status updates with multi-channel notifications',
              endpoints: ['/api/v1/flights/status', '/api/v1/flights/subscribe', '/api/v1/flights/notifications']
            },
            {
              id: 4,
              name: 'Personalized Concierge Services',
              description: 'Tailored recommendations and booking assistance',
              endpoints: ['/api/v1/concierge/recommendations', '/api/v1/concierge/booking', '/api/v1/concierge/preferences']
            },
            {
              id: 5,
              name: 'VIP & Special Assistance Coordination',
              description: 'Premium passenger experience with dedicated coordination',
              endpoints: ['/api/v1/vip/profile', '/api/v1/vip/services', '/api/v1/vip/coordination']
            },
            {
              id: 6,
              name: 'Dynamic Itinerary & Booking Management',
              description: 'Real-time itinerary updates with intelligent rebooking',
              endpoints: ['/api/v1/itinerary/view', '/api/v1/itinerary/modify', '/api/v1/itinerary/optimize']
            },
            {
              id: 7,
              name: 'Predictive Analytics & Recommendations',
              description: 'ML-powered predictions for enhanced passenger experience',
              endpoints: ['/api/v1/analytics/predict', '/api/v1/analytics/recommend', '/api/v1/analytics/insights']
            },
            {
              id: 8,
              name: 'Social Engagement & Community Platform',
              description: 'Passenger networking and shared experience platform',
              endpoints: ['/api/v1/social/connect', '/api/v1/social/groups', '/api/v1/social/activities']
            },
            {
              id: 9,
              name: 'Emergency Assistance & Support',
              description: '24/7 emergency support with immediate escalation',
              endpoints: ['/api/v1/emergency-assistance/alert', '/api/v1/emergency-assistance/support', '/api/v1/emergency-assistance/escalate']
            },
            {
              id: 10,
              name: 'In-Flight Experience Enhancement',
              description: 'Seamless inflight service integration and entertainment',
              endpoints: ['/api/v1/inflight/services', '/api/v1/inflight/entertainment', '/api/v1/inflight/dining']
            },
            {
              id: 11,
              name: 'Virtual Concierge Kiosks',
              description: 'Self-service kiosks with full concierge capabilities',
              endpoints: ['/api/v1/kiosk/initialize', '/api/v1/kiosk/services', '/api/v1/kiosk/status']
            },
            {
              id: 12,
              name: 'Accessibility & Inclusive Design',
              description: 'Comprehensive accessibility features for all passengers',
              endpoints: ['/api/v1/accessibility/features', '/api/v1/accessibility/assistance', '/api/v1/accessibility/settings']
            },
            {
              id: 13,
              name: 'Premium Lounge & Services Integration',
              description: 'Seamless premium lounge experience management',
              endpoints: ['/api/v1/lounge/access', '/api/v1/lounge/services', '/api/v1/lounge/amenities']
            },
            {
              id: 14,
              name: 'Advanced Analytics & Insights',
              description: 'Real-time operational analytics and passenger insights',
              endpoints: ['/api/v1/insights/dashboard', '/api/v1/insights/reports', '/api/v1/insights/metrics']
            },
            {
              id: 15,
              name: 'Gamification & Loyalty Rewards',
              description: 'Engaging loyalty program with gamified experiences',
              endpoints: ['/api/v1/gamification/profile', '/api/v1/gamification/challenges', '/api/v1/gamification/rewards']
            },
            {
              id: 16,
              name: 'Augmented Reality Previews',
              description: 'AR-enhanced airport and destination previews',
              endpoints: ['/api/v1/ar/preview', '/api/v1/ar/experiences', '/api/v1/ar/content']
            },
            {
              id: 17,
              name: 'Voice & Conversational AI',
              description: 'Advanced voice interaction with natural language processing',
              endpoints: ['/api/v1/voice/process', '/api/v1/voice/synthesize', '/api/v1/voice/settings']
            },
            {
              id: 18,
              name: 'Biometric & Touchless Services',
              description: 'Secure biometric authentication and touchless interactions',
              endpoints: ['/api/v1/biometric/enroll', '/api/v1/biometric/authenticate', '/api/v1/biometric/services']
            },
            {
              id: 19,
              name: 'Offline & Low-Bandwidth Support',
              description: 'Robust offline functionality with sync capabilities',
              endpoints: ['/api/v1/offline/sync', '/api/v1/offline/cache', '/api/v1/offline/status']
            },
            {
              id: 20,
              name: 'Emergency & Crisis Management',
              description: 'Large-scale emergency coordination and crisis communication',
              endpoints: ['/api/v1/emergency/incident/create', '/api/v1/emergency/notification/broadcast', '/api/v1/emergency/evacuation/initiate']
            },
            {
              id: 21,
              name: 'Hyper-Personalized Content & Entertainment',
              description: 'AI-curated content and pre-flight entertainment recommendations',
              endpoints: ['/api/v1/content/recommendations', '/api/v1/content/prefetch', '/api/v1/content/ife/pushContent']
            },
            {
              id: 22,
              name: 'Language Translation & Cultural Tips',
              description: 'Real-time translation with cultural guidance for Dubai travelers',
              endpoints: ['/api/v1/translation/translate', '/api/v1/translation/cultural-tips', '/api/v1/translation/prayer-times']
            },
            {
              id: 23,
              name: 'Data Privacy, Security & Compliance',
              description: 'End-to-end privacy, security, and regulatory compliance (GDPR, PDPA)',
              endpoints: ['/api/v1/privacy/consent', '/api/v1/privacy/requestData', '/api/v1/privacy/deleteData']
            }
          ]
        },
        totalEndpoints: 70,
        apiVersion: 'v1',
        baseUrl: '/api/v1',
        documentation: 'https://docs.aerofusionxr.emirates.com',
        support: 'support@aerofusionxr.emirates.com'
      });
    });

    // Register all feature routes
    this.app.use('/api/v1/assistant', assistantRoutes);
    this.app.use('/api/v1/wayfinding', wayfindingRoutes);
    this.app.use('/api/v1/flights', flightRoutes);
    this.app.use('/api/v1/concierge', conciergeRoutes);
    this.app.use('/api/v1/vip', vipRoutes);
    this.app.use('/api/v1/itinerary', itineraryRoutes);
    this.app.use('/api/v1/analytics', analyticsRoutes);
    this.app.use('/api/v1/social', socialRoutes);
    this.app.use('/api/v1/emergency-assistance', emergencyAssistanceRoutes);
    this.app.use('/api/v1/inflight', inflightRoutes);
    this.app.use('/api/v1/kiosk', kioskRoutes);
    this.app.use('/api/v1/accessibility', accessibilityRoutes);
    this.app.use('/api/v1/lounge', loungeRoutes);
    this.app.use('/api/v1/insights', insightsRoutes);
    this.app.use('/api/v1/gamification', gamificationRoutes);
    this.app.use('/api/v1/ar', arRoutes);
    this.app.use('/api/v1/voice', voiceRoutes);
    this.app.use('/api/v1/biometric', biometricRoutes);
    this.app.use('/api/v1/offline', offlineRoutes);
    this.app.use('/api/v1/emergency', emergencyRoutes);
    this.app.use('/api/v1/content', contentRoutes);
    this.app.use('/api/v1/translation', translationRoutes);
    this.app.use('/api/v1/privacy', privacyRoutes);
    this.app.use('/api/v1/corporate', corporateDashboardRoutes);
    this.app.use('/api/v1/retention', retentionEngineRoutes);

    // Root endpoint
    this.app.get('/', (req: Request, res: Response) => {
      res.json({
        message: 'Welcome to AeroFusionXR AI Concierge Service',
        version: '3.0.0',
        features: 23,
        endpoints: {
          health: '/health',
          documentation: '/api/docs',
          api: '/api/v1'
        },
        description: 'Enterprise-grade AI concierge service for Emirates Airlines with comprehensive passenger experience features'
      });
    });
  }

  private initializeErrorHandling(): void {
    // 404 handler
    this.app.use('*', (req: Request, res: Response) => {
      res.status(404).json({
        error: 'NOT_FOUND',
        message: 'The requested endpoint was not found',
        path: req.originalUrl,
        method: req.method,
        timestamp: new Date().toISOString()
      });
    });

    // Global error handler
    this.app.use((error: Error, req: Request, res: Response, next: any) => {
      this.logger.error('Unhandled error', {
        error: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method
      });

      res.status(500).json({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    });
  }

  public getApp(): Express {
    return this.app;
  }

  public start(port: number = 3000): void {
    this.app.listen(port, () => {
      this.logger.info(`AeroFusionXR AI Concierge Service started successfully`, {
        port,
        environment: process.env.NODE_ENV || 'development',
        features: 23,
        endpoints: 70,
        pid: process.pid
      });
    });
  }
}

// Application instance
const conciergeService = new AeroFusionXRConcierge();

// Start server if running directly
if (require.main === module) {
  const port = parseInt(process.env.PORT || '3000', 10);
  conciergeService.start(port);
}

export default conciergeService; 