export interface TemplateRenderContext {
  [key: string]: any;
}

export interface TemplateRenderResult {
  title: string;
  body: string;
  actionURL?: string;
}

export interface NotificationTemplate {
  templateID: string;
  channel: 'push' | 'email' | 'inApp' | 'sms';
  locale: string;
  titleTemplate: string;
  bodyTemplate: string;
  actionURLTemplate?: string;
}

export class TemplateEngine {
  private logger: any;

  constructor() {
    // Mock logger for now
    this.logger = {
      debug: (msg: string, ctx?: any) => console.debug(`[TemplateEngine] ${msg}`, ctx),
      warn: (msg: string, ctx?: any) => console.warn(`[TemplateEngine] ${msg}`, ctx),
      error: (msg: string, ctx?: any) => console.error(`[TemplateEngine] ${msg}`, ctx)
    };
  }

  /**
   * Render notification template with context variables
   */
  async render(template: NotificationTemplate, context: TemplateRenderContext): Promise<TemplateRenderResult> {
    try {
      this.logger.debug('Rendering template', {
        templateID: template.templateID,
        channel: template.channel,
        locale: template.locale,
        contextKeys: Object.keys(context)
      });

      // Validate template
      this.validateTemplate(template);

      // Render each component
      const title = this.renderString(template.titleTemplate, context);
      const body = this.renderString(template.bodyTemplate, context);
      const actionURL = template.actionURLTemplate ? this.renderString(template.actionURLTemplate, context) : undefined;

      // Post-process for channel-specific formatting
      const result = this.postProcessForChannel(
        { title, body, actionURL },
        template.channel
      );

      this.logger.debug('Template rendered successfully', {
        templateID: template.templateID,
        titleLength: result.title.length,
        bodyLength: result.body.length,
        hasActionURL: !!result.actionURL
      });

      return result;

    } catch (error) {
      this.logger.error('Failed to render template', {
        templateID: template.templateID,
        error: error.message
      });
      throw new Error(`Template rendering failed: ${error.message}`);
    }
  }

  /**
   * Render string template with context variables (Handlebars-style)
   */
  private renderString(template: string, context: TemplateRenderContext): string {
    let rendered = template;

    // Replace {{variable}} placeholders
    const variableRegex = /\{\{([^}]+)\}\}/g;
    rendered = rendered.replace(variableRegex, (match, variableName) => {
      const trimmedVar = variableName.trim();
      
      if (trimmedVar in context) {
        const value = context[trimmedVar];
        
        // Handle different value types
        if (value === null || value === undefined) {
          this.logger.warn('Template variable is null/undefined', {
            variable: trimmedVar,
            template: template.substring(0, 100)
          });
          return '';
        }
        
        if (typeof value === 'object') {
          return JSON.stringify(value);
        }
        
        return String(value);
      } else {
        this.logger.warn('Template variable not found in context', {
          variable: trimmedVar,
          availableVariables: Object.keys(context)
        });
        return match; // Leave placeholder if variable not found
      }
    });

    return rendered;
  }

  /**
   * Post-process content for specific channels
   */
  private postProcessForChannel(
    content: TemplateRenderResult,
    channel: string
  ): TemplateRenderResult {
    switch (channel) {
      case 'email':
        return this.postProcessEmail(content);
      case 'push':
        return this.postProcessPush(content);
      case 'sms':
        return this.postProcessSMS(content);
      case 'inApp':
        return this.postProcessInApp(content);
      default:
        return content;
    }
  }

  /**
   * Post-process email content
   */
  private postProcessEmail(content: TemplateRenderResult): TemplateRenderResult {
    // Ensure HTML is properly formatted for email
    let body = content.body;
    
    // Add basic HTML structure if not present
    if (!body.includes('<html>') && !body.includes('<body>')) {
      body = `
        <html>
          <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
            ${body}
          </body>
        </html>
      `;
    }

    // Add action button if actionURL provided
    if (content.actionURL) {
      const buttonHtml = `
        <div style="margin: 20px 0; text-align: center;">
          <a href="${content.actionURL}" 
             style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px; font-weight: bold;">
            View Details
          </a>
        </div>
      `;
      
      // Insert button before closing body tag
      body = body.replace('</body>', `${buttonHtml}</body>`);
    }

    return {
      ...content,
      body
    };
  }

  /**
   * Post-process push notification content
   */
  private postProcessPush(content: TemplateRenderResult): TemplateRenderResult {
    // Truncate title and body for push notification limits
    let title = content.title;
    let body = content.body;

    // iOS limits: title 50 chars, body 150 chars
    // Android limits are more flexible but keep consistent
    if (title.length > 50) {
      title = title.substring(0, 47) + '...';
      this.logger.warn('Push title truncated', {
        originalLength: content.title.length,
        truncatedLength: title.length
      });
    }

    if (body.length > 150) {
      body = body.substring(0, 147) + '...';
      this.logger.warn('Push body truncated', {
        originalLength: content.body.length,
        truncatedLength: body.length
      });
    }

    return {
      ...content,
      title,
      body
    };
  }

  /**
   * Post-process SMS content
   */
  private postProcessSMS(content: TemplateRenderResult): TemplateRenderResult {
    // SMS is body-only, combine title and body
    let smsBody = content.body;
    
    // If title exists and is different from body, prepend it
    if (content.title && content.title !== content.body) {
      smsBody = `${content.title}: ${content.body}`;
    }

    // SMS limit is typically 160 characters for single message
    // For longer messages, we'll allow up to 480 chars (3 segments)
    if (smsBody.length > 480) {
      smsBody = smsBody.substring(0, 477) + '...';
      this.logger.warn('SMS body truncated', {
        originalLength: smsBody.length,
        truncatedLength: 480
      });
    }

    // Add action URL if provided and space allows
    if (content.actionURL && smsBody.length < 400) {
      smsBody += ` ${content.actionURL}`;
    }

    return {
      title: content.title,
      body: smsBody,
      actionURL: content.actionURL
    };
  }

  /**
   * Post-process in-app message content
   */
  private postProcessInApp(content: TemplateRenderResult): TemplateRenderResult {
    // In-app messages can be richer, but still need limits for UI
    let title = content.title;
    let body = content.body;

    // Keep reasonable limits for mobile UI
    if (title.length > 100) {
      title = title.substring(0, 97) + '...';
    }

    if (body.length > 300) {
      body = body.substring(0, 297) + '...';
    }

    return {
      ...content,
      title,
      body
    };
  }

  /**
   * Validate template structure
   */
  private validateTemplate(template: NotificationTemplate): void {
    if (!template.templateID || template.templateID.trim().length === 0) {
      throw new Error('Template ID is required');
    }

    if (!template.titleTemplate || template.titleTemplate.trim().length === 0) {
      throw new Error('Title template is required');
    }

    if (!template.bodyTemplate || template.bodyTemplate.trim().length === 0) {
      throw new Error('Body template is required');
    }

    if (!['push', 'email', 'inApp', 'sms'].includes(template.channel)) {
      throw new Error(`Invalid channel: ${template.channel}`);
    }

    // Check for balanced placeholders
    this.validatePlaceholders(template.titleTemplate);
    this.validatePlaceholders(template.bodyTemplate);
    if (template.actionURLTemplate) {
      this.validatePlaceholders(template.actionURLTemplate);
    }
  }

  /**
   * Validate placeholder syntax
   */
  private validatePlaceholders(template: string): void {
    const openCount = (template.match(/\{\{/g) || []).length;
    const closeCount = (template.match(/\}\}/g) || []).length;

    if (openCount !== closeCount) {
      throw new Error(`Unbalanced placeholders in template: ${template.substring(0, 100)}`);
    }

    // Check for nested placeholders (not supported)
    if (template.includes('{{{') || template.includes('}}}')) {
      throw new Error(`Nested placeholders not supported: ${template.substring(0, 100)}`);
    }
  }

  /**
   * Extract all variables from a template
   */
  extractVariables(template: string): string[] {
    const variables: string[] = [];
    const variableRegex = /\{\{([^}]+)\}\}/g;
    let match;

    while ((match = variableRegex.exec(template)) !== null) {
      const variableName = match[1].trim();
      if (!variables.includes(variableName)) {
        variables.push(variableName);
      }
    }

    return variables;
  }

  /**
   * Validate context has all required variables
   */
  validateContext(template: NotificationTemplate, context: TemplateRenderContext): string[] {
    const allVariables = [
      ...this.extractVariables(template.titleTemplate),
      ...this.extractVariables(template.bodyTemplate)
    ];

    if (template.actionURLTemplate) {
      allVariables.push(...this.extractVariables(template.actionURLTemplate));
    }

    const missingVariables = allVariables.filter(variable => !(variable in context));
    
    if (missingVariables.length > 0) {
      this.logger.warn('Missing template variables', {
        templateID: template.templateID,
        missingVariables,
        providedVariables: Object.keys(context)
      });
    }

    return missingVariables;
  }

  /**
   * Preview template rendering (for testing)
   */
  async preview(template: NotificationTemplate, context: TemplateRenderContext): Promise<{
    result: TemplateRenderResult;
    missingVariables: string[];
    warnings: string[];
  }> {
    const warnings: string[] = [];
    const missingVariables = this.validateContext(template, context);

    if (missingVariables.length > 0) {
      warnings.push(`Missing variables: ${missingVariables.join(', ')}`);
    }

    const result = await this.render(template, context);

    return {
      result,
      missingVariables,
      warnings
    };
  }
} 