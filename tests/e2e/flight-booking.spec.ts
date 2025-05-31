/**
 * E2E Test: Flight Booking Flow
 * =============================
 * 
 * Comprehensive end-to-end test covering the complete flight booking experience
 * from search to confirmation, including error scenarios and edge cases.
 */

import { test, expect, Page } from '@playwright/test';

// Test configuration
const TEST_CONFIG = {
  baseUrl: process.env.E2E_BASE_URL || 'http://localhost:3000',
  timeout: 30000,
  user: {
    email: 'test@example.com',
    password: 'TestPassword123!',
    firstName: 'John',
    lastName: 'Doe',
  },
  flight: {
    departure: 'JFK',
    arrival: 'LAX',
    departureDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    returnDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
  }
};

test.describe('Flight Booking Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Set viewport for consistent testing
    await page.setViewportSize({ width: 1280, height: 720 });
    
    // Navigate to the application
    await page.goto(TEST_CONFIG.baseUrl);
    
    // Wait for the page to load
    await expect(page).toHaveTitle(/AeroFusionXR/);
  });

  test.describe('Authentication Flow', () => {
    test('should allow user registration and login', async ({ page }) => {
      // Navigate to registration page
      await page.click('[data-testid=register-button]');
      await expect(page).toHaveURL(/.*\/register/);
      
      // Fill registration form
      await page.fill('[data-testid=first-name-input]', TEST_CONFIG.user.firstName);
      await page.fill('[data-testid=last-name-input]', TEST_CONFIG.user.lastName);
      await page.fill('[data-testid=email-input]', TEST_CONFIG.user.email);
      await page.fill('[data-testid=password-input]', TEST_CONFIG.user.password);
      await page.fill('[data-testid=confirm-password-input]', TEST_CONFIG.user.password);
      
      // Accept terms and conditions
      await page.check('[data-testid=terms-checkbox]');
      
      // Submit registration
      await page.click('[data-testid=register-submit-button]');
      
      // Verify successful registration
      await expect(page.locator('[data-testid=success-message]')).toContainText('Registration successful');
      
      // Login with new account
      await page.fill('[data-testid=login-email-input]', TEST_CONFIG.user.email);
      await page.fill('[data-testid=login-password-input]', TEST_CONFIG.user.password);
      await page.click('[data-testid=login-submit-button]');
      
      // Verify successful login
      await expect(page).toHaveURL(/.*\/dashboard/);
      await expect(page.locator('[data-testid=user-menu]')).toBeVisible();
    });

    test('should handle login errors gracefully', async ({ page }) => {
      await page.click('[data-testid=login-button]');
      
      // Try invalid credentials
      await page.fill('[data-testid=login-email-input]', 'invalid@example.com');
      await page.fill('[data-testid=login-password-input]', 'wrongpassword');
      await page.click('[data-testid=login-submit-button]');
      
      // Verify error message
      await expect(page.locator('[data-testid=error-message]')).toContainText('Invalid credentials');
      
      // Verify user remains on login page
      await expect(page).toHaveURL(/.*\/login/);
    });
  });

  test.describe('Flight Search Flow', () => {
    test.beforeEach(async ({ page }) => {
      // Login before each test
      await loginUser(page);
    });

    test('should search for one-way flights', async ({ page }) => {
      // Navigate to booking page
      await page.click('[data-testid=book-flight-button]');
      await expect(page).toHaveURL(/.*\/booking/);
      
      // Select one-way trip
      await page.click('[data-testid=trip-type-oneway]');
      
      // Fill flight search form
      await page.fill('[data-testid=departure-airport]', TEST_CONFIG.flight.departure);
      await page.fill('[data-testid=arrival-airport]', TEST_CONFIG.flight.arrival);
      
      // Select departure date
      await page.click('[data-testid=departure-date-picker]');
      await selectDate(page, TEST_CONFIG.flight.departureDate);
      
      // Set passenger count
      await page.click('[data-testid=passenger-selector]');
      await page.selectOption('[data-testid=adult-passengers]', '1');
      
      // Search for flights
      await page.click('[data-testid=search-flights-button]');
      
      // Verify search results
      await expect(page.locator('[data-testid=flight-results]')).toBeVisible();
      await expect(page.locator('[data-testid=flight-card]')).toHaveCount({ min: 1 });
      
      // Verify flight information is displayed
      const firstFlight = page.locator('[data-testid=flight-card]').first();
      await expect(firstFlight.locator('[data-testid=departure-time]')).toBeVisible();
      await expect(firstFlight.locator('[data-testid=arrival-time]')).toBeVisible();
      await expect(firstFlight.locator('[data-testid=airline-name]')).toBeVisible();
      await expect(firstFlight.locator('[data-testid=flight-price]')).toBeVisible();
    });

    test('should search for round-trip flights', async ({ page }) => {
      await page.click('[data-testid=book-flight-button]');
      
      // Select round-trip
      await page.click('[data-testid=trip-type-roundtrip]');
      
      // Fill flight search form
      await page.fill('[data-testid=departure-airport]', TEST_CONFIG.flight.departure);
      await page.fill('[data-testid=arrival-airport]', TEST_CONFIG.flight.arrival);
      
      // Select dates
      await page.click('[data-testid=departure-date-picker]');
      await selectDate(page, TEST_CONFIG.flight.departureDate);
      
      await page.click('[data-testid=return-date-picker]');
      await selectDate(page, TEST_CONFIG.flight.returnDate);
      
      // Search flights
      await page.click('[data-testid=search-flights-button]');
      
      // Verify outbound and return flight sections
      await expect(page.locator('[data-testid=outbound-flights]')).toBeVisible();
      await expect(page.locator('[data-testid=return-flights]')).toBeVisible();
    });

    test('should handle search validation errors', async ({ page }) => {
      await page.click('[data-testid=book-flight-button]');
      
      // Try to search without filling required fields
      await page.click('[data-testid=search-flights-button]');
      
      // Verify validation errors
      await expect(page.locator('[data-testid=departure-error]')).toContainText('Departure airport is required');
      await expect(page.locator('[data-testid=arrival-error]')).toContainText('Arrival airport is required');
      await expect(page.locator('[data-testid=date-error]')).toContainText('Departure date is required');
    });
  });

  test.describe('Flight Selection and Booking', () => {
    test.beforeEach(async ({ page }) => {
      await loginUser(page);
      await searchFlights(page);
    });

    test('should complete flight booking with passenger details', async ({ page }) => {
      // Select a flight
      await page.click('[data-testid=flight-card]:first-child [data-testid=select-flight-button]');
      
      // Verify flight summary
      await expect(page.locator('[data-testid=flight-summary]')).toBeVisible();
      await expect(page.locator('[data-testid=total-price]')).toBeVisible();
      
      // Proceed to passenger details
      await page.click('[data-testid=continue-to-details-button]');
      
      // Fill passenger information
      await page.fill('[data-testid=passenger-first-name]', TEST_CONFIG.user.firstName);
      await page.fill('[data-testid=passenger-last-name]', TEST_CONFIG.user.lastName);
      await page.fill('[data-testid=passenger-email]', TEST_CONFIG.user.email);
      await page.fill('[data-testid=passenger-phone]', '+1234567890');
      
      // Select date of birth
      await page.selectOption('[data-testid=birth-year]', '1990');
      await page.selectOption('[data-testid=birth-month]', '01');
      await page.selectOption('[data-testid=birth-day]', '15');
      
      // Select gender
      await page.selectOption('[data-testid=gender]', 'male');
      
      // Add emergency contact
      await page.fill('[data-testid=emergency-contact-name]', 'Jane Doe');
      await page.fill('[data-testid=emergency-contact-phone]', '+0987654321');
      
      // Proceed to payment
      await page.click('[data-testid=continue-to-payment-button]');
      
      // Fill payment information
      await page.fill('[data-testid=card-number]', '4111111111111111');
      await page.fill('[data-testid=card-name]', `${TEST_CONFIG.user.firstName} ${TEST_CONFIG.user.lastName}`);
      await page.selectOption('[data-testid=card-month]', '12');
      await page.selectOption('[data-testid=card-year]', '2025');
      await page.fill('[data-testid=card-cvv]', '123');
      
      // Fill billing address
      await page.fill('[data-testid=billing-address]', '123 Main St');
      await page.fill('[data-testid=billing-city]', 'New York');
      await page.selectOption('[data-testid=billing-state]', 'NY');
      await page.fill('[data-testid=billing-zip]', '10001');
      
      // Accept terms and conditions
      await page.check('[data-testid=booking-terms-checkbox]');
      
      // Complete booking
      await page.click('[data-testid=complete-booking-button]');
      
      // Verify booking confirmation
      await expect(page.locator('[data-testid=booking-confirmation]')).toBeVisible();
      await expect(page.locator('[data-testid=confirmation-number]')).toBeVisible();
      await expect(page.locator('[data-testid=booking-details]')).toBeVisible();
      
      // Verify booking appears in user's bookings
      await page.click('[data-testid=view-my-bookings-button]');
      await expect(page.locator('[data-testid=booking-list]')).toBeVisible();
      await expect(page.locator('[data-testid=booking-item]')).toHaveCount({ min: 1 });
    });

    test('should handle payment errors gracefully', async ({ page }) => {
      await page.click('[data-testid=flight-card]:first-child [data-testid=select-flight-button]');
      await page.click('[data-testid=continue-to-details-button]');
      
      // Fill minimal passenger details
      await fillPassengerDetails(page);
      await page.click('[data-testid=continue-to-payment-button]');
      
      // Use invalid card number
      await page.fill('[data-testid=card-number]', '1234567890123456');
      await page.fill('[data-testid=card-name]', `${TEST_CONFIG.user.firstName} ${TEST_CONFIG.user.lastName}`);
      await page.selectOption('[data-testid=card-month]', '12');
      await page.selectOption('[data-testid=card-year]', '2025');
      await page.fill('[data-testid=card-cvv]', '123');
      
      await fillBillingAddress(page);
      await page.check('[data-testid=booking-terms-checkbox]');
      
      // Attempt to complete booking
      await page.click('[data-testid=complete-booking-button]');
      
      // Verify error message
      await expect(page.locator('[data-testid=payment-error]')).toContainText('Invalid card number');
      
      // Verify user stays on payment page
      await expect(page.locator('[data-testid=payment-form]')).toBeVisible();
    });
  });

  test.describe('Accessibility and Performance', () => {
    test('should be accessible', async ({ page }) => {
      await loginUser(page);
      
      // Check for basic accessibility features
      await expect(page.locator('main')).toHaveAttribute('role', 'main');
      await expect(page.locator('nav')).toHaveAttribute('role', 'navigation');
      
      // Verify skip links
      await expect(page.locator('[data-testid=skip-to-content]')).toBeVisible();
      
      // Check for proper heading hierarchy
      const h1Elements = await page.locator('h1').count();
      expect(h1Elements).toBe(1);
      
      // Verify form labels
      await page.click('[data-testid=book-flight-button]');
      await expect(page.locator('label[for="departure-airport"]')).toBeVisible();
      await expect(page.locator('label[for="arrival-airport"]')).toBeVisible();
    });

    test('should load within performance thresholds', async ({ page }) => {
      const startTime = Date.now();
      
      await page.goto(TEST_CONFIG.baseUrl);
      await page.waitForLoadState('networkidle');
      
      const loadTime = Date.now() - startTime;
      
      // Verify page loads within 3 seconds
      expect(loadTime).toBeLessThan(3000);
      
      // Verify core web vitals
      const metrics = await page.evaluate(() => {
        return new Promise((resolve) => {
          new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const lcp = entries.find(entry => entry.entryType === 'largest-contentful-paint');
            const fid = entries.find(entry => entry.entryType === 'first-input');
            
            resolve({
              lcp: lcp?.startTime || 0,
              fid: fid?.processingStart - fid?.startTime || 0,
            });
          }).observe({ entryTypes: ['largest-contentful-paint', 'first-input'] });
        });
      });
      
      // LCP should be under 2.5 seconds
      expect(metrics.lcp).toBeLessThan(2500);
    });
  });
});

// Helper Functions
async function loginUser(page: Page): Promise<void> {
  await page.click('[data-testid=login-button]');
  await page.fill('[data-testid=login-email-input]', TEST_CONFIG.user.email);
  await page.fill('[data-testid=login-password-input]', TEST_CONFIG.user.password);
  await page.click('[data-testid=login-submit-button]');
  await expect(page).toHaveURL(/.*\/dashboard/);
}

async function searchFlights(page: Page): Promise<void> {
  await page.click('[data-testid=book-flight-button]');
  await page.fill('[data-testid=departure-airport]', TEST_CONFIG.flight.departure);
  await page.fill('[data-testid=arrival-airport]', TEST_CONFIG.flight.arrival);
  await page.click('[data-testid=departure-date-picker]');
  await selectDate(page, TEST_CONFIG.flight.departureDate);
  await page.click('[data-testid=search-flights-button]');
  await expect(page.locator('[data-testid=flight-results]')).toBeVisible();
}

async function selectDate(page: Page, date: Date): Promise<void> {
  const day = date.getDate().toString();
  await page.click(`[data-testid=calendar-day-${day}]`);
}

async function fillPassengerDetails(page: Page): Promise<void> {
  await page.fill('[data-testid=passenger-first-name]', TEST_CONFIG.user.firstName);
  await page.fill('[data-testid=passenger-last-name]', TEST_CONFIG.user.lastName);
  await page.fill('[data-testid=passenger-email]', TEST_CONFIG.user.email);
  await page.fill('[data-testid=passenger-phone]', '+1234567890');
  await page.selectOption('[data-testid=birth-year]', '1990');
  await page.selectOption('[data-testid=birth-month]', '01');
  await page.selectOption('[data-testid=birth-day]', '15');
  await page.selectOption('[data-testid=gender]', 'male');
}

async function fillBillingAddress(page: Page): Promise<void> {
  await page.fill('[data-testid=billing-address]', '123 Main St');
  await page.fill('[data-testid=billing-city]', 'New York');
  await page.selectOption('[data-testid=billing-state]', 'NY');
  await page.fill('[data-testid=billing-zip]', '10001');
} 