import { AppError, ErrorCode } from '../../../ai-concierge/src/shared/errors/index';
import { createLogger } from '@aerofusionxr/shared';
import { PerformanceMonitor } from '@aerofusionxr/shared';
import { SecurityService } from '../security/SecurityService';
import { ARVRBridgeService } from '../../../ar-vr-bridge/src/core/ARVRBridgeService';

// Voice Guidance interfaces
export interface AudioPrompt {
  promptID: string;
  textKey: string;
  language: string;
  voice: string;
  rate: number;
  audioURL: string;
  checksum: string;
  durationMs: number;
  createdAt: Date;
}

export interface UserVoiceSettings {
  userID: string;
  preferredLanguage: string;
  preferredVoice: string;
  speechRate: number;
  enableContinuousNarration: boolean;
  lastUpdated: Date;
}

export interface VoicePromptRequest {
  textKey: string;
  language?: string;
  voice?: string;
  rate?: number;
}

export interface VoicePromptResponse {
  promptID: string;
  audioURL: string;
  checksum: string;
  durationMs: number;
}

export interface VoiceCommandRequest {
  userID: string;
  audioBase64: string;
  language: string;
  context: 'search' | 'navigation' | 'shopping';
}

export interface VoiceCommandResponse {
  action: 'searchResults' | 'navigationRoute' | 'recognition_failed' | 'recognition_unavailable';
  results?: POISearchResult[];
  routeSteps?: RouteStep[];
  message?: string;
}

export interface POISearchResult {
  poiID: string;
  name: string;
  distance: number;
  floor: number;
}

export interface RouteStep {
  textKey: string;
  distance: number;
  direction: string;
  location: Location3D;
}

export interface Location3D {
  x: number;
  y: number;
  z: number;
}

export interface VoiceSettingsRequest {
  preferredLanguage?: string;
  preferredVoice?: string;
  speechRate?: number;
  enableContinuousNarration?: boolean;
}

export interface OfflineVoiceCommand {
  commandID: string;
  userID: string;
  transcript: string;
  context: string;
  timestampQueued: Date;
  status: 'pending' | 'completed' | 'failed';
}

export interface TTSRequest {
  text: string;
  voice: string;
  languageCode: string;
  speed: number;
}

export interface TTSResponse {
  audioData: ArrayBuffer;
  checksum: string;
  duration: number;
}

export interface STTRequest {
  audioData: ArrayBuffer;
  languageCode: string;
  model: string;
}

export interface STTResponse {
  transcript: string;
  confidence: number;
}

export interface VoiceEvent {
  eventID: string;
  userID: string;
  promptID?: string;
  textKey?: string;
  transcript?: string;
  confidence?: number;
  action?: string;
  context?: string;
  language: string;
  voice: string;
  rate: number;
  timestamp: Date;
}

// Voice-specific error types
export class TTSServiceError extends AppError {
  readonly statusCode = 503;
  readonly errorCode = ErrorCode.SERVICE_UNAVAILABLE;
  readonly isOperational = true;

  constructor(message: string, context: any) {
    super(message, context);
  }
}

export class STTServiceError extends AppError {
  readonly statusCode = 503;
  readonly errorCode = ErrorCode.SERVICE_UNAVAILABLE;
  readonly isOperational = true;

  constructor(message: string, context: any) {
    super(message, context);
  }
}

export class UnsupportedLanguageError extends AppError {
  readonly statusCode = 400;
  readonly errorCode = ErrorCode.BUSINESS_RULE_VIOLATION;
  readonly isOperational = true;

  constructor(message: string, context: any) {
    super(message, context);
  }
}

export class VoiceRecognitionError extends AppError {
  readonly statusCode = 400;
  readonly errorCode = ErrorCode.BUSINESS_RULE_VIOLATION;
  readonly isOperational = true;

  constructor(message: string, context: any) {
    super(message, context);
  }
}

export class VoiceServiceError extends AppError {
  readonly statusCode = 503;
  readonly errorCode = ErrorCode.SERVICE_UNAVAILABLE;
  readonly isOperational = true;

  constructor(message: string, context: any) {
    super(message, context);
  }
}

/**
 * Voice Guidance & Audio Narration Service
 * Provides contextual voice guidance, TTS/STT processing, and multilingual support
 */
export class VoiceGuidanceService {
  private logger: Logger;
  private performanceMonitor: PerformanceMonitor;
  private securityService: SecurityService;
  private bridgeService: ARVRBridgeService;
  private audioPromptsCache: Map<string, AudioPrompt>;
  private userSettingsCache: Map<string, UserVoiceSettings>;
  private offlineCommandsQueue: Map<string, OfflineVoiceCommand[]>;
  private supportedLanguages: Set<string>;
  private supportedVoices: Map<string, string[]>;

  constructor() {
    this.logger = new Logger('VoiceGuidanceService');
    this.performanceMonitor = new PerformanceMonitor();
    this.securityService = new SecurityService();
    this.bridgeService = new ARVRBridgeService();
    this.audioPromptsCache = new Map();
    this.userSettingsCache = new Map();
    this.offlineCommandsQueue = new Map();
    this.supportedLanguages = new Set(['en-US', 'fr-FR', 'ar-AE', 'zh-CN', 'es-ES', 'de-DE']);
    this.supportedVoices = new Map([
      ['en-US', ['Joanna', 'Matthew', 'Amy', 'Brian']],
      ['fr-FR', ['Lea', 'Mathieu', 'Celine']],
      ['ar-AE', ['Zeina', 'Hala']],
      ['zh-CN', ['Zhiyu', 'Xiaoyan']],
      ['es-ES', ['Conchita', 'Enrique']],
      ['de-DE', ['Marlene', 'Hans']]
    ]);

    // Initialize mock data
    this.initializeMockData();
  }

  /**
   * Get voice prompt audio
   */
  async getVoicePrompt(request: VoicePromptRequest, userID: string): Promise<VoicePromptResponse> {
    const startTime = Date.now();

    try {
      this.logger.debug('Getting voice prompt', {
        textKey: request.textKey,
        language: request.language,
        userID
      });

      // Get user settings for defaults
      const userSettings = await this.getUserSettings(userID);
      const language = request.language || userSettings.preferredLanguage;
      const voice = request.voice || userSettings.preferredVoice;
      const rate = request.rate || userSettings.speechRate;

      // Validate language support
      if (!this.supportedLanguages.has(language)) {
        throw new UnsupportedLanguageError('Unsupported language', { language });
      }

      // Generate cache key
      const cacheKey = `${request.textKey}_${language}_${voice}_${rate}`;
      
      // Check cache first
      let audioPrompt = this.audioPromptsCache.get(cacheKey);
      
      if (!audioPrompt) {
        // Generate new audio prompt
        audioPrompt = await this.generateAudioPrompt(request.textKey, language, voice, rate);
        this.audioPromptsCache.set(cacheKey, audioPrompt);
      }

      // Log voice event
      await this.logVoiceEvent({
        eventID: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userID,
        promptID: audioPrompt.promptID,
        textKey: request.textKey,
        language,
        voice,
        rate,
        timestamp: new Date()
      });

      const promptTime = Date.now() - startTime;
      await this.performanceMonitor.recordMetric('voice_prompt_generation_time', promptTime);

      this.logger.info('Voice prompt generated successfully', {
        promptID: audioPrompt.promptID,
        textKey: request.textKey,
        language,
        durationMs: audioPrompt.durationMs,
        promptTime
      });

      return {
        promptID: audioPrompt.promptID,
        audioURL: audioPrompt.audioURL,
        checksum: audioPrompt.checksum,
        durationMs: audioPrompt.durationMs
      };

    } catch (error) {
      this.logger.error('Failed to get voice prompt', {
        textKey: request.textKey,
        userID,
        error: error.message
      });

      if (error instanceof UnsupportedLanguageError) {
        throw error;
      }

      throw new VoiceServiceError('Voice prompt generation failed', {
        textKey: request.textKey,
        originalError: error.message
      });
    }
  }

  /**
   * Process voice command
   */
  async processVoiceCommand(request: VoiceCommandRequest): Promise<VoiceCommandResponse> {
    const startTime = Date.now();

    try {
      this.logger.debug('Processing voice command', {
        userID: request.userID,
        language: request.language,
        context: request.context
      });

      // Decode audio data
      const audioData = this.decodeBase64Audio(request.audioBase64);

      // Perform speech-to-text
      const sttResponse = await this.performSTT(audioData, request.language);

      // Check confidence threshold
      if (sttResponse.confidence < 0.85) {
        if (sttResponse.confidence < 0.6) {
          return {
            action: 'recognition_failed',
            message: 'Sorry, I didn\'t catch that. Please repeat.'
          };
        }
        // Try offline STT if available
        const offlineSTT = await this.performOfflineSTT(audioData, request.language);
        if (offlineSTT.confidence < 0.7) {
          return {
            action: 'recognition_failed',
            message: 'Sorry, I didn\'t catch that. Please repeat.'
          };
        }
        sttResponse.transcript = offlineSTT.transcript;
        sttResponse.confidence = offlineSTT.confidence;
      }

      // Process command based on context
      let response: VoiceCommandResponse;
      
      switch (request.context) {
        case 'search':
          response = await this.processSearchCommand(sttResponse.transcript);
          break;
        case 'navigation':
          response = await this.processNavigationCommand(sttResponse.transcript);
          break;
        case 'shopping':
          response = await this.processShoppingCommand(sttResponse.transcript);
          break;
        default:
          throw new VoiceServiceError('Invalid command context', { context: request.context });
      }

      // Log voice event
      await this.logVoiceEvent({
        eventID: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userID: request.userID,
        transcript: sttResponse.transcript,
        confidence: sttResponse.confidence,
        action: response.action,
        context: request.context,
        language: request.language,
        voice: '',
        rate: 1.0,
        timestamp: new Date()
      });

      const commandTime = Date.now() - startTime;
      await this.performanceMonitor.recordMetric('voice_command_processing_time', commandTime);

      this.logger.info('Voice command processed successfully', {
        userID: request.userID,
        transcript: sttResponse.transcript,
        confidence: sttResponse.confidence,
        action: response.action,
        commandTime
      });

      return response;

    } catch (error) {
      this.logger.error('Failed to process voice command', {
        userID: request.userID,
        context: request.context,
        error: error.message
      });

      if (error instanceof VoiceRecognitionError) {
        throw error;
      }

      throw new VoiceServiceError('Voice command processing failed', {
        userID: request.userID,
        originalError: error.message
      });
    }
  }

  /**
   * Get user voice settings
   */
  async getUserSettings(userID: string): Promise<UserVoiceSettings> {
    try {
      let settings = this.userSettingsCache.get(userID);
      
      if (!settings) {
        // Create default settings
        settings = {
          userID,
          preferredLanguage: 'en-US',
          preferredVoice: 'Joanna',
          speechRate: 1.0,
          enableContinuousNarration: false,
          lastUpdated: new Date()
        };
        
        this.userSettingsCache.set(userID, settings);
      }

      return { ...settings }; // Return copy to prevent mutation

    } catch (error) {
      this.logger.error('Failed to get user voice settings', {
        userID,
        error: error.message
      });

      throw new VoiceServiceError('Failed to get voice settings', {
        userID,
        originalError: error.message
      });
    }
  }

  /**
   * Update user voice settings
   */
  async updateUserSettings(userID: string, request: VoiceSettingsRequest): Promise<UserVoiceSettings> {
    try {
      this.logger.debug('Updating user voice settings', {
        userID,
        settings: request
      });

      const currentSettings = await this.getUserSettings(userID);

      // Validate new settings
      if (request.preferredLanguage && !this.supportedLanguages.has(request.preferredLanguage)) {
        throw new UnsupportedLanguageError('Unsupported language', { language: request.preferredLanguage });
      }

      if (request.preferredVoice && request.preferredLanguage) {
        const languageVoices = this.supportedVoices.get(request.preferredLanguage);
        if (!languageVoices || !languageVoices.includes(request.preferredVoice)) {
          throw new VoiceServiceError('Voice not supported for language', {
            voice: request.preferredVoice,
            language: request.preferredLanguage
          });
        }
      }

      if (request.speechRate && (request.speechRate < 0.8 || request.speechRate > 1.5)) {
        throw new VoiceServiceError('Speech rate out of range', { speechRate: request.speechRate });
      }

      // Update settings
      const updatedSettings: UserVoiceSettings = {
        ...currentSettings,
        preferredLanguage: request.preferredLanguage || currentSettings.preferredLanguage,
        preferredVoice: request.preferredVoice || currentSettings.preferredVoice,
        speechRate: request.speechRate !== undefined ? request.speechRate : currentSettings.speechRate,
        enableContinuousNarration: request.enableContinuousNarration !== undefined 
          ? request.enableContinuousNarration 
          : currentSettings.enableContinuousNarration,
        lastUpdated: new Date()
      };

      this.userSettingsCache.set(userID, updatedSettings);

      this.logger.info('User voice settings updated successfully', {
        userID,
        updatedSettings
      });

      return { ...updatedSettings };

    } catch (error) {
      this.logger.error('Failed to update user voice settings', {
        userID,
        error: error.message
      });

      if (error instanceof UnsupportedLanguageError || error instanceof VoiceServiceError) {
        throw error;
      }

      throw new VoiceServiceError('Failed to update voice settings', {
        userID,
        originalError: error.message
      });
    }
  }

  /**
   * Queue offline voice command
   */
  async queueOfflineCommand(userID: string, transcript: string, context: string): Promise<void> {
    try {
      const commandID = `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const command: OfflineVoiceCommand = {
        commandID,
        userID,
        transcript,
        context,
        timestampQueued: new Date(),
        status: 'pending'
      };

      if (!this.offlineCommandsQueue.has(userID)) {
        this.offlineCommandsQueue.set(userID, []);
      }

      const userQueue = this.offlineCommandsQueue.get(userID)!;
      
      // Limit queue size to 100 commands per user
      if (userQueue.length >= 100) {
        userQueue.shift(); // Remove oldest command
        this.logger.warn('Offline voice command queue maxed out', { userID });
      }

      userQueue.push(command);

      this.logger.debug('Offline voice command queued', {
        userID,
        commandID,
        transcript,
        queueSize: userQueue.length
      });

    } catch (error) {
      this.logger.error('Failed to queue offline voice command', {
        userID,
        transcript,
        error: error.message
      });
    }
  }

  /**
   * Process offline voice commands when network returns
   */
  async processOfflineCommands(userID: string): Promise<void> {
    try {
      const userQueue = this.offlineCommandsQueue.get(userID);
      if (!userQueue || userQueue.length === 0) {
        return;
      }

      this.logger.info('Processing offline voice commands', {
        userID,
        commandCount: userQueue.length
      });

      for (const command of userQueue) {
        try {
          // Process the command based on its context
          let response: VoiceCommandResponse;
          
          switch (command.context) {
            case 'search':
              response = await this.processSearchCommand(command.transcript);
              break;
            case 'navigation':
              response = await this.processNavigationCommand(command.transcript);
              break;
            case 'shopping':
              response = await this.processShoppingCommand(command.transcript);
              break;
            default:
              throw new VoiceServiceError('Invalid command context', { context: command.context });
          }

          command.status = 'completed';
          
          // Notify user of completion if needed
          if (response.action !== 'recognition_failed') {
            await this.bridgeService.sendNotification({
              userId: userID,
              type: 'info',
              title: 'Voice Command Processed',
              message: `Your offline voice command "${command.transcript}" has been processed.`,
              actionUrl: `voice://command/${command.commandID}`
            });
          }

        } catch (error) {
          command.status = 'failed';
          this.logger.warn('Failed to process offline voice command', {
            commandID: command.commandID,
            transcript: command.transcript,
            error: error.message
          });
        }
      }

      // Clear completed/failed commands
      this.offlineCommandsQueue.set(userID, userQueue.filter(cmd => cmd.status === 'pending'));

    } catch (error) {
      this.logger.error('Failed to process offline voice commands', {
        userID,
        error: error.message
      });
    }
  }

  // Private helper methods
  private async generateAudioPrompt(textKey: string, language: string, voice: string, rate: number): Promise<AudioPrompt> {
    try {
      // Get localized text for the textKey
      const localizedText = await this.getLocalizedText(textKey, language);
      
      // Call TTS service
      const ttsResponse = await this.performTTS({
        text: localizedText,
        voice,
        languageCode: language,
        speed: rate
      });

      // Generate audio URL (mock S3 URL)
      const audioURL = `https://cdn.example.com/audio/${language}/${voice}/${textKey}_${rate}.mp3`;
      
      const promptID = `prompt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      return {
        promptID,
        textKey,
        language,
        voice,
        rate,
        audioURL,
        checksum: ttsResponse.checksum,
        durationMs: ttsResponse.duration,
        createdAt: new Date()
      };

    } catch (error) {
      throw new TTSServiceError('Failed to generate audio prompt', {
        textKey,
        language,
        voice,
        originalError: error.message
      });
    }
  }

  private async performTTS(request: TTSRequest): Promise<TTSResponse> {
    // Mock TTS service call
    const audioData = new ArrayBuffer(1024); // Mock audio data
    const checksum = `sha256_${Date.now()}`;
    const duration = Math.floor(request.text.length * 100); // Mock duration calculation

    // Simulate network latency
    await new Promise(resolve => setTimeout(resolve, 300));

    return {
      audioData,
      checksum,
      duration
    };
  }

  private async performSTT(audioData: ArrayBuffer, language: string): Promise<STTResponse> {
    // Mock STT service call
    const mockTranscripts = [
      'Show me the nearest restroom',
      'Find electronics stores',
      'Navigate to gate A12',
      'I want to buy a watch',
      'Where is the duty free shop'
    ];

    const transcript = mockTranscripts[Math.floor(Math.random() * mockTranscripts.length)];
    const confidence = 0.85 + Math.random() * 0.14; // 0.85-0.99

    // Simulate network latency
    await new Promise(resolve => setTimeout(resolve, 500));

    return {
      transcript,
      confidence
    };
  }

  private async performOfflineSTT(audioData: ArrayBuffer, language: string): Promise<STTResponse> {
    // Mock offline STT (CMUSphinx) - lower accuracy
    if (language !== 'en-US') {
      throw new STTServiceError('Offline STT only supports English', { language });
    }

    const mockTranscripts = [
      'Show me restroom',
      'Find electronics',
      'Navigate gate A12',
      'Buy watch',
      'Where duty free'
    ];

    const transcript = mockTranscripts[Math.floor(Math.random() * mockTranscripts.length)];
    const confidence = 0.65 + Math.random() * 0.2; // 0.65-0.85 (lower than online)

    return {
      transcript,
      confidence
    };
  }

  private decodeBase64Audio(audioBase64: string): ArrayBuffer {
    // In real implementation, would decode base64 to ArrayBuffer
    const mockData = new ArrayBuffer(1024);
    return mockData;
  }

  private async getLocalizedText(textKey: string, language: string): Promise<string> {
    // Mock localization service
    const translations: Record<string, Record<string, string>> = {
      'NAV_GO_STRAIGHT_15M': {
        'en-US': 'Proceed straight 15 meters',
        'fr-FR': 'Avancez de 15 mètres',
        'ar-AE': 'تقدم 15 متر للأمام',
        'zh-CN': '直行15米'
      },
      'NAV_TURN_LEFT_AT_CAFE': {
        'en-US': 'Turn left at the café',
        'fr-FR': 'Tournez à gauche au café',
        'ar-AE': 'انعطف يساراً عند المقهى',
        'zh-CN': '在咖啡厅左转'
      },
      'POI_DESC_RESTROOM': {
        'en-US': 'Restroom ahead on your right',
        'fr-FR': 'Toilettes à droite',
        'ar-AE': 'دورة المياه على يمينك',
        'zh-CN': '洗手间在右侧'
      }
    };

    return translations[textKey]?.[language] || translations[textKey]?.['en-US'] || textKey;
  }

  private async processSearchCommand(transcript: string): Promise<VoiceCommandResponse> {
    // Extract search intent from transcript
    const searchTerms = this.extractSearchTerms(transcript);
    
    // Mock POI search results
    const mockResults: POISearchResult[] = [
      { poiID: 'poi_restroom_001', name: 'Family Restroom', distance: 25, floor: 1 },
      { poiID: 'poi_cafe_001', name: 'Starbucks Coffee', distance: 40, floor: 1 },
      { poiID: 'poi_shop_001', name: 'Electronics Store', distance: 60, floor: 2 }
    ];

    return {
      action: 'searchResults',
      results: mockResults.slice(0, 3)
    };
  }

  private async processNavigationCommand(transcript: string): Promise<VoiceCommandResponse> {
    // Extract destination from transcript
    const destination = this.extractDestination(transcript);
    
    // Mock route steps
    const mockRouteSteps: RouteStep[] = [
      {
        textKey: 'NAV_GO_STRAIGHT_15M',
        distance: 15,
        direction: 'forward',
        location: { x: 10, y: 5, z: 0 }
      },
      {
        textKey: 'NAV_TURN_LEFT_AT_CAFE',
        distance: 3,
        direction: 'left',
        location: { x: 13, y: 5, z: 0 }
      }
    ];

    return {
      action: 'navigationRoute',
      routeSteps: mockRouteSteps
    };
  }

  private async processShoppingCommand(transcript: string): Promise<VoiceCommandResponse> {
    // Extract product/brand from transcript
    const productInfo = this.extractProductInfo(transcript);
    
    // Mock shopping results
    const mockResults: POISearchResult[] = [
      { poiID: 'shop_luxury_001', name: 'Luxury Boutique', distance: 30, floor: 2 },
      { poiID: 'shop_duty_free_001', name: 'Duty Free Shop', distance: 45, floor: 1 }
    ];

    return {
      action: 'searchResults',
      results: mockResults
    };
  }

  private extractSearchTerms(transcript: string): string[] {
    // Simple keyword extraction
    const keywords = ['restroom', 'bathroom', 'toilet', 'cafe', 'coffee', 'shop', 'store', 'electronics'];
    return keywords.filter(keyword => transcript.toLowerCase().includes(keyword));
  }

  private extractDestination(transcript: string): string {
    // Extract destination patterns like "gate A12", "terminal 2", etc.
    const gateMatch = transcript.match(/gate\s+([A-Z]\d+)/i);
    if (gateMatch) return gateMatch[1];
    
    const terminalMatch = transcript.match(/terminal\s+(\d+)/i);
    if (terminalMatch) return `terminal_${terminalMatch[1]}`;
    
    return 'unknown';
  }

  private extractProductInfo(transcript: string): { brand?: string; category?: string } {
    const brands = ['gucci', 'prada', 'apple', 'samsung'];
    const categories = ['watch', 'bag', 'phone', 'perfume', 'chocolate'];
    
    const brand = brands.find(b => transcript.toLowerCase().includes(b));
    const category = categories.find(c => transcript.toLowerCase().includes(c));
    
    return { brand, category };
  }

  private async logVoiceEvent(event: VoiceEvent): Promise<void> {
    // In real implementation, would publish to Kafka
    this.logger.debug('Voice event logged', {
      eventID: event.eventID,
      userID: event.userID,
      action: event.action,
      textKey: event.textKey,
      transcript: event.transcript
    });
  }

  private initializeMockData(): void {
    // Pre-cache common prompts
    const commonPrompts = [
      'NAV_GO_STRAIGHT_15M',
      'NAV_TURN_LEFT_AT_CAFE',
      'POI_DESC_RESTROOM',
      'NAV_ARRIVED_DESTINATION'
    ];

    for (const textKey of commonPrompts) {
      for (const language of this.supportedLanguages) {
        for (const voice of this.supportedVoices.get(language) || []) {
          const cacheKey = `${textKey}_${language}_${voice}_1.0`;
          const mockPrompt: AudioPrompt = {
            promptID: `prompt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            textKey,
            language,
            voice,
            rate: 1.0,
            audioURL: `https://cdn.example.com/audio/${language}/${voice}/${textKey}_1.0.mp3`,
            checksum: `sha256_mock_${textKey}`,
            durationMs: 2000,
            createdAt: new Date()
          };
          this.audioPromptsCache.set(cacheKey, mockPrompt);
        }
      }
    }

    this.logger.info('Mock voice data initialized', {
      supportedLanguages: Array.from(this.supportedLanguages),
      cachedPrompts: this.audioPromptsCache.size
    });
  }
} 
