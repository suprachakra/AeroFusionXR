/**
 * AeroFusionXR - Pillar 3: Runtime Safety
 * Safety Circuit Breaker - Real-time AI system protection
 * 
 * Features:
 * - Intelligent circuit breaking for AI services
 * - Anomaly detection and response
 * - Graceful degradation mechanisms
 * - Performance monitoring and alerting
 */

const { EventEmitter } = require('events');
const winston = require('winston');

class SafetyCircuitBreaker extends EventEmitter {
    constructor(config) {
        super();
        this.config = {
            failureThreshold: 5,
            recoveryTimeout: 60000, // 1 minute
            monitoringWindow: 300000, // 5 minutes
            anomalyThreshold: 0.8,
            performanceThreshold: {
                responseTime: 5000, // 5 seconds
                errorRate: 0.05, // 5%
                throughput: 100 // requests per minute
            },
            ...config
        };

        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            transports: [
                new winston.transports.File({ filename: 'logs/safety-circuit-breaker.log' }),
                new winston.transports.Console()
            ]
        });

        // Circuit breaker states: CLOSED, OPEN, HALF_OPEN
        this.circuits = new Map();
        this.metrics = new Map();
        this.anomalyDetector = new AnomalyDetector();
        this.failsafeManager = new FailsafeManager();
        
        this.initializeCircuits();
        this.startMonitoring();
    }

    /**
     * Initialize circuit breakers for all AI services
     */
    initializeCircuits() {
        const services = [
            'ai-concierge',
            'wayfinding-ai',
            'baggage-tracker',
            'flight-info-ai',
            'commerce-ai',
            'security-ai'
        ];

        services.forEach(service => {
            this.circuits.set(service, {
                state: 'CLOSED',
                failureCount: 0,
                lastFailureTime: null,
                successCount: 0,
                totalRequests: 0,
                responseTimeHistory: [],
                errorHistory: [],
                anomalyScore: 0,
                lastHealthCheck: new Date(),
                degradationLevel: 0 // 0 = normal, 1-5 = increasing degradation
            });

            this.metrics.set(service, {
                requestCount: 0,
                errorCount: 0,
                totalResponseTime: 0,
                averageResponseTime: 0,
                throughput: 0,
                errorRate: 0,
                availability: 100,
                lastUpdated: new Date()
            });
        });

        this.logger.info('Circuit breakers initialized for all services');
    }

    /**
     * Start continuous monitoring
     */
    startMonitoring() {
        // Health check every 30 seconds
        setInterval(() => {
            this.performHealthChecks();
        }, 30000);

        // Metrics calculation every minute
        setInterval(() => {
            this.calculateMetrics();
        }, 60000);

        // Anomaly detection every 2 minutes
        setInterval(() => {
            this.detectAnomalies();
        }, 120000);

        // Circuit state evaluation every 10 seconds
        setInterval(() => {
            this.evaluateCircuitStates();
        }, 10000);

        this.logger.info('Safety monitoring started');
    }

    /**
     * Execute request through circuit breaker
     */
    async executeRequest(service, requestFn, fallbackFn = null) {
        const circuit = this.circuits.get(service);
        if (!circuit) {
            throw new Error(`Circuit breaker not found for service: ${service}`);
        }

        const startTime = Date.now();
        circuit.totalRequests++;

        try {
            // Check circuit state
            if (circuit.state === 'OPEN') {
                this.logger.warn(`Circuit breaker OPEN for ${service}, using fallback`);
                return await this.executeFallback(service, fallbackFn);
            }

            // Execute request with timeout
            const result = await this.executeWithTimeout(requestFn, this.config.performanceThreshold.responseTime);
            const responseTime = Date.now() - startTime;

            // Record success
            await this.recordSuccess(service, responseTime);
            
            return result;

        } catch (error) {
            const responseTime = Date.now() - startTime;
            
            // Record failure
            await this.recordFailure(service, error, responseTime);
            
            // Try fallback if available
            if (fallbackFn) {
                this.logger.warn(`Primary request failed for ${service}, using fallback`, { error: error.message });
                return await this.executeFallback(service, fallbackFn);
            }
            
            throw error;
        }
    }

    /**
     * Execute request with timeout
     */
    async executeWithTimeout(requestFn, timeout) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error('Request timeout'));
            }, timeout);

            requestFn()
                .then(result => {
                    clearTimeout(timer);
                    resolve(result);
                })
                .catch(error => {
                    clearTimeout(timer);
                    reject(error);
                });
        });
    }

    /**
     * Record successful request
     */
    async recordSuccess(service, responseTime) {
        const circuit = this.circuits.get(service);
        const metrics = this.metrics.get(service);

        circuit.successCount++;
        circuit.responseTimeHistory.push({
            time: new Date(),
            responseTime: responseTime
        });

        // Keep only recent history
        const cutoff = new Date(Date.now() - this.config.monitoringWindow);
        circuit.responseTimeHistory = circuit.responseTimeHistory.filter(h => h.time > cutoff);

        // Update metrics
        metrics.requestCount++;
        metrics.totalResponseTime += responseTime;
        metrics.averageResponseTime = metrics.totalResponseTime / metrics.requestCount;
        metrics.lastUpdated = new Date();

        // Reset failure count on success in HALF_OPEN state
        if (circuit.state === 'HALF_OPEN') {
            circuit.failureCount = 0;
            if (circuit.successCount >= 3) {
                await this.closeCircuit(service);
            }
        }

        // Check for performance degradation
        await this.checkPerformanceDegradation(service, responseTime);
    }

    /**
     * Record failed request
     */
    async recordFailure(service, error, responseTime) {
        const circuit = this.circuits.get(service);
        const metrics = this.metrics.get(service);

        circuit.failureCount++;
        circuit.lastFailureTime = new Date();
        circuit.errorHistory.push({
            time: new Date(),
            error: error.message,
            responseTime: responseTime
        });

        // Keep only recent history
        const cutoff = new Date(Date.now() - this.config.monitoringWindow);
        circuit.errorHistory = circuit.errorHistory.filter(h => h.time > cutoff);

        // Update metrics
        metrics.requestCount++;
        metrics.errorCount++;
        metrics.errorRate = metrics.errorCount / metrics.requestCount;
        metrics.lastUpdated = new Date();

        // Check if circuit should open
        if (circuit.failureCount >= this.config.failureThreshold) {
            await this.openCircuit(service, error);
        }

        this.logger.error(`Request failed for ${service}`, {
            error: error.message,
            failureCount: circuit.failureCount,
            responseTime: responseTime
        });
    }

    /**
     * Open circuit breaker
     */
    async openCircuit(service, error) {
        const circuit = this.circuits.get(service);
        circuit.state = 'OPEN';
        circuit.lastFailureTime = new Date();

        this.logger.error(`Circuit breaker OPENED for ${service}`, {
            failureCount: circuit.failureCount,
            error: error.message
        });

        // Emit event for monitoring
        this.emit('circuitOpened', { service, error, failureCount: circuit.failureCount });

        // Schedule recovery attempt
        setTimeout(() => {
            this.attemptRecovery(service);
        }, this.config.recoveryTimeout);

        // Trigger emergency protocols if critical service
        if (this.isCriticalService(service)) {
            await this.triggerEmergencyProtocols(service, error);
        }
    }

    /**
     * Attempt circuit recovery
     */
    async attemptRecovery(service) {
        const circuit = this.circuits.get(service);
        
        if (circuit.state === 'OPEN') {
            circuit.state = 'HALF_OPEN';
            circuit.successCount = 0;
            
            this.logger.info(`Circuit breaker entering HALF_OPEN state for ${service}`);
            this.emit('circuitHalfOpen', { service });
        }
    }

    /**
     * Close circuit breaker
     */
    async closeCircuit(service) {
        const circuit = this.circuits.get(service);
        circuit.state = 'CLOSED';
        circuit.failureCount = 0;
        circuit.degradationLevel = 0;

        this.logger.info(`Circuit breaker CLOSED for ${service}`);
        this.emit('circuitClosed', { service });
    }

    /**
     * Execute fallback mechanism
     */
    async executeFallback(service, fallbackFn) {
        if (fallbackFn) {
            try {
                const result = await fallbackFn();
                this.logger.info(`Fallback executed successfully for ${service}`);
                return result;
            } catch (fallbackError) {
                this.logger.error(`Fallback failed for ${service}`, { error: fallbackError.message });
                throw fallbackError;
            }
        }

        // Default fallback responses
        return this.getDefaultFallback(service);
    }

    /**
     * Get default fallback response
     */
    getDefaultFallback(service) {
        const fallbacks = {
            'ai-concierge': {
                response: 'I apologize, but I\'m experiencing technical difficulties. Please visit the information desk for assistance.',
                confidence: 0.0,
                fallback: true
            },
            'wayfinding-ai': {
                directions: 'Please refer to airport maps or ask airport staff for directions.',
                fallback: true
            },
            'baggage-tracker': {
                status: 'Unable to track baggage at this time. Please contact your airline.',
                fallback: true
            },
            'flight-info-ai': {
                message: 'Flight information temporarily unavailable. Please check departure boards.',
                fallback: true
            },
            'commerce-ai': {
                recommendations: [],
                message: 'Recommendations temporarily unavailable.',
                fallback: true
            },
            'security-ai': {
                status: 'Security screening information unavailable. Please follow standard procedures.',
                fallback: true
            }
        };

        return fallbacks[service] || {
            message: 'Service temporarily unavailable. Please try again later.',
            fallback: true
        };
    }

    /**
     * Perform health checks
     */
    async performHealthChecks() {
        for (const [service, circuit] of this.circuits) {
            try {
                const healthStatus = await this.checkServiceHealth(service);
                circuit.lastHealthCheck = new Date();
                
                if (!healthStatus.healthy && circuit.state === 'CLOSED') {
                    this.logger.warn(`Health check failed for ${service}`, healthStatus);
                    await this.recordFailure(service, new Error('Health check failed'), 0);
                }
            } catch (error) {
                this.logger.error(`Health check error for ${service}`, { error: error.message });
            }
        }
    }

    /**
     * Check service health
     */
    async checkServiceHealth(service) {
        // Simulate health check - in real implementation, call actual health endpoints
        const isHealthy = Math.random() > 0.05; // 95% healthy
        
        return {
            service: service,
            healthy: isHealthy,
            responseTime: Math.random() * 1000,
            timestamp: new Date(),
            checks: {
                connectivity: isHealthy,
                database: isHealthy,
                dependencies: isHealthy
            }
        };
    }

    /**
     * Calculate service metrics
     */
    calculateMetrics() {
        for (const [service, metrics] of this.metrics) {
            const circuit = this.circuits.get(service);
            
            // Calculate throughput (requests per minute)
            const oneMinuteAgo = new Date(Date.now() - 60000);
            const recentRequests = circuit.responseTimeHistory.filter(h => h.time > oneMinuteAgo).length;
            metrics.throughput = recentRequests;

            // Calculate availability
            const totalRequests = circuit.totalRequests;
            const errorCount = circuit.errorHistory.length;
            metrics.availability = totalRequests > 0 ? ((totalRequests - errorCount) / totalRequests) * 100 : 100;

            // Update error rate
            metrics.errorRate = totalRequests > 0 ? errorCount / totalRequests : 0;

            this.logger.debug(`Metrics updated for ${service}`, {
                throughput: metrics.throughput,
                availability: metrics.availability,
                errorRate: metrics.errorRate,
                averageResponseTime: metrics.averageResponseTime
            });
        }
    }

    /**
     * Detect anomalies
     */
    async detectAnomalies() {
        for (const [service, circuit] of this.circuits) {
            const metrics = this.metrics.get(service);
            
            // Detect response time anomalies
            const responseTimeAnomaly = await this.anomalyDetector.detectResponseTimeAnomaly(
                circuit.responseTimeHistory
            );
            
            // Detect error rate anomalies
            const errorRateAnomaly = await this.anomalyDetector.detectErrorRateAnomaly(
                circuit.errorHistory
            );
            
            // Detect throughput anomalies
            const throughputAnomaly = await this.anomalyDetector.detectThroughputAnomaly(
                metrics.throughput
            );

            // Calculate overall anomaly score
            circuit.anomalyScore = Math.max(
                responseTimeAnomaly.score,
                errorRateAnomaly.score,
                throughputAnomaly.score
            );

            if (circuit.anomalyScore > this.config.anomalyThreshold) {
                this.logger.warn(`Anomaly detected for ${service}`, {
                    anomalyScore: circuit.anomalyScore,
                    responseTimeAnomaly: responseTimeAnomaly,
                    errorRateAnomaly: errorRateAnomaly,
                    throughputAnomaly: throughputAnomaly
                });

                this.emit('anomalyDetected', {
                    service,
                    anomalyScore: circuit.anomalyScore,
                    details: {
                        responseTimeAnomaly,
                        errorRateAnomaly,
                        throughputAnomaly
                    }
                });

                // Increase degradation level
                circuit.degradationLevel = Math.min(5, circuit.degradationLevel + 1);
            } else {
                // Decrease degradation level if no anomalies
                circuit.degradationLevel = Math.max(0, circuit.degradationLevel - 1);
            }
        }
    }

    /**
     * Evaluate circuit states
     */
    evaluateCircuitStates() {
        for (const [service, circuit] of this.circuits) {
            const metrics = this.metrics.get(service);

            // Check if OPEN circuit should attempt recovery
            if (circuit.state === 'OPEN') {
                const timeSinceFailure = Date.now() - circuit.lastFailureTime.getTime();
                if (timeSinceFailure > this.config.recoveryTimeout) {
                    this.attemptRecovery(service);
                }
            }

            // Check for performance degradation
            if (circuit.state === 'CLOSED' && circuit.degradationLevel >= 3) {
                this.logger.warn(`Performance degradation detected for ${service}`, {
                    degradationLevel: circuit.degradationLevel,
                    anomalyScore: circuit.anomalyScore
                });

                // Consider opening circuit if severe degradation
                if (circuit.degradationLevel >= 5) {
                    this.openCircuit(service, new Error('Severe performance degradation'));
                }
            }
        }
    }

    /**
     * Check performance degradation
     */
    async checkPerformanceDegradation(service, responseTime) {
        const circuit = this.circuits.get(service);
        const metrics = this.metrics.get(service);

        // Check response time threshold
        if (responseTime > this.config.performanceThreshold.responseTime) {
            circuit.degradationLevel = Math.min(5, circuit.degradationLevel + 1);
            this.logger.warn(`Slow response detected for ${service}`, {
                responseTime: responseTime,
                threshold: this.config.performanceThreshold.responseTime,
                degradationLevel: circuit.degradationLevel
            });
        }

        // Check error rate threshold
        if (metrics.errorRate > this.config.performanceThreshold.errorRate) {
            circuit.degradationLevel = Math.min(5, circuit.degradationLevel + 1);
            this.logger.warn(`High error rate detected for ${service}`, {
                errorRate: metrics.errorRate,
                threshold: this.config.performanceThreshold.errorRate,
                degradationLevel: circuit.degradationLevel
            });
        }

        // Check throughput threshold
        if (metrics.throughput < this.config.performanceThreshold.throughput) {
            circuit.degradationLevel = Math.min(5, circuit.degradationLevel + 1);
            this.logger.warn(`Low throughput detected for ${service}`, {
                throughput: metrics.throughput,
                threshold: this.config.performanceThreshold.throughput,
                degradationLevel: circuit.degradationLevel
            });
        }
    }

    /**
     * Check if service is critical
     */
    isCriticalService(service) {
        const criticalServices = ['ai-concierge', 'security-ai', 'flight-info-ai'];
        return criticalServices.includes(service);
    }

    /**
     * Trigger emergency protocols
     */
    async triggerEmergencyProtocols(service, error) {
        this.logger.error(`EMERGENCY: Critical service failure - ${service}`, {
            error: error.message,
            timestamp: new Date()
        });

        // Emit emergency event
        this.emit('emergencyProtocol', {
            service,
            error: error.message,
            severity: 'critical',
            timestamp: new Date()
        });

        // In real implementation:
        // - Send alerts to operations team
        // - Trigger automated failover
        // - Activate backup systems
        // - Notify stakeholders
    }

    /**
     * Get circuit status
     */
    getCircuitStatus(service) {
        const circuit = this.circuits.get(service);
        const metrics = this.metrics.get(service);

        if (!circuit || !metrics) {
            return null;
        }

        return {
            service: service,
            state: circuit.state,
            failureCount: circuit.failureCount,
            successCount: circuit.successCount,
            totalRequests: circuit.totalRequests,
            degradationLevel: circuit.degradationLevel,
            anomalyScore: circuit.anomalyScore,
            lastHealthCheck: circuit.lastHealthCheck,
            metrics: {
                averageResponseTime: metrics.averageResponseTime,
                errorRate: metrics.errorRate,
                throughput: metrics.throughput,
                availability: metrics.availability
            }
        };
    }

    /**
     * Get all circuit statuses
     */
    getAllCircuitStatuses() {
        const statuses = {};
        for (const service of this.circuits.keys()) {
            statuses[service] = this.getCircuitStatus(service);
        }
        return statuses;
    }

    /**
     * Get dashboard metrics
     */
    getDashboardMetrics() {
        const services = Array.from(this.circuits.keys());
        const openCircuits = services.filter(s => this.circuits.get(s).state === 'OPEN').length;
        const degradedServices = services.filter(s => this.circuits.get(s).degradationLevel > 2).length;
        
        const totalRequests = services.reduce((sum, s) => sum + this.circuits.get(s).totalRequests, 0);
        const totalErrors = services.reduce((sum, s) => sum + this.metrics.get(s).errorCount, 0);
        const overallErrorRate = totalRequests > 0 ? totalErrors / totalRequests : 0;
        
        const averageResponseTime = services.reduce((sum, s) => 
            sum + this.metrics.get(s).averageResponseTime, 0
        ) / services.length;

        const overallAvailability = services.reduce((sum, s) => 
            sum + this.metrics.get(s).availability, 0
        ) / services.length;

        return {
            totalServices: services.length,
            healthyServices: services.length - openCircuits - degradedServices,
            degradedServices: degradedServices,
            failedServices: openCircuits,
            overallErrorRate: overallErrorRate,
            averageResponseTime: averageResponseTime,
            overallAvailability: overallAvailability,
            totalRequests: totalRequests,
            lastUpdated: new Date()
        };
    }
}

/**
 * Anomaly Detection Engine
 */
class AnomalyDetector {
    constructor() {
        this.baselineWindow = 300000; // 5 minutes
        this.sensitivityThreshold = 2; // Standard deviations
    }

    async detectResponseTimeAnomaly(responseTimeHistory) {
        if (responseTimeHistory.length < 10) {
            return { score: 0, anomaly: false, reason: 'Insufficient data' };
        }

        const recentTimes = responseTimeHistory.slice(-10).map(h => h.responseTime);
        const historicalTimes = responseTimeHistory.slice(0, -10).map(h => h.responseTime);

        if (historicalTimes.length === 0) {
            return { score: 0, anomaly: false, reason: 'No historical data' };
        }

        const recentAvg = recentTimes.reduce((sum, t) => sum + t, 0) / recentTimes.length;
        const historicalAvg = historicalTimes.reduce((sum, t) => sum + t, 0) / historicalTimes.length;
        const historicalStdDev = this.calculateStandardDeviation(historicalTimes);

        const zScore = Math.abs(recentAvg - historicalAvg) / (historicalStdDev || 1);
        const anomalyScore = Math.min(1, zScore / this.sensitivityThreshold);

        return {
            score: anomalyScore,
            anomaly: anomalyScore > 0.7,
            reason: anomalyScore > 0.7 ? 'Response time significantly higher than baseline' : 'Normal',
            details: {
                recentAverage: recentAvg,
                historicalAverage: historicalAvg,
                zScore: zScore
            }
        };
    }

    async detectErrorRateAnomaly(errorHistory) {
        const recentWindow = 300000; // 5 minutes
        const cutoff = new Date(Date.now() - recentWindow);
        const recentErrors = errorHistory.filter(e => e.time > cutoff);
        
        const errorRate = recentErrors.length / 100; // Assuming 100 requests per 5 minutes baseline
        const anomalyScore = Math.min(1, errorRate / 0.05); // 5% error rate threshold

        return {
            score: anomalyScore,
            anomaly: anomalyScore > 0.7,
            reason: anomalyScore > 0.7 ? 'Error rate significantly higher than normal' : 'Normal',
            details: {
                recentErrors: recentErrors.length,
                errorRate: errorRate
            }
        };
    }

    async detectThroughputAnomaly(currentThroughput) {
        const expectedThroughput = 100; // Expected requests per minute
        const deviation = Math.abs(currentThroughput - expectedThroughput) / expectedThroughput;
        const anomalyScore = Math.min(1, deviation);

        return {
            score: anomalyScore,
            anomaly: anomalyScore > 0.5,
            reason: anomalyScore > 0.5 ? 'Throughput significantly different from expected' : 'Normal',
            details: {
                currentThroughput: currentThroughput,
                expectedThroughput: expectedThroughput,
                deviation: deviation
            }
        };
    }

    calculateStandardDeviation(values) {
        const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
        const squaredDiffs = values.map(val => Math.pow(val - avg, 2));
        const avgSquaredDiff = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
        return Math.sqrt(avgSquaredDiff);
    }
}

/**
 * Failsafe Manager
 */
class FailsafeManager {
    constructor() {
        this.failsafeMechanisms = new Map();
        this.initializeFailsafes();
    }

    initializeFailsafes() {
        // Define failsafe mechanisms for each service
        this.failsafeMechanisms.set('ai-concierge', {
            primary: 'rule_based_responses',
            secondary: 'static_information_display',
            emergency: 'human_handoff'
        });

        this.failsafeMechanisms.set('wayfinding-ai', {
            primary: 'static_map_display',
            secondary: 'basic_directions',
            emergency: 'staff_assistance'
        });

        // Add more failsafe mechanisms as needed
    }

    async activateFailsafe(service, level = 'primary') {
        const mechanisms = this.failsafeMechanisms.get(service);
        if (!mechanisms) {
            throw new Error(`No failsafe mechanisms defined for service: ${service}`);
        }

        const mechanism = mechanisms[level];
        if (!mechanism) {
            throw new Error(`Failsafe level '${level}' not available for service: ${service}`);
        }

        // Activate the failsafe mechanism
        return await this.executeFailsafeMechanism(service, mechanism);
    }

    async executeFailsafeMechanism(service, mechanism) {
        // Implementation would depend on the specific mechanism
        return {
            service: service,
            mechanism: mechanism,
            activated: true,
            timestamp: new Date()
        };
    }
}

module.exports = SafetyCircuitBreaker; 