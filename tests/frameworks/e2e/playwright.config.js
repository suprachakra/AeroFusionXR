/**
 * AeroFusionXR End-to-End Testing Framework
 * =========================================
 * 
 * Enterprise-grade Playwright configuration for comprehensive end-to-end testing
 * across all client applications (Web, Mobile, XR, Kiosk).
 * 
 * Features:
 * - Multi-browser testing (Chromium, Firefox, Safari, Edge)
 * - Mobile device emulation
 * - Cross-platform testing
 * - Visual regression testing
 * - Performance monitoring
 * - Accessibility testing
 * - Network condition simulation
 * - Video recording and screenshots
 * - Parallel test execution
 * - CI/CD integration
 */

const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  
  // Global test timeout
  timeout: 60000,
  expect: {
    // Global expect timeout
    timeout: 10000,
    // Screenshot comparisons
    threshold: 0.1,
    toHaveScreenshot: { threshold: 0.1, maxDiffPixels: 500 },
    toMatchScreenshot: { threshold: 0.1, maxDiffPixels: 500 }
  },
  
  // Test execution configuration
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 4 : '50%',
  
  // Reporter configuration
  reporter: [
    ['html', { 
      outputFolder: '../../../reports/e2e-html',
      open: 'never'
    }],
    ['json', { 
      outputFile: '../../../reports/e2e-results.json' 
    }],
    ['junit', { 
      outputFile: '../../../reports/e2e-junit.xml' 
    }],
    ['allure-playwright', {
      detail: true,
      outputFolder: '../../../reports/allure-results',
      suiteTitle: true
    }],
    process.env.CI ? ['github'] : ['list']
  ],
  
  // Global setup and teardown
  globalSetup: require.resolve('./global-setup'),
  globalTeardown: require.resolve('./global-teardown'),
  
  // Test configuration
  use: {
    // Base URL for all tests
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    
    // Browser context options
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    
    // Network conditions
    httpCredentials: process.env.HTTP_AUTH ? {
      username: process.env.HTTP_USERNAME,
      password: process.env.HTTP_PASSWORD
    } : undefined,
    
    // Ignore HTTPS errors in development
    ignoreHTTPSErrors: true,
    
    // Action timeout
    actionTimeout: 10000,
    
    // Navigation timeout
    navigationTimeout: 30000,
    
    // Extra HTTP headers
    extraHTTPHeaders: {
      'User-Agent': 'AeroFusionXR-E2E-Tests/1.0.0',
      'X-Test-Environment': process.env.TEST_ENV || 'e2e'
    }
  },
  
  // Project configurations for different browsers and devices
  projects: [
    // ================================
    // DESKTOP BROWSERS
    // ================================
    {
      name: 'chromium-desktop',
      use: { 
        ...devices['Desktop Chrome'],
        channel: 'chrome',
        viewport: { width: 1920, height: 1080 },
        deviceScaleFactor: 1
      },
      testMatch: '**/web/**/*.spec.js'
    },
    {
      name: 'firefox-desktop',
      use: { 
        ...devices['Desktop Firefox'],
        viewport: { width: 1920, height: 1080 }
      },
      testMatch: '**/web/**/*.spec.js'
    },
    {
      name: 'webkit-desktop',
      use: { 
        ...devices['Desktop Safari'],
        viewport: { width: 1920, height: 1080 }
      },
      testMatch: '**/web/**/*.spec.js'
    },
    {
      name: 'edge-desktop',
      use: { 
        ...devices['Desktop Edge'],
        channel: 'msedge',
        viewport: { width: 1920, height: 1080 }
      },
      testMatch: '**/web/**/*.spec.js'
    },
    
    // ================================
    // MOBILE DEVICES
    // ================================
    {
      name: 'mobile-chrome',
      use: { 
        ...devices['Pixel 7'],
        deviceScaleFactor: 2.625,
        hasTouch: true,
        isMobile: true
      },
      testMatch: '**/mobile/**/*.spec.js'
    },
    {
      name: 'mobile-safari',
      use: { 
        ...devices['iPhone 14 Pro'],
        deviceScaleFactor: 3,
        hasTouch: true,
        isMobile: true
      },
      testMatch: '**/mobile/**/*.spec.js'
    },
    {
      name: 'tablet-chrome',
      use: { 
        ...devices['Galaxy Tab S4'],
        deviceScaleFactor: 2.25,
        hasTouch: true,
        isMobile: false
      },
      testMatch: '**/tablet/**/*.spec.js'
    },
    {
      name: 'tablet-safari',
      use: { 
        ...devices['iPad Pro 11'],
        deviceScaleFactor: 2,
        hasTouch: true,
        isMobile: false
      },
      testMatch: '**/tablet/**/*.spec.js'
    },
    
    // ================================
    // KIOSK TESTING
    // ================================
    {
      name: 'kiosk-touchscreen',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
        hasTouch: true,
        deviceScaleFactor: 1,
        userAgent: 'AeroFusionXR-Kiosk/1.0.0 (TouchScreen)',
        extraHTTPHeaders: {
          'X-Kiosk-Mode': 'true',
          'X-Device-Type': 'kiosk'
        }
      },
      testMatch: '**/kiosk/**/*.spec.js'
    },
    {
      name: 'kiosk-large-display',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 3840, height: 2160 }, // 4K display
        hasTouch: true,
        deviceScaleFactor: 1,
        userAgent: 'AeroFusionXR-Kiosk/1.0.0 (LargeDisplay)'
      },
      testMatch: '**/kiosk/**/*.spec.js'
    },
    
    // ================================
    // XR TESTING (Simulated)
    // ================================
    {
      name: 'xr-simulation',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 2880, height: 1700 }, // VR headset simulation
        deviceScaleFactor: 1,
        userAgent: 'AeroFusionXR-XR/1.0.0 (VRHeadset)',
        extraHTTPHeaders: {
          'X-XR-Mode': 'true',
          'X-Device-Type': 'vr-headset',
          'X-WebXR-Support': 'true'
        }
      },
      testMatch: '**/xr/**/*.spec.js'
    },
    
    // ================================
    // ACCESSIBILITY TESTING
    // ================================
    {
      name: 'accessibility-chrome',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
        forcedColors: 'active', // High contrast mode
        reducedMotion: 'reduce'
      },
      testMatch: '**/accessibility/**/*.spec.js'
    },
    
    // ================================
    // PERFORMANCE TESTING
    // ================================
    {
      name: 'performance-desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
        // Throttle CPU and network for performance testing
        launchOptions: {
          args: [
            '--enable-features=NetworkService',
            '--disable-web-security',
            '--disable-features=TranslateUI',
            '--disable-ipc-flooding-protection'
          ]
        }
      },
      testMatch: '**/performance/**/*.spec.js'
    },
    {
      name: 'performance-mobile',
      use: {
        ...devices['Pixel 7'],
        // Simulate slower mobile device
        deviceScaleFactor: 2.625,
        hasTouch: true,
        isMobile: true
      },
      testMatch: '**/performance/**/*.spec.js'
    },
    
    // ================================
    // NETWORK CONDITIONS
    // ================================
    {
      name: 'slow-3g',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
        // Simulate slow 3G connection
        offline: false,
        // This would be configured in test files with page.route()
      },
      testMatch: '**/network/**/*.spec.js'
    },
    
    // ================================
    // LOCALIZATION TESTING
    // ================================
    {
      name: 'locale-es',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
        locale: 'es-ES',
        timezoneId: 'Europe/Madrid'
      },
      testMatch: '**/localization/**/*.spec.js'
    },
    {
      name: 'locale-fr',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
        locale: 'fr-FR',
        timezoneId: 'Europe/Paris'
      },
      testMatch: '**/localization/**/*.spec.js'
    },
    {
      name: 'locale-zh',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
        locale: 'zh-CN',
        timezoneId: 'Asia/Shanghai'
      },
      testMatch: '**/localization/**/*.spec.js'
    }
  ],
  
  // Output directories
  outputDir: '../../../reports/e2e-artifacts',
  
  // Test directory structure
  testIgnore: [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/coverage/**'
  ],
  
  // Web server configuration for local testing
  webServer: process.env.CI ? undefined : [
    {
      command: 'npm run dev',
      cwd: '../../../clients/web',
      port: 3000,
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
      env: {
        NODE_ENV: 'test',
        REACT_APP_API_URL: 'http://localhost:8000'
      }
    },
    {
      command: 'npm run start:kiosk',
      cwd: '../../../clients/kiosk',
      port: 3001,
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
      env: {
        NODE_ENV: 'test',
        ELECTRON_IS_DEV: 'true'
      }
    }
  ],
  
  // Global test configuration
  metadata: {
    platform: process.platform,
    testEnvironment: process.env.TEST_ENV || 'local',
    buildNumber: process.env.BUILD_NUMBER || 'local',
    gitCommit: process.env.GIT_COMMIT || 'unknown'
  }
}); 