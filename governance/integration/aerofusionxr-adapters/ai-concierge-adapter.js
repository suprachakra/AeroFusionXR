/**
 * AI Concierge Governance Adapter
 * Integrates governance hooks into the existing AI Concierge service
 */

const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

class AIConciergeGovernanceAdapter {
  constructor(config = {}) {
    this.governanceApiUrl = config.governanceApiUrl || 'http://governance-orchestrator:8000';
    this.enableBiasDetection = config.enableBiasDetection !== false;
    this.enableExplainability = config.enableExplainability !== false;
    this.enableAuditLogging = config.enableAuditLogging !== false;
    this.enablePerformanceMonitoring = config.enablePerformanceMonitoring !== false;
    
    // Initialize governance client
    this.governanceClient = axios.create({
      baseURL: this.governanceApiUrl,
      timeout: 5000,
      headers: {
        'X-Governance-Source': 'ai-concierge-adapter'
      }
    });
  }

  /**
   * Middleware to inject governance hooks into AI Concierge requests
   */
  governanceMiddleware() {
    return async (req, res, next) => {
      // Generate governance tracking ID
      req.governanceId = uuidv4();
      req.governanceStartTime = Date.now();
      
      // Log request for audit trail
      if (this.enableAuditLogging) {
        await this.logGovernanceEvent('ai_request_received', {
          requestId: req.governanceId,
          endpoint: req.path,
          method: req.method,
          userAgent: req.get('User-Agent'),
          clientIp: req.ip,
          timestamp: new Date().toISOString()
        });
      }
      
      // Add governance headers
      req.headers['x-governance-request-id'] = req.governanceId;
      req.headers['x-governance-timestamp'] = req.governanceStartTime;
      
      next();
    };
  }

  /**
   * Post-processing middleware for AI responses
   */
  responseGovernanceMiddleware() {
    return async (req, res, next) => {
      // Capture original response methods
      const originalSend = res.send;
      const originalJson = res.json;
      
      // Override response methods to inject governance checks
      res.send = async (body) => {
        const processedBody = await this.processAIResponse(req, body);
        return originalSend.call(res, processedBody);
      };
      
      res.json = async (obj) => {
        const processedObj = await this.processAIResponse(req, obj);
        return originalJson.call(res, processedObj);
      };
      
      next();
    };
  }

  /**
   * Process AI response through governance checks
   */
  async processAIResponse(req, responseData) {
    const startTime = Date.now();
    let processedData = responseData;
    
    try {
      // Convert response to string for processing
      const responseText = typeof responseData === 'string' 
        ? responseData 
        : JSON.stringify(responseData);
      
      // Perform bias detection
      if (this.enableBiasDetection) {
        const biasResult = await this.detectBias(responseText, req.governanceId);
        if (biasResult.biasDetected) {
          // Add bias warning to response
          if (typeof processedData === 'object') {
            processedData._governance = {
              ...processedData._governance,
              biasWarning: true,
              biasScore: biasResult.biasScore,
              biasDetails: biasResult.details
            };
          }
          
          // Log bias detection
          await this.logGovernanceEvent('bias_detected', {
            requestId: req.governanceId,
            biasScore: biasResult.biasScore,
            biasType: biasResult.biasType,
            responseLength: responseText.length
          });
        }
      }
      
      // Generate explainability information
      if (this.enableExplainability) {
        const explanation = await this.generateExplanation(responseText, req);
        if (explanation) {
          if (typeof processedData === 'object') {
            processedData._governance = {
              ...processedData._governance,
              explanation: explanation
            };
          }
        }
      }
      
      // Log performance metrics
      if (this.enablePerformanceMonitoring) {
        const totalLatency = Date.now() - req.governanceStartTime;
        const governanceLatency = Date.now() - startTime;
        
        await this.logGovernanceEvent('ai_response_processed', {
          requestId: req.governanceId,
          totalLatency,
          governanceLatency,
          responseSize: responseText.length,
          biasCheckPerformed: this.enableBiasDetection,
          explainabilityGenerated: this.enableExplainability
        });
      }
      
    } catch (error) {
      console.error('Governance processing error:', error);
      
      // Log governance error
      await this.logGovernanceEvent('governance_error', {
        requestId: req.governanceId,
        error: error.message,
        stack: error.stack
      });
    }
    
    return processedData;
  }

  /**
   * Detect bias in AI response
   */
  async detectBias(responseText, requestId) {
    try {
      const response = await this.governanceClient.post('/bias/detect', {
        text: responseText,
        requestId: requestId,
        service: 'ai-concierge',
        timestamp: new Date().toISOString()
      });
      
      return response.data;
    } catch (error) {
      console.error('Bias detection failed:', error);
      return { biasDetected: false, error: error.message };
    }
  }

  /**
   * Generate explainability information for AI response
   */
  async generateExplanation(responseText, req) {
    try {
      const response = await this.governanceClient.post('/explainability/generate', {
        text: responseText,
        requestId: req.governanceId,
        context: {
          endpoint: req.path,
          method: req.method,
          userQuery: req.body?.query || req.query?.q,
          timestamp: new Date().toISOString()
        }
      });
      
      return response.data.explanation;
    } catch (error) {
      console.error('Explainability generation failed:', error);
      return null;
    }
  }

  /**
   * Log governance event to audit trail
   */
  async logGovernanceEvent(eventType, eventData) {
    try {
      await this.governanceClient.post('/audit/log', {
        eventType,
        service: 'ai-concierge',
        timestamp: new Date().toISOString(),
        data: eventData
      });
    } catch (error) {
      console.error('Failed to log governance event:', error);
    }
  }

  /**
   * Validate AI model compliance before deployment
   */
  async validateModelCompliance(modelId, modelMetadata) {
    try {
      const response = await this.governanceClient.post('/compliance/validate-model', {
        modelId,
        metadata: modelMetadata,
        service: 'ai-concierge',
        timestamp: new Date().toISOString()
      });
      
      return response.data;
    } catch (error) {
      console.error('Model compliance validation failed:', error);
      return { compliant: false, error: error.message };
    }
  }

  /**
   * Report model performance metrics
   */
  async reportModelMetrics(modelId, metrics) {
    try {
      await this.governanceClient.post('/metrics/model-performance', {
        modelId,
        service: 'ai-concierge',
        metrics: {
          ...metrics,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Failed to report model metrics:', error);
    }
  }

  /**
   * Check if model deployment is allowed
   */
  async checkDeploymentApproval(modelId, environment) {
    try {
      const response = await this.governanceClient.get(`/deployment/approval/${modelId}`, {
        params: {
          environment,
          service: 'ai-concierge'
        }
      });
      
      return response.data.approved;
    } catch (error) {
      console.error('Deployment approval check failed:', error);
      return false;
    }
  }

  /**
   * Initialize governance hooks for existing AI Concierge service
   */
  initializeGovernanceHooks(app) {
    // Add governance middleware to all AI endpoints
    app.use('/api/ai/*', this.governanceMiddleware());
    app.use('/api/ai/*', this.responseGovernanceMiddleware());
    
    // Add governance endpoints
    app.get('/governance/health', (req, res) => {
      res.json({
        status: 'healthy',
        adapter: 'ai-concierge-governance-adapter',
        version: '1.0.0',
        features: {
          biasDetection: this.enableBiasDetection,
          explainability: this.enableExplainability,
          auditLogging: this.enableAuditLogging,
          performanceMonitoring: this.enablePerformanceMonitoring
        }
      });
    });
    
    app.get('/governance/metrics', async (req, res) => {
      try {
        const response = await this.governanceClient.get('/metrics/service/ai-concierge');
        res.json(response.data);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch governance metrics' });
      }
    });
    
    console.log('AI Concierge Governance Adapter initialized successfully');
  }
}

module.exports = AIConciergeGovernanceAdapter; 