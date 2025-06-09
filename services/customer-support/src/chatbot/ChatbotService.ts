import { createLogger } from '@aerofusionxr/shared';
import { PerformanceMonitor } from '@aerofusionxr/shared';
import { SecurityService, SupportSecurityContext } from '../security/SecurityService';
import { NLUService } from './NLUService';
import { KnowledgeBaseService } from '../knowledge/KnowledgeBaseService';
import { VoiceService } from '../voice/VoiceService';

// Core chatbot interfaces
export interface ChatMessage {
  messageID: string;
  sessionID: string;
  from: 'user' | 'bot' | 'agent';
  messageType: 'text' | 'voice' | 'image' | 'file' | 'action';
  content: string;
  timestamp: Date;
  metadata?: any;
}

export interface ChatSession {
  sessionID: string;
  userID: string;
  language: string;
  status: 'active' | 'waiting_agent' | 'with_agent' | 'closed';
  startTime: Date;
  endTime?: Date;
  context: { [key: string]: any };
  messageHistory: ChatMessage[];
}

export interface Intent {
  name: string;
  confidence: number;
  entities: { [key: string]: any };
}

export interface BotResponse {
  messageID: string;
  sessionID: string;
  content: string;
  voiceContent?: string;
  intent: string;
  confidence: number;
  actions?: BotAction[];
  requiresAgent?: boolean;
  metadata?: any;
}

export interface BotAction {
  type: 'navigate' | 'search' | 'call_api' | 'handoff_agent' | 'show_ui';
  params: { [key: string]: any };
}

export interface ChatRequest {
  sessionID: string;
  userID: string;
  message: string;
  messageType: 'text' | 'voice';
  language: string;
  context?: { [key: string]: any };
}

// Error classes
export class ChatbotError extends Error {
  constructor(message: string, public code: string, public sessionID?: string) {
    super(message);
    this.name = 'ChatbotError';
  }
}

export class SessionNotFoundError extends ChatbotError {
  constructor(sessionID: string) {
    super(`Session not found: ${sessionID}`, 'SESSION_NOT_FOUND', sessionID);
  }
}

export class NLUProcessingError extends ChatbotError {
  constructor(sessionID: string, error: string) {
    super(`NLU processing failed: ${error}`, 'NLU_ERROR', sessionID);
  }
}

export class ChatbotService {
  private logger: Logger;
  private performanceMonitor: PerformanceMonitor;
  private securityService: SecurityService;
  private nluService: NLUService;
  private knowledgeBaseService: KnowledgeBaseService;
  private voiceService: VoiceService;

  // Active chat sessions
  private activeSessions: Map<string, ChatSession> = new Map();
  private responseTemplates: Map<string, string> = new Map();

  // Configuration
  private readonly DEFAULT_CONFIDENCE_THRESHOLD = 0.7;
  private readonly MAX_SESSION_DURATION = 30 * 60 * 1000; // 30 minutes
  private readonly MAX_MESSAGES_PER_SESSION = 50;

  constructor() {
    this.logger = new Logger('ChatbotService');
    this.performanceMonitor = new PerformanceMonitor('ChatbotService');
    this.securityService = new SecurityService();
    this.nluService = new NLUService();
    this.knowledgeBaseService = new KnowledgeBaseService();
    this.voiceService = new VoiceService();

    this.initializeResponseTemplates();
    this.startSessionCleanup();
  }

  /**
   * Start a new chat session
   */
  async startSession(userID: string, language: string = 'en-US'): Promise<ChatSession> {
    try {
      const sessionID = this.generateSessionID();
      
      const session: ChatSession = {
        sessionID,
        userID,
        language,
        status: 'active',
        startTime: new Date(),
        context: {},
        messageHistory: []
      };

      this.activeSessions.set(sessionID, session);

      // Send welcome message
      await this.sendWelcomeMessage(session);

      this.logger.info('Chat session started', {
        sessionID,
        userID,
        language
      });

      return session;
    } catch (error) {
      this.logger.error('Failed to start chat session', {
        userID,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Process user message and generate bot response
   */
  async processMessage(request: ChatRequest, context: SupportSecurityContext): Promise<BotResponse> {
    const startTime = Date.now();

    try {
      this.logger.info('Processing chat message', {
        sessionID: request.sessionID,
        userID: request.userID,
        messageType: request.messageType,
        language: request.language
      });

      // Validate request
      await this.validateChatRequest(request, context);

      // Get session
      const session = this.activeSessions.get(request.sessionID);
      if (!session) {
        throw new SessionNotFoundError(request.sessionID);
      }

      // Add user message to history
      const userMessage = await this.addMessageToHistory(session, {
        from: 'user',
        messageType: request.messageType,
        content: request.message,
        sessionID: request.sessionID,
        messageID: this.generateMessageID(),
        timestamp: new Date()
      });

      // Process voice input if needed
      let processedMessage = request.message;
      if (request.messageType === 'voice') {
        processedMessage = await this.voiceService.speechToText(request.message, request.language);
      }

      // Perform NLU processing
      const intent = await this.nluService.processMessage(processedMessage, request.language, session.context);

      // Generate response based on intent
      const response = await this.generateResponse(session, intent, processedMessage);

      // Add bot response to history
      await this.addMessageToHistory(session, {
        from: 'bot',
        messageType: 'text',
        content: response.content,
        sessionID: request.sessionID,
        messageID: response.messageID,
        timestamp: new Date(),
        metadata: { intent: intent.name, confidence: intent.confidence }
      });

      // Record metrics
      await this.performanceMonitor.recordMetric('message_processing_duration', Date.now() - startTime, {
        sessionID: request.sessionID,
        intent: intent.name,
        confidence: intent.confidence,
        messageType: request.messageType
      });

      this.logger.info('Message processed successfully', {
        sessionID: request.sessionID,
        intent: intent.name,
        confidence: intent.confidence,
        duration: Date.now() - startTime
      });

      return response;

    } catch (error) {
      this.logger.error('Failed to process message', {
        sessionID: request.sessionID,
        userID: request.userID,
        error: error.message,
        duration: Date.now() - startTime
      });

      // Record error metrics
      await this.performanceMonitor.recordMetric('message_processing_errors', 1, {
        sessionID: request.sessionID,
        errorType: error.constructor.name
      });

      // Generate fallback response
      return await this.generateFallbackResponse(request.sessionID, error.message);
    }
  }

  /**
   * Generate response based on intent
   */
  private async generateResponse(session: ChatSession, intent: Intent, message: string): Promise<BotResponse> {
    const responseID = this.generateMessageID();
    
    try {
      let content = '';
      let voiceContent = '';
      const actions: BotAction[] = [];
      let requiresAgent = false;

      switch (intent.name) {
        case 'flightStatusQuery':
          content = await this.handleFlightStatusQuery(intent.entities, session.language);
          if (intent.entities.flightNumber) {
            actions.push({
              type: 'navigate',
              params: { 
                target: 'gate',
                gateID: intent.entities.gateID 
              }
            });
          }
          break;

        case 'orderStatusQuery':
          content = await this.handleOrderStatusQuery(intent.entities, session.language);
          if (intent.entities.orderStatus === 'Canceled') {
            actions.push({
              type: 'show_ui',
              params: { 
                component: 'RefundOptions',
                orderID: intent.entities.orderID 
              }
            });
          }
          break;

        case 'storeHoursQuery':
          content = await this.handleStoreHoursQuery(intent.entities, session.language);
          break;

        case 'poiQuery':
          content = await this.handlePOIQuery(intent.entities, session.language);
          if (intent.entities.nodeID) {
            actions.push({
              type: 'navigate',
              params: { 
                target: 'poi',
                nodeID: intent.entities.nodeID 
              }
            });
          }
          break;

        case 'handoffRequest':
          content = await this.handleAgentHandoff(session);
          requiresAgent = true;
          session.status = 'waiting_agent';
          break;

        case 'fallback':
          content = await this.handleFallback(message, session.language);
          break;

        default:
          content = await this.handleUnknownIntent(intent, session.language);
      }

      // Generate voice content if needed
      if (session.context.voiceEnabled) {
        voiceContent = await this.voiceService.textToSpeech(content, session.language);
      }

      return {
        messageID: responseID,
        sessionID: session.sessionID,
        content,
        voiceContent,
        intent: intent.name,
        confidence: intent.confidence,
        actions,
        requiresAgent,
        metadata: {
          generatedAt: new Date(),
          processingTime: Date.now(),
          entities: intent.entities
        }
      };

    } catch (error) {
      this.logger.error('Failed to generate response', {
        sessionID: session.sessionID,
        intent: intent.name,
        error: error.message
      });
      
      return await this.generateFallbackResponse(session.sessionID, 'I encountered an error processing your request.');
    }
  }

  /**
   * Handle flight status queries
   */
  private async handleFlightStatusQuery(entities: any, language: string): Promise<string> {
    try {
      if (!entities.flightNumber) {
        return this.getLocalizedTemplate('flight_number_required', language);
      }

      // Mock flight status API call
      const flightInfo = await this.mockFlightStatusAPI(entities.flightNumber);
      
      if (!flightInfo) {
        return this.getLocalizedTemplate('flight_not_found', language, { flightNumber: entities.flightNumber });
      }

      return this.getLocalizedTemplate('flight_status', language, {
        flightNumber: entities.flightNumber,
        status: flightInfo.status,
        gate: flightInfo.gate,
        departureTime: flightInfo.departureTime
      });

    } catch (error) {
      this.logger.error('Flight status query failed', { entities, error: error.message });
      return this.getLocalizedTemplate('flight_status_error', language);
    }
  }

  /**
   * Handle order status queries
   */
  private async handleOrderStatusQuery(entities: any, language: string): Promise<string> {
    try {
      if (!entities.orderID) {
        return this.getLocalizedTemplate('order_id_required', language);
      }

      // Mock order status API call
      const orderInfo = await this.mockOrderStatusAPI(entities.orderID);
      
      if (!orderInfo) {
        return this.getLocalizedTemplate('order_not_found', language, { orderID: entities.orderID });
      }

      return this.getLocalizedTemplate('order_status', language, {
        orderID: entities.orderID,
        status: orderInfo.status,
        date: orderInfo.date
      });

    } catch (error) {
      this.logger.error('Order status query failed', { entities, error: error.message });
      return this.getLocalizedTemplate('order_status_error', language);
    }
  }

  /**
   * Handle store hours queries
   */
  private async handleStoreHoursQuery(entities: any, language: string): Promise<string> {
    try {
      const storeType = entities.storeType || 'general';
      
      // Mock store hours API call
      const storeHours = await this.mockStoreHoursAPI(storeType);
      
      return this.getLocalizedTemplate('store_hours', language, {
        storeType,
        openTime: storeHours.open,
        closeTime: storeHours.close
      });

    } catch (error) {
      this.logger.error('Store hours query failed', { entities, error: error.message });
      return this.getLocalizedTemplate('store_hours_error', language);
    }
  }

  /**
   * Handle POI queries
   */
  private async handlePOIQuery(entities: any, language: string): Promise<string> {
    try {
      const product = entities.product || entities.category;
      
      if (!product) {
        return this.getLocalizedTemplate('poi_product_required', language);
      }

      // Mock POI search
      const poiInfo = await this.mockPOISearchAPI(product);
      
      if (!poiInfo) {
        return this.getLocalizedTemplate('poi_not_found', language, { product });
      }

      return this.getLocalizedTemplate('poi_found', language, {
        product,
        storeName: poiInfo.name,
        location: poiInfo.location
      });

    } catch (error) {
      this.logger.error('POI query failed', { entities, error: error.message });
      return this.getLocalizedTemplate('poi_error', language);
    }
  }

  /**
   * Handle agent handoff requests
   */
  private async handleAgentHandoff(session: ChatSession): Promise<string> {
    // In production, this would interface with agent queue system
    return this.getLocalizedTemplate('agent_handoff', session.language);
  }

  /**
   * Handle fallback scenarios
   */
  private async handleFallback(message: string, language: string): Promise<string> {
    try {
      // Search knowledge base
      const kbResults = await this.knowledgeBaseService.search(message, language);
      
      if (kbResults.length > 0) {
        return kbResults[0].answer;
      }

      return this.getLocalizedTemplate('fallback_no_answer', language);
    } catch (error) {
      return this.getLocalizedTemplate('fallback_error', language);
    }
  }

  /**
   * Handle unknown intents
   */
  private async handleUnknownIntent(intent: Intent, language: string): Promise<string> {
    return this.getLocalizedTemplate('unknown_intent', language);
  }

  /**
   * Generate fallback response for errors
   */
  private async generateFallbackResponse(sessionID: string, errorMessage: string): Promise<BotResponse> {
    return {
      messageID: this.generateMessageID(),
      sessionID,
      content: "I'm sorry, I encountered an error. Please try again or speak with an agent.",
      intent: 'error',
      confidence: 1.0,
      actions: [{
        type: 'handoff_agent',
        params: { reason: 'error' }
      }],
      requiresAgent: true
    };
  }

  /**
   * Helper methods
   */
  private async validateChatRequest(request: ChatRequest, context: SupportSecurityContext): Promise<void> {
    if (!request.sessionID || !request.userID || !request.message) {
      throw new ChatbotError('Invalid chat request', 'INVALID_REQUEST');
    }

    // Security validation
    await this.securityService.validateSupportRequest(request.userID, 'chat.message', context);
  }

  private async addMessageToHistory(session: ChatSession, message: Omit<ChatMessage, 'messageID'>): Promise<ChatMessage> {
    const fullMessage: ChatMessage = {
      ...message,
      messageID: message.messageID || this.generateMessageID()
    };

    session.messageHistory.push(fullMessage);

    // Limit message history size
    if (session.messageHistory.length > this.MAX_MESSAGES_PER_SESSION) {
      session.messageHistory = session.messageHistory.slice(-this.MAX_MESSAGES_PER_SESSION);
    }

    return fullMessage;
  }

  private async sendWelcomeMessage(session: ChatSession): Promise<void> {
    const welcomeMessage = this.getLocalizedTemplate('welcome', session.language);
    
    await this.addMessageToHistory(session, {
      from: 'bot',
      messageType: 'text',
      content: welcomeMessage,
      sessionID: session.sessionID,
      timestamp: new Date()
    });
  }

  private generateSessionID(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateMessageID(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getLocalizedTemplate(key: string, language: string, params?: any): string {
    // Simplified localization - in production would use proper i18n
    const templates = this.responseTemplates.get(key) || 'Template not found';
    
    if (params) {
      return this.interpolateTemplate(templates, params);
    }
    
    return templates;
  }

  private interpolateTemplate(template: string, params: any): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return params[key] || match;
    });
  }

  private initializeResponseTemplates(): void {
    const templates = new Map([
      ['welcome', 'Hello! I\'m here to help you with flight information, orders, directions, and more. How can I assist you today?'],
      ['flight_status', 'Flight {{flightNumber}} is {{status}}. It departs from Gate {{gate}} at {{departureTime}}.'],
      ['flight_not_found', 'I couldn\'t find flight {{flightNumber}}. Please check the flight number and try again.'],
      ['flight_number_required', 'Please provide a flight number so I can check its status.'],
      ['flight_status_error', 'I\'m having trouble accessing flight information right now. Please try again later.'],
      ['order_status', 'Your order {{orderID}} is {{status}} as of {{date}}.'],
      ['order_not_found', 'I couldn\'t find order {{orderID}}. Please verify the order number.'],
      ['order_id_required', 'Please provide your order number so I can check its status.'],
      ['order_status_error', 'I\'m having trouble accessing order information right now.'],
      ['store_hours', 'The {{storeType}} stores are open from {{openTime}} to {{closeTime}}.'],
      ['store_hours_error', 'I\'m having trouble getting store hours right now.'],
      ['poi_found', '{{product}} is available at {{storeName}} located at {{location}}.'],
      ['poi_not_found', 'I couldn\'t find {{product}} in our stores. Please try a different search.'],
      ['poi_product_required', 'What product or store are you looking for?'],
      ['poi_error', 'I\'m having trouble searching for locations right now.'],
      ['agent_handoff', 'I\'m connecting you with a live agent who can better assist you. Please hold on.'],
      ['fallback_no_answer', 'I\'m not sure I understand. Could you rephrase your question or ask me about flights, orders, store hours, or directions?'],
      ['fallback_error', 'I\'m having trouble processing your request. Would you like to speak with an agent?'],
      ['unknown_intent', 'I didn\'t quite catch that. You can ask me about flight status, order information, store locations, or speak with an agent.']
    ]);

    this.responseTemplates = templates;
  }

  // Mock API methods (in production these would call real services)
  private async mockFlightStatusAPI(flightNumber: string): Promise<any> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    if (flightNumber === 'SQ321') {
      return {
        status: 'On Time',
        gate: 'C12',
        departureTime: '11:15',
        gateID: 'gate_c12'
      };
    }
    return null;
  }

  private async mockOrderStatusAPI(orderID: string): Promise<any> {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    if (orderID === 'ORD12345') {
      return {
        status: 'Canceled',
        date: 'June 4, 2025'
      };
    }
    return null;
  }

  private async mockStoreHoursAPI(storeType: string): Promise<any> {
    await new Promise(resolve => setTimeout(resolve, 50));
    
    return {
      open: '06:00',
      close: '23:00'
    };
  }

  private async mockPOISearchAPI(product: string): Promise<any> {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    if (product.includes('headphone')) {
      return {
        name: 'Electronics World',
        location: 'Terminal 1, Level 2',
        nodeID: 'node_345'
      };
    }
    return null;
  }

  /**
   * Session management
   */
  private startSessionCleanup(): void {
    setInterval(() => {
      this.cleanupExpiredSessions();
    }, 5 * 60 * 1000); // Run every 5 minutes
  }

  private cleanupExpiredSessions(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [sessionID, session] of this.activeSessions) {
      const sessionAge = now - session.startTime.getTime();
      
      if (sessionAge > this.MAX_SESSION_DURATION && session.status !== 'with_agent') {
        this.activeSessions.delete(sessionID);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.info('Cleaned up expired sessions', { count: cleanedCount });
    }
  }

  /**
   * Get session information
   */
  async getSession(sessionID: string): Promise<ChatSession | null> {
    return this.activeSessions.get(sessionID) || null;
  }

  /**
   * End chat session
   */
  async endSession(sessionID: string): Promise<void> {
    const session = this.activeSessions.get(sessionID);
    if (session) {
      session.status = 'closed';
      session.endTime = new Date();
      this.activeSessions.delete(sessionID);
      
      this.logger.info('Session ended', {
        sessionID,
        duration: session.endTime.getTime() - session.startTime.getTime(),
        messageCount: session.messageHistory.length
      });
    }
  }

  /**
   * Get service health status
   */
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    activeSessions: number;
    dependencies: { [key: string]: boolean };
    metrics: any;
  }> {
    const nluHealth = await this.nluService.getHealth();
    const kbHealth = await this.knowledgeBaseService.getHealth();
    const voiceHealth = await this.voiceService.getHealth();

    const healthyServices = [
      nluHealth.available,
      kbHealth.available,
      voiceHealth.available
    ].filter(s => s).length;

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (healthyServices === 3) {
      status = 'healthy';
    } else if (healthyServices > 1) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return {
      status,
      activeSessions: this.activeSessions.size,
      dependencies: {
        nlu: nluHealth.available,
        knowledgeBase: kbHealth.available,
        voice: voiceHealth.available
      },
      metrics: {
        avgProcessingTime: this.performanceMonitor.getMetricStats('message_processing_duration')?.avg || 0,
        totalMessages: this.performanceMonitor.getMetricStats('message_processing_duration')?.count || 0,
        errorRate: this.performanceMonitor.getMetricStats('message_processing_errors')?.count || 0
      }
    };
  }
} 
