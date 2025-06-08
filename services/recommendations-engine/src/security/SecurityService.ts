export interface RecommendationSecurityContext {
  userID: string;
  requestIP: string;
  userAgent: string;
  operation: string;
  timestamp: Date;
}

export interface RecommendationAuditEvent {
  userID: string;
  action: string;
  context: string;
  resultCount?: number;
  cacheHit?: boolean;
  timestamp: Date;
  success: boolean;
  errorDetails?: string;
  duration?: number;
}

export class SecurityService {
  async validateRecommendationRequest(
    userID: string, 
    operation: string, 
    context: RecommendationSecurityContext
  ): Promise<boolean> {
    console.debug(`[SECURITY] Validating recommendation request for user: ${userID}, operation: ${operation}`);
    
    if (!userID || !operation) {
      throw new Error('Invalid security context for recommendation request');
    }
    
    // Validate operation permissions
    const validOperations = ['recommendations.read', 'recommendations.write', 'offers.read'];
    if (!validOperations.includes(operation)) {
      throw new Error('Invalid operation for recommendation request');
    }
    
    // Check rate limiting
    if (await this.checkRateLimit(userID, operation)) {
      throw new Error('Rate limit exceeded for recommendation operations');
    }
    
    return true;
  }

  async auditRecommendationAction(event: RecommendationAuditEvent): Promise<void> {
    console.debug(`[AUDIT] User ${event.userID} performed ${event.action}`, {
      context: event.context,
      resultCount: event.resultCount,
      cacheHit: event.cacheHit,
      success: event.success,
      timestamp: event.timestamp,
      duration: event.duration,
      errorDetails: event.errorDetails
    });
  }

  async checkRateLimit(userID: string, operation: string): Promise<boolean> {
    // In a real implementation, this would check Redis for rate limits
    // For now, return false (no rate limit exceeded)
    return false;
  }

  validateUserID(userID: string): boolean {
    if (!userID || userID.trim().length === 0) {
      return false;
    }
    
    // Validate user ID format
    const userIDRegex = /^user_[a-zA-Z0-9_-]{1,32}$/;
    return userIDRegex.test(userID);
  }

  validateContext(context: string): boolean {
    const validContexts = ['HOMEPAGE', 'POI', 'ROUTE', 'CATEGORY', 'SEARCH'];
    return validContexts.includes(context);
  }

  pseudonymizeUserID(userID: string): string {
    // Simple hash for cross-platform compatibility
    let hash = 0;
    for (let i = 0; i < userID.length; i++) {
      const char = userID.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `user_${Math.abs(hash).toString(16).substring(0, 8)}`;
  }

  async detectRecommendationAbuse(userID: string, operation: string, frequency: number): Promise<number> {
    // Mock recommendation abuse detection - returns risk score 0-1
    let riskScore = 0;
    
    // High frequency operations might indicate abuse
    if (frequency > 50) riskScore += 0.2;
    if (frequency > 100) riskScore += 0.3;
    if (frequency > 200) riskScore += 0.5;
    
    // Certain operations are more sensitive
    if (operation === 'recommendations.read' && frequency > 20) riskScore += 0.3;
    if (operation === 'offers.read' && frequency > 10) riskScore += 0.4;
    
    return Math.min(riskScore, 1.0);
  }

  async anonymizeRecommendationData(recommendationData: any): Promise<any> {
    // Anonymize recommendation data for analytics
    const anonymized = { ...recommendationData };
    
    // Replace sensitive information with anonymized versions
    if (anonymized.userID) {
      anonymized.userID = this.pseudonymizeUserID(recommendationData.userID);
    }
    
    // Keep non-sensitive recommendation metrics for analytics
    return anonymized;
  }

  async encryptSensitiveData(data: any): Promise<string> {
    // In production, this would use proper encryption
    // For now, return base64 encoded data
    return Buffer.from(JSON.stringify(data)).toString('base64');
  }

  async decryptSensitiveData(encryptedData: string): Promise<any> {
    // In production, this would use proper decryption
    // For now, decode base64
    try {
      const decoded = Buffer.from(encryptedData, 'base64').toString();
      return JSON.parse(decoded);
    } catch (error) {
      throw new Error('Failed to decrypt sensitive data');
    }
  }
} 