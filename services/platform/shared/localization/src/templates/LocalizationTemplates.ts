export interface LocalizationTemplate {
  templateID: string;
  templateType: 'email' | 'notification' | 'ui' | 'voice' | 'error';
  locale: string;
  title?: string;
  subject?: string;
  bodyTemplate: string;
  variables: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'date' | 'currency' | 'boolean';
  required: boolean;
  defaultValue?: any;
  description: string;
}

export interface TemplateRenderRequest {
  templateID: string;
  locale: string;
  variables: Record<string, any>;
}

export interface TemplateRenderResponse {
  templateID: string;
  locale: string;
  renderedTitle?: string;
  renderedSubject?: string;
  renderedBody: string;
  usedVariables: string[];
}

/**
 * Template management for localized content
 */
export class LocalizationTemplateManager {
  private templates: Map<string, Map<string, LocalizationTemplate>>;
  private templateVariables: Map<string, TemplateVariable[]>;

  constructor() {
    this.templates = new Map();
    this.templateVariables = new Map();
    this.initializeDefaultTemplates();
  }

  /**
   * Get template for specific ID and locale
   */
  getTemplate(templateID: string, locale: string): LocalizationTemplate | null {
    const localeTemplates = this.templates.get(templateID);
    if (!localeTemplates) {
      return null;
    }
    
    return localeTemplates.get(locale) || localeTemplates.get('en-US') || null;
  }

  /**
   * Render template with variables
   */
  renderTemplate(request: TemplateRenderRequest): TemplateRenderResponse {
    const template = this.getTemplate(request.templateID, request.locale);
    if (!template) {
      throw new Error(`Template not found: ${request.templateID} for locale ${request.locale}`);
    }

    const usedVariables: string[] = [];
    
    // Render title if present
    let renderedTitle: string | undefined;
    if (template.title) {
      renderedTitle = this.renderString(template.title, request.variables, usedVariables);
    }

    // Render subject if present
    let renderedSubject: string | undefined;
    if (template.subject) {
      renderedSubject = this.renderString(template.subject, request.variables, usedVariables);
    }

    // Render body
    const renderedBody = this.renderString(template.bodyTemplate, request.variables, usedVariables);

    return {
      templateID: request.templateID,
      locale: request.locale,
      renderedTitle,
      renderedSubject,
      renderedBody,
      usedVariables: [...new Set(usedVariables)]
    };
  }

  /**
   * Add or update template
   */
  setTemplate(template: LocalizationTemplate): void {
    if (!this.templates.has(template.templateID)) {
      this.templates.set(template.templateID, new Map());
    }
    
    this.templates.get(template.templateID)!.set(template.locale, template);
  }

  /**
   * Get all available template IDs
   */
  getTemplateIDs(): string[] {
    return Array.from(this.templates.keys());
  }

  /**
   * Get supported locales for a template
   */
  getTemplateSupportedLocales(templateID: string): string[] {
    const localeTemplates = this.templates.get(templateID);
    if (!localeTemplates) {
      return [];
    }
    
    return Array.from(localeTemplates.keys());
  }

  private renderString(template: string, variables: Record<string, any>, usedVariables: string[]): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, variableName) => {
      usedVariables.push(variableName);
      
      if (variables.hasOwnProperty(variableName)) {
        const value = variables[variableName];
        
        // Handle different data types
        if (value instanceof Date) {
          return value.toISOString();
        }
        if (typeof value === 'number') {
          return value.toString();
        }
        if (typeof value === 'boolean') {
          return value.toString();
        }
        
        return String(value);
      }
      
      // Return placeholder if variable not provided
      return match;
    });
  }

  private initializeDefaultTemplates(): void {
    // Email templates
    this.setTemplate({
      templateID: 'welcome_email',
      templateType: 'email',
      locale: 'en-US',
      subject: 'Welcome to AeroFusionXR, {{userName}}!',
      bodyTemplate: `
        <h1>Welcome to AeroFusionXR!</h1>
        <p>Dear {{userName}},</p>
        <p>Thank you for joining AeroFusionXR. Experience the future of travel with our cutting-edge AR/VR platform.</p>
        <p>Your account is now active and ready to use.</p>
        <p>Start exploring: <a href="{{appURL}}">Launch AeroFusionXR</a></p>
        <p>Best regards,<br>The AeroFusionXR Team</p>
      `,
      variables: ['userName', 'appURL'],
      createdAt: new Date(),
      updatedAt: new Date()
    });

    this.setTemplate({
      templateID: 'welcome_email',
      templateType: 'email',
      locale: 'fr-FR',
      subject: 'Bienvenue sur AeroFusionXR, {{userName}} !',
      bodyTemplate: `
        <h1>Bienvenue sur AeroFusionXR !</h1>
        <p>Cher {{userName}},</p>
        <p>Merci de nous avoir rejoint sur AeroFusionXR. Découvrez l'avenir du voyage avec notre plateforme AR/VR de pointe.</p>
        <p>Votre compte est maintenant actif et prêt à utiliser.</p>
        <p>Commencez à explorer : <a href="{{appURL}}">Lancer AeroFusionXR</a></p>
        <p>Cordialement,<br>L'équipe AeroFusionXR</p>
      `,
      variables: ['userName', 'appURL'],
      createdAt: new Date(),
      updatedAt: new Date()
    });

    this.setTemplate({
      templateID: 'welcome_email',
      templateType: 'email',
      locale: 'ar-AE',
      subject: 'مرحباً بك في AeroFusionXR، {{userName}}!',
      bodyTemplate: `
        <h1 dir="rtl">مرحباً بك في AeroFusionXR!</h1>
        <p dir="rtl">عزيزي {{userName}}،</p>
        <p dir="rtl">شكراً لانضمامك إلى AeroFusionXR. اكتشف مستقبل السفر مع منصتنا المتقدمة للواقع المعزز والافتراضي.</p>
        <p dir="rtl">حسابك الآن نشط وجاهز للاستخدام.</p>
        <p dir="rtl">ابدأ الاستكشاف: <a href="{{appURL}}">تشغيل AeroFusionXR</a></p>
        <p dir="rtl">مع أطيب التحيات،<br>فريق AeroFusionXR</p>
      `,
      variables: ['userName', 'appURL'],
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Notification templates
    this.setTemplate({
      templateID: 'payment_success',
      templateType: 'notification',
      locale: 'en-US',
      title: 'Payment Successful',
      bodyTemplate: 'Your payment of {{amount}} {{currency}} for order #{{orderID}} has been confirmed.',
      variables: ['amount', 'currency', 'orderID'],
      createdAt: new Date(),
      updatedAt: new Date()
    });

    this.setTemplate({
      templateID: 'payment_success',
      templateType: 'notification',
      locale: 'fr-FR',
      title: 'Paiement réussi',
      bodyTemplate: 'Votre paiement de {{amount}} {{currency}} pour la commande #{{orderID}} a été confirmé.',
      variables: ['amount', 'currency', 'orderID'],
      createdAt: new Date(),
      updatedAt: new Date()
    });

    this.setTemplate({
      templateID: 'payment_success',
      templateType: 'notification',
      locale: 'ar-AE',
      title: 'تم الدفع بنجاح',
      bodyTemplate: 'تم تأكيد دفعتك بمبلغ {{amount}} {{currency}} للطلب #{{orderID}}.',
      variables: ['amount', 'currency', 'orderID'],
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // UI String templates
    this.setTemplate({
      templateID: 'checkout_confirmation',
      templateType: 'ui',
      locale: 'en-US',
      bodyTemplate: 'Order #{{orderID}} - Total: {{total}} {{currency}}',
      variables: ['orderID', 'total', 'currency'],
      createdAt: new Date(),
      updatedAt: new Date()
    });

    this.setTemplate({
      templateID: 'checkout_confirmation',
      templateType: 'ui',
      locale: 'de-DE',
      bodyTemplate: 'Bestellung #{{orderID}} - Gesamt: {{total}} {{currency}}',
      variables: ['orderID', 'total', 'currency'],
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Voice templates
    this.setTemplate({
      templateID: 'navigation_prompt',
      templateType: 'voice',
      locale: 'en-US',
      bodyTemplate: 'Please proceed {{direction}} for {{distance}} meters to reach {{destination}}.',
      variables: ['direction', 'distance', 'destination'],
      createdAt: new Date(),
      updatedAt: new Date()
    });

    this.setTemplate({
      templateID: 'navigation_prompt',
      templateType: 'voice',
      locale: 'ja-JP',
      bodyTemplate: '{{destination}}に到達するために{{direction}}に{{distance}}メートル進んでください。',
      variables: ['direction', 'distance', 'destination'],
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Error message templates
    this.setTemplate({
      templateID: 'payment_failed',
      templateType: 'error',
      locale: 'en-US',
      title: 'Payment Failed',
      bodyTemplate: 'Payment for order #{{orderID}} failed: {{errorReason}}. Please try again.',
      variables: ['orderID', 'errorReason'],
      createdAt: new Date(),
      updatedAt: new Date()
    });

    this.setTemplate({
      templateID: 'payment_failed',
      templateType: 'error',
      locale: 'es-ES',
      title: 'Error en el Pago',
      bodyTemplate: 'El pago del pedido #{{orderID}} falló: {{errorReason}}. Por favor, inténtelo de nuevo.',
      variables: ['orderID', 'errorReason'],
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Template variables definitions
    this.templateVariables.set('welcome_email', [
      { name: 'userName', type: 'string', required: true, description: 'User display name' },
      { name: 'appURL', type: 'string', required: true, description: 'Application launch URL' }
    ]);

    this.templateVariables.set('payment_success', [
      { name: 'amount', type: 'number', required: true, description: 'Payment amount' },
      { name: 'currency', type: 'string', required: true, description: 'Currency code' },
      { name: 'orderID', type: 'string', required: true, description: 'Order identifier' }
    ]);

    this.templateVariables.set('navigation_prompt', [
      { name: 'direction', type: 'string', required: true, description: 'Direction to move' },
      { name: 'distance', type: 'number', required: true, description: 'Distance in meters' },
      { name: 'destination', type: 'string', required: true, description: 'Destination name' }
    ]);
  }
} 