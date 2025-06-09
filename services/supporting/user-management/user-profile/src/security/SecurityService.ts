export interface ProfileSecurityContext {
  userID: string;
  requestIP: string;
  userAgent: string;
  operation: string;
  timestamp: Date;
}

export interface ProfileIntegrityData {
  userID: string;
  email: string;
  checksum: string;
}

export class SecurityService {
  async authenticateProfileRequest(userID: string, oauthToken: string, scope: string): Promise<boolean> {
    // In a real implementation, this would validate OAuth2 tokens and scopes
    console.debug(`[SECURITY] Authenticating profile request for user: ${userID}, scope: ${scope}`);
    
    if (!userID || !oauthToken) {
      throw new Error('Invalid authentication credentials');
    }
    
    // Validate scope permissions
    const validScopes = ['profile.read', 'profile.write', 'profile.delete'];
    if (!validScopes.includes(scope)) {
      throw new Error('Invalid scope for profile operation');
    }
    
    return true;
  }

  async validateProfileUpdate(userID: string, updateData: any, context: ProfileSecurityContext): Promise<boolean> {
    // In a real implementation, this would check for profile update permissions
    console.debug(`[SECURITY] Validating profile update for user ${userID}`);
    
    // Check for suspicious data patterns
    if (updateData.email && !this.isValidEmail(updateData.email)) {
      throw new Error('Invalid email format in profile update');
    }
    
    // Check rate limiting for profile updates
    if (await this.checkRateLimit(userID, 'profile_update')) {
      throw new Error('Rate limit exceeded for profile updates');
    }
    
    return true;
  }

  async validateLoyaltyLink(userID: string, loyaltyCardNumber: string, context: ProfileSecurityContext): Promise<boolean> {
    // In a real implementation, this would check for loyalty linking abuse
    console.debug(`[SECURITY] Validating loyalty link: ${loyaltyCardNumber} for user ${userID}`);
    
    // Check loyalty card format
    if (!loyaltyCardNumber || loyaltyCardNumber.length < 8 || loyaltyCardNumber.length > 20) {
      throw new Error('Invalid loyalty card number format');
    }
    
    // Check rate limiting for loyalty operations
    if (await this.checkRateLimit(userID, 'loyalty_link')) {
      throw new Error('Rate limit exceeded for loyalty operations');
    }
    
    return true;
  }

  async verifyProfileIntegrity(profileData: ProfileIntegrityData): Promise<boolean> {
    // In a real implementation, this would verify profile data integrity
    console.debug(`[SECURITY] Verifying profile integrity for: ${profileData.userID}`);
    
    if (!profileData.checksum) {
      throw new Error('Profile integrity verification failed: missing checksum');
    }
    
    // Validate email format
    if (!this.isValidEmail(profileData.email)) {
      throw new Error('Invalid email in profile data');
    }
    
    return true;
  }

  async checkRateLimit(userID: string, operation: string): Promise<boolean> {
    // In a real implementation, this would check Redis for rate limits
    // For now, return false (no rate limit exceeded)
    return false;
  }

  async auditProfileAction(userID: string, action: string, details: any): Promise<void> {
    // In a real implementation, this would log to audit trail
    console.debug(`[AUDIT] User ${userID} performed ${action}`, details);
  }

  async encryptProfileData(data: any): Promise<string> {
    // In a real implementation, this would use AES-256-GCM encryption
    return btoa(JSON.stringify(data));
  }

  async decryptProfileData(encryptedData: string): Promise<any> {
    // In a real implementation, this would decrypt the data
    return JSON.parse(atob(encryptedData));
  }

  async generateProfileToken(userID: string, action: string): Promise<string> {
    // In a real implementation, this would generate secure profile action tokens
    const timestamp = Date.now();
    return `profile_${userID}_${action}_${timestamp}`;
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

  sanitizeProfileData(profileData: any): any {
    // Remove PII from profile data for logging
    const sanitized = { ...profileData };
    delete sanitized.email;
    delete sanitized.personalInfo;
    delete sanitized.savedPaymentMethods;
    return sanitized;
  }

  isValidEmail(email: string): boolean {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  validatePassword(password: string): boolean {
    // Validate password strength
    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }
    
    // Check for complexity requirements
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    
    if (!hasUpperCase || !hasLowerCase || !hasNumbers) {
      throw new Error('Password must contain uppercase, lowercase, and numeric characters');
    }
    
    return true;
  }

  validateDisplayName(displayName: string): boolean {
    // Validate display name format
    if (!displayName || displayName.trim().length === 0) {
      throw new Error('Display name cannot be empty');
    }
    
    if (displayName.length > 64) {
      throw new Error('Display name too long');
    }
    
    // Check for potentially dangerous content
    const dangerousPatterns = ['<script', 'javascript:', 'data:'];
    const lowerName = displayName.toLowerCase();
    
    for (const pattern of dangerousPatterns) {
      if (lowerName.includes(pattern)) {
        throw new Error('Display name contains potentially dangerous elements');
      }
    }
    
    return true;
  }

  validatePreferences(preferences: any): boolean {
    // Validate user preferences
    if (preferences.averageSpend && (preferences.averageSpend < 0 || preferences.averageSpend > 100000)) {
      throw new Error('Average spend outside valid range');
    }
    
    if (preferences.favoriteCategories && preferences.favoriteCategories.length > 10) {
      throw new Error('Too many favorite categories');
    }
    
    return true;
  }

  async detectProfileAbuse(userID: string, operation: string, frequency: number): Promise<number> {
    // Mock profile abuse detection - returns risk score 0-1
    let riskScore = 0;
    
    // High frequency operations might indicate abuse
    if (frequency > 10) riskScore += 0.3;
    if (frequency > 50) riskScore += 0.5;
    
    // Certain operations are more sensitive
    if (operation === 'profile_update' && frequency > 5) riskScore += 0.2;
    if (operation === 'payment_method_add' && frequency > 3) riskScore += 0.4;
    
    return Math.min(riskScore, 1.0);
  }

  async anonymizeProfileData(profileData: any): Promise<any> {
    // Anonymize profile data for analytics
    const anonymized = { ...profileData };
    
    // Replace PII with anonymized versions
    anonymized.userID = this.pseudonymizeUserID(profileData.userID);
    anonymized.email = '[REDACTED]';
    anonymized.displayName = '[REDACTED]';
    
    // Keep non-PII preferences for analytics
    return anonymized;
  }
} 