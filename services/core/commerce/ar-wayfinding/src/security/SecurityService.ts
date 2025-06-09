export interface WayfindingSecurityContext {
  userID: string;
  requestIP: string;
  userAgent: string;
  operation: string;
  timestamp: Date;
}

export interface WayfindingAuditEvent {
  userID: string;
  action: string;
  sessionID?: string;
  startNode?: string;
  endNode?: string;
  terminal?: string;
  waypointIndex?: number;
  reason?: string;
  duration?: number;
  timestamp: Date;
  success: boolean;
  errorDetails?: string;
}

export class SecurityService {
  async validateWayfindingRequest(userID: string, operation: string, context: WayfindingSecurityContext): Promise<boolean> {
    console.debug(`[SECURITY] Validating wayfinding request for user: ${userID}, operation: ${operation}`);
    
    if (!userID || !operation) {
      throw new Error('Invalid security context for wayfinding request');
    }
    
    // Validate operation permissions
    const validOperations = ['navigation.start', 'navigation.update', 'navigation.stop'];
    if (!validOperations.includes(operation)) {
      throw new Error('Invalid operation for wayfinding request');
    }
    
    // Check rate limiting for navigation operations
    if (await this.checkRateLimit(userID, operation)) {
      throw new Error('Rate limit exceeded for wayfinding operations');
    }
    
    return true;
  }

  async auditWayfindingAction(event: WayfindingAuditEvent): Promise<void> {
    console.debug(`[AUDIT] User ${event.userID} performed ${event.action}`, {
      sessionID: event.sessionID,
      terminal: event.terminal,
      success: event.success,
      timestamp: event.timestamp,
      errorDetails: event.errorDetails
    });
  }

  async checkRateLimit(userID: string, operation: string): Promise<boolean> {
    // In a real implementation, this would check Redis for rate limits
    // For now, return false (no rate limit exceeded)
    return false;
  }

  validateNodeID(nodeID: string): boolean {
    if (!nodeID || nodeID.trim().length === 0) {
      return false;
    }
    
    // Validate node ID format
    const nodeIDRegex = /^node_[a-zA-Z0-9_-]+$/;
    return nodeIDRegex.test(nodeID);
  }

  validateTerminalID(terminalID: string): boolean {
    const terminalRegex = /^[A-Z0-9]{1,4}$/;
    return terminalRegex.test(terminalID);
  }

  validateSessionID(sessionID: string): boolean {
    const sessionIDRegex = /^sess_[a-zA-Z0-9_-]{1,36}$/;
    return sessionIDRegex.test(sessionID);
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

  async detectNavigationAbuse(userID: string, operation: string, frequency: number): Promise<number> {
    // Mock navigation abuse detection - returns risk score 0-1
    let riskScore = 0;
    
    // High frequency operations might indicate abuse
    if (frequency > 20) riskScore += 0.2;
    if (frequency > 50) riskScore += 0.3;
    if (frequency > 100) riskScore += 0.5;
    
    // Certain operations are more sensitive
    if (operation === 'navigation.start' && frequency > 10) riskScore += 0.3;
    if (operation === 'navigation.update' && frequency > 100) riskScore += 0.2;
    
    return Math.min(riskScore, 1.0);
  }

  async anonymizeNavigationData(navigationData: any): Promise<any> {
    // Anonymize navigation data for analytics
    const anonymized = { ...navigationData };
    
    // Replace sensitive information with anonymized versions
    if (anonymized.userID) {
      anonymized.userID = this.pseudonymizeUserID(navigationData.userID);
    }
    
    if (anonymized.sessionID) {
      anonymized.sessionID = '[REDACTED]';
    }
    
    // Keep non-sensitive navigation metrics for analytics
    return anonymized;
  }
} 