export interface SOPSecurityContext {
  userID: string;
  requestIP: string;
  userAgent: string;
  operation: string;
  timestamp: Date;
}

export interface MediaIntegrityData {
  assetId: string;
  checksum: string;
  url: string;
  fileSize: number;
}

export class SecurityService {
  async authenticateSOPRequest(userID: string, oauthToken: string, scope: string): Promise<boolean> {
    // In a real implementation, this would validate OAuth2 tokens and scopes
    console.debug(`[SECURITY] Authenticating SOP request for user: ${userID}, scope: ${scope}`);
    
    if (!userID || !oauthToken) {
      throw new Error('Invalid authentication credentials');
    }
    
    // Validate scope permissions
    const validScopes = ['sop.read', 'sop.write', 'sop.admin', 'tasks.read', 'tasks.write'];
    if (!validScopes.includes(scope)) {
      throw new Error('Invalid scope for SOP operation');
    }
    
    return true;
  }

  async validateSOPUpload(userID: string, sopSize: number, context: SOPSecurityContext): Promise<boolean> {
    // In a real implementation, this would check for SOP upload permissions
    console.debug(`[SECURITY] Validating SOP upload: ${sopSize} bytes for user ${userID}`);
    
    // Check for reasonable SOP sizes (basic validation)
    if (sopSize > 50 * 1024 * 1024) { // 50MB limit
      throw new Error('SOP size exceeds maximum allowed limit');
    }
    
    // Check rate limiting for SOP uploads
    if (await this.checkRateLimit(userID, 'sop_upload')) {
      throw new Error('Rate limit exceeded for SOP uploads');
    }
    
    return true;
  }

  async validateTaskAssignment(userID: string, taskCount: number, context: SOPSecurityContext): Promise<boolean> {
    // In a real implementation, this would check for task assignment permissions
    console.debug(`[SECURITY] Validating task assignment: ${taskCount} tasks for user ${userID}`);
    
    // Check for reasonable task assignment counts
    if (taskCount > 100) {
      throw new Error('Task assignment count exceeds daily limit');
    }
    
    // Check rate limiting for task operations
    if (await this.checkRateLimit(userID, 'task_assignment')) {
      throw new Error('Rate limit exceeded for task assignments');
    }
    
    return true;
  }

  async verifyMediaIntegrity(mediaData: MediaIntegrityData): Promise<boolean> {
    // In a real implementation, this would verify SHA-256 checksums
    console.debug(`[SECURITY] Verifying media integrity for: ${mediaData.assetId}`);
    
    if (!mediaData.checksum) {
      throw new Error('Media integrity verification failed: missing checksum');
    }
    
    // Validate file size matches expected
    if (mediaData.fileSize <= 0) {
      throw new Error('Invalid media file size');
    }
    
    return true;
  }

  async checkRateLimit(userID: string, operation: string): Promise<boolean> {
    // In a real implementation, this would check Redis for rate limits
    // For now, return false (no rate limit exceeded)
    return false;
  }

  async auditSOPAction(userID: string, action: string, details: any): Promise<void> {
    // In a real implementation, this would log to audit trail
    console.debug(`[AUDIT] User ${userID} performed ${action}`, details);
  }

  async encryptSOPData(data: any): Promise<string> {
    // In a real implementation, this would use AES-256-GCM encryption
    return btoa(JSON.stringify(data));
  }

  async decryptSOPData(encryptedData: string): Promise<any> {
    // In a real implementation, this would decrypt the data
    return JSON.parse(atob(encryptedData));
  }

  async generatePresignedURL(mediaURL: string, expirationMinutes: number = 15): Promise<string> {
    // In a real implementation, this would generate signed URLs with TTL
    const expiry = Date.now() + (expirationMinutes * 60 * 1000);
    return `${mediaURL}?expires=${expiry}&signature=placeholder`;
  }

  pseudonymizeUserID(userID: string): string {
    // Simple hash for cross-platform compatibility
    let hash = 0;
    for (let i = 0; i < userID.length; i++) {
      const char = userID.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `sop_${Math.abs(hash).toString(16).substring(0, 8)}`;
  }

  sanitizeSOPData(sopData: any): any {
    // Remove PII from SOP data
    const sanitized = { ...sopData };
    delete sanitized.personalInfo;
    delete sanitized.authorEmail;
    delete sanitized.internalNotes;
    return sanitized;
  }

  validateInstructionContent(instructionText: string): boolean {
    // Basic validation for SOP instruction content
    if (!instructionText || instructionText.trim().length === 0) {
      throw new Error('Instruction text cannot be empty');
    }
    
    // Check for potentially dangerous content
    const dangerousPatterns = ['<script', 'javascript:', 'data:text/html'];
    const lowerText = instructionText.toLowerCase();
    
    for (const pattern of dangerousPatterns) {
      if (lowerText.includes(pattern)) {
        throw new Error('Instruction content contains potentially dangerous elements');
      }
    }
    
    return true;
  }

  validateAnchorCoordinates(coordinates: { x: number; y: number; z: number }): boolean {
    // Validate anchor coordinates are within reasonable bounds
    const maxCoordinate = 1000; // meters
    const minCoordinate = -1000;
    
    if (coordinates.x < minCoordinate || coordinates.x > maxCoordinate ||
        coordinates.y < minCoordinate || coordinates.y > maxCoordinate ||
        coordinates.z < minCoordinate || coordinates.z > maxCoordinate) {
      throw new Error('Anchor coordinates are outside valid range');
    }
    
    return true;
  }
} 