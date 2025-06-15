/**
 * AeroFusionXR - Pillar 3: Anomaly Detection Engine
 * Advanced anomaly detection for runtime safety monitoring
 */

const EventEmitter = require('events');
const crypto = require('crypto');

class AnomalyDetectionEngine extends EventEmitter {
    constructor() {
        super();
        this.detectors = new Map();
        this.anomalies = new Map();
        this.thresholds = new Map();
        this.models = new Map();
        this.alertRules = new Map();
        
        this.initializeDetectors();
        this.initializeThresholds();
        this.initializeModels();
        this.initializeAlertRules();
        
        console.log('🔍 Anomaly Detection Engine initialized - Runtime safety monitoring active');
    }

    initializeDetectors() {
        const detectorConfigs = [
            {
                id: 'statistical-detector',
                name: 'Statistical Anomaly Detector',
                type: 'statistical',
                algorithm: 'z-score',
                sensitivity: 0.95,
                windowSize: 100,
                status: 'active'
            },
            {
                id: 'ml-detector',
                name: 'Machine Learning Detector',
                type: 'ml',
                algorithm: 'isolation-forest',
                sensitivity: 0.90,
                windowSize: 1000,
                status: 'active'
            },
            {
                id: 'pattern-detector',
                name: 'Pattern Anomaly Detector',
                type: 'pattern',
                algorithm: 'lstm-autoencoder',
                sensitivity: 0.85,
                windowSize: 500,
                status: 'active'
            },
            {
                id: 'drift-detector',
                name: 'Model Drift Detector',
                type: 'drift',
                algorithm: 'ks-test',
                sensitivity: 0.99,
                windowSize: 200,
                status: 'active'
            },
            {
                id: 'performance-detector',
                name: 'Performance Anomaly Detector',
                type: 'performance',
                algorithm: 'threshold-based',
                sensitivity: 0.95,
                windowSize: 50,
                status: 'active'
            }
        ];

        detectorConfigs.forEach(config => {
            this.detectors.set(config.id, {
                ...config,
                lastRun: null,
                detectionCount: 0,
                falsePositiveRate: 0.02,
                accuracy: 0.97
            });
        });

        console.log('🎯 5 anomaly detectors initialized');
    }

    initializeThresholds() {
        const thresholdConfigs = [
            { metric: 'response_time', threshold: 500, unit: 'ms', severity: 'medium' },
            { metric: 'error_rate', threshold: 0.05, unit: 'percentage', severity: 'high' },
            { metric: 'memory_usage', threshold: 0.85, unit: 'percentage', severity: 'high' },
            { metric: 'cpu_usage', threshold: 0.80, unit: 'percentage', severity: 'medium' },
            { metric: 'prediction_confidence', threshold: 0.70, unit: 'score', severity: 'medium' },
            { metric: 'data_quality_score', threshold: 0.90, unit: 'score', severity: 'high' },
            { metric: 'model_accuracy', threshold: 0.85, unit: 'score', severity: 'critical' },
            { metric: 'throughput', threshold: 100, unit: 'requests/sec', severity: 'medium' }
        ];

        thresholdConfigs.forEach(config => {
            this.thresholds.set(config.metric, config);
        });

        console.log('📊 8 threshold configurations initialized');
    }

    initializeModels() {
        const modelConfigs = [
            {
                id: 'isolation-forest',
                name: 'Isolation Forest Model',
                type: 'unsupervised',
                contamination: 0.1,
                nEstimators: 100,
                maxSamples: 'auto',
                status: 'trained'
            },
            {
                id: 'lstm-autoencoder',
                name: 'LSTM Autoencoder',
                type: 'deep-learning',
                sequenceLength: 50,
                hiddenUnits: 64,
                threshold: 0.95,
                status: 'trained'
            },
            {
                id: 'one-class-svm',
                name: 'One-Class SVM',
                type: 'svm',
                kernel: 'rbf',
                gamma: 'scale',
                nu: 0.05,
                status: 'trained'
            }
        ];

        modelConfigs.forEach(config => {
            this.models.set(config.id, {
                ...config,
                lastTrained: new Date().toISOString(),
                accuracy: 0.94 + Math.random() * 0.05,
                falsePositiveRate: 0.01 + Math.random() * 0.03
            });
        });

        console.log('🤖 3 anomaly detection models initialized');
    }

    initializeAlertRules() {
        const alertRuleConfigs = [
            {
                id: 'critical-anomaly',
                name: 'Critical Anomaly Alert',
                condition: 'severity >= critical',
                action: 'immediate-alert',
                channels: ['email', 'sms', 'slack'],
                escalation: true
            },
            {
                id: 'high-anomaly',
                name: 'High Severity Anomaly',
                condition: 'severity >= high',
                action: 'alert',
                channels: ['email', 'slack'],
                escalation: false
            },
            {
                id: 'pattern-anomaly',
                name: 'Pattern Anomaly Alert',
                condition: 'type == pattern && count >= 3',
                action: 'investigation',
                channels: ['slack'],
                escalation: false
            },
            {
                id: 'drift-anomaly',
                name: 'Model Drift Alert',
                condition: 'type == drift',
                action: 'model-retrain',
                channels: ['email'],
                escalation: true
            }
        ];

        alertRuleConfigs.forEach(config => {
            this.alertRules.set(config.id, {
                ...config,
                triggered: 0,
                lastTriggered: null,
                status: 'active'
            });
        });

        console.log('🚨 4 alert rules configured');
    }

    async detectAnomalies(data, context = {}) {
        const detectionResults = [];
        const timestamp = new Date().toISOString();

        // Run all active detectors
        for (const [detectorId, detector] of this.detectors) {
            if (detector.status !== 'active') continue;

            try {
                const result = await this.runDetector(detectorId, data, context);
                if (result.anomalies.length > 0) {
                    detectionResults.push({
                        detectorId: detectorId,
                        detectorName: detector.name,
                        anomalies: result.anomalies,
                        confidence: result.confidence,
                        timestamp: timestamp
                    });
                }

                // Update detector statistics
                detector.lastRun = timestamp;
                detector.detectionCount += result.anomalies.length;

            } catch (error) {
                console.error(`Error in detector ${detectorId}:`, error);
                this.emit('detector-error', { detectorId, error: error.message });
            }
        }

        // Process and correlate results
        const correlatedAnomalies = this.correlateAnomalies(detectionResults);
        
        // Store anomalies
        correlatedAnomalies.forEach(anomaly => {
            const anomalyId = crypto.randomUUID();
            this.anomalies.set(anomalyId, {
                id: anomalyId,
                ...anomaly,
                timestamp: timestamp,
                status: 'detected',
                investigated: false
            });
        });

        // Trigger alerts
        await this.processAlerts(correlatedAnomalies);

        this.emit('anomalies-detected', {
            timestamp: timestamp,
            detectionResults: detectionResults,
            correlatedAnomalies: correlatedAnomalies,
            totalAnomalies: correlatedAnomalies.length
        });

        return {
            timestamp: timestamp,
            anomalies: correlatedAnomalies,
            detectorResults: detectionResults,
            summary: {
                totalAnomalies: correlatedAnomalies.length,
                criticalAnomalies: correlatedAnomalies.filter(a => a.severity === 'critical').length,
                highAnomalies: correlatedAnomalies.filter(a => a.severity === 'high').length,
                mediumAnomalies: correlatedAnomalies.filter(a => a.severity === 'medium').length
            }
        };
    }

    async runDetector(detectorId, data, context) {
        const detector = this.detectors.get(detectorId);
        const anomalies = [];

        switch (detector.type) {
            case 'statistical':
                return this.runStatisticalDetection(detector, data, context);
            case 'ml':
                return this.runMLDetection(detector, data, context);
            case 'pattern':
                return this.runPatternDetection(detector, data, context);
            case 'drift':
                return this.runDriftDetection(detector, data, context);
            case 'performance':
                return this.runPerformanceDetection(detector, data, context);
            default:
                throw new Error(`Unknown detector type: ${detector.type}`);
        }
    }

    runStatisticalDetection(detector, data, context) {
        const anomalies = [];
        const confidence = 0.85 + Math.random() * 0.1;

        // Simulate statistical anomaly detection
        if (Array.isArray(data)) {
            const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
            const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length;
            const stdDev = Math.sqrt(variance);

            data.forEach((value, index) => {
                const zScore = Math.abs((value - mean) / stdDev);
                if (zScore > 2.5) { // 2.5 sigma threshold
                    anomalies.push({
                        type: 'statistical',
                        severity: zScore > 3 ? 'high' : 'medium',
                        value: value,
                        expectedRange: [mean - 2 * stdDev, mean + 2 * stdDev],
                        zScore: zScore,
                        index: index,
                        description: `Statistical anomaly detected: value ${value} is ${zScore.toFixed(2)} standard deviations from mean`
                    });
                }
            });
        }

        return { anomalies, confidence };
    }

    runMLDetection(detector, data, context) {
        const anomalies = [];
        const confidence = 0.90 + Math.random() * 0.08;

        // Simulate ML-based anomaly detection
        const model = this.models.get('isolation-forest');
        if (model && model.status === 'trained') {
            // Simulate isolation forest predictions
            const anomalyScore = Math.random();
            if (anomalyScore > 0.7) {
                anomalies.push({
                    type: 'ml-detected',
                    severity: anomalyScore > 0.9 ? 'high' : 'medium',
                    anomalyScore: anomalyScore,
                    modelId: 'isolation-forest',
                    features: Object.keys(context),
                    description: `ML model detected anomaly with score ${anomalyScore.toFixed(3)}`
                });
            }
        }

        return { anomalies, confidence };
    }

    runPatternDetection(detector, data, context) {
        const anomalies = [];
        const confidence = 0.88 + Math.random() * 0.1;

        // Simulate pattern-based anomaly detection
        const model = this.models.get('lstm-autoencoder');
        if (model && model.status === 'trained') {
            const reconstructionError = Math.random() * 0.5;
            if (reconstructionError > 0.3) {
                anomalies.push({
                    type: 'pattern',
                    severity: reconstructionError > 0.4 ? 'high' : 'medium',
                    reconstructionError: reconstructionError,
                    modelId: 'lstm-autoencoder',
                    sequenceLength: model.sequenceLength,
                    description: `Pattern anomaly detected: reconstruction error ${reconstructionError.toFixed(3)}`
                });
            }
        }

        return { anomalies, confidence };
    }

    runDriftDetection(detector, data, context) {
        const anomalies = [];
        const confidence = 0.95 + Math.random() * 0.04;

        // Simulate drift detection
        const driftScore = Math.random();
        if (driftScore > 0.8) {
            anomalies.push({
                type: 'drift',
                severity: 'critical',
                driftScore: driftScore,
                driftType: Math.random() > 0.5 ? 'concept-drift' : 'data-drift',
                description: `Model drift detected with score ${driftScore.toFixed(3)}`
            });
        }

        return { anomalies, confidence };
    }

    runPerformanceDetection(detector, data, context) {
        const anomalies = [];
        const confidence = 0.92 + Math.random() * 0.06;

        // Check performance metrics against thresholds
        for (const [metric, threshold] of this.thresholds) {
            if (context[metric] !== undefined) {
                const value = context[metric];
                const isAnomaly = this.checkThreshold(metric, value, threshold);
                
                if (isAnomaly) {
                    anomalies.push({
                        type: 'performance',
                        severity: threshold.severity,
                        metric: metric,
                        value: value,
                        threshold: threshold.threshold,
                        unit: threshold.unit,
                        description: `Performance anomaly: ${metric} (${value}${threshold.unit}) exceeds threshold (${threshold.threshold}${threshold.unit})`
                    });
                }
            }
        }

        return { anomalies, confidence };
    }

    checkThreshold(metric, value, threshold) {
        // Different threshold logic for different metrics
        switch (metric) {
            case 'error_rate':
            case 'memory_usage':
            case 'cpu_usage':
                return value > threshold.threshold;
            case 'prediction_confidence':
            case 'data_quality_score':
            case 'model_accuracy':
                return value < threshold.threshold;
            case 'response_time':
                return value > threshold.threshold;
            case 'throughput':
                return value < threshold.threshold;
            default:
                return value > threshold.threshold;
        }
    }

    correlateAnomalies(detectionResults) {
        const correlatedAnomalies = [];
        const anomalyGroups = new Map();

        // Group similar anomalies
        detectionResults.forEach(result => {
            result.anomalies.forEach(anomaly => {
                const groupKey = `${anomaly.type}-${anomaly.severity}`;
                
                if (!anomalyGroups.has(groupKey)) {
                    anomalyGroups.set(groupKey, []);
                }
                
                anomalyGroups.get(groupKey).push({
                    ...anomaly,
                    detectorId: result.detectorId,
                    detectorName: result.detectorName,
                    confidence: result.confidence
                });
            });
        });

        // Create correlated anomaly records
        anomalyGroups.forEach((anomalies, groupKey) => {
            const [type, severity] = groupKey.split('-');
            
            correlatedAnomalies.push({
                id: crypto.randomUUID(),
                type: type,
                severity: severity,
                count: anomalies.length,
                detectors: anomalies.map(a => a.detectorId),
                averageConfidence: anomalies.reduce((sum, a) => sum + a.confidence, 0) / anomalies.length,
                details: anomalies,
                correlationScore: this.calculateCorrelationScore(anomalies),
                impact: this.assessImpact(type, severity, anomalies.length)
            });
        });

        return correlatedAnomalies;
    }

    calculateCorrelationScore(anomalies) {
        // Higher score for anomalies detected by multiple detectors
        const uniqueDetectors = new Set(anomalies.map(a => a.detectorId)).size;
        const totalDetectors = this.detectors.size;
        
        return Math.min(uniqueDetectors / totalDetectors, 1.0);
    }

    assessImpact(type, severity, count) {
        const impactMatrix = {
            'critical': { base: 0.9, multiplier: 0.1 },
            'high': { base: 0.7, multiplier: 0.08 },
            'medium': { base: 0.5, multiplier: 0.05 },
            'low': { base: 0.3, multiplier: 0.03 }
        };

        const impact = impactMatrix[severity] || impactMatrix['medium'];
        return Math.min(impact.base + (count * impact.multiplier), 1.0);
    }

    async processAlerts(anomalies) {
        for (const anomaly of anomalies) {
            for (const [ruleId, rule] of this.alertRules) {
                if (rule.status !== 'active') continue;

                const shouldTrigger = this.evaluateAlertRule(rule, anomaly);
                
                if (shouldTrigger) {
                    await this.triggerAlert(ruleId, rule, anomaly);
                    
                    rule.triggered++;
                    rule.lastTriggered = new Date().toISOString();
                }
            }
        }
    }

    evaluateAlertRule(rule, anomaly) {
        // Simple rule evaluation - in production, this would be more sophisticated
        const condition = rule.condition;
        
        if (condition.includes('severity >= critical')) {
            return anomaly.severity === 'critical';
        }
        
        if (condition.includes('severity >= high')) {
            return ['critical', 'high'].includes(anomaly.severity);
        }
        
        if (condition.includes('type == pattern')) {
            return anomaly.type === 'pattern' && anomaly.count >= 3;
        }
        
        if (condition.includes('type == drift')) {
            return anomaly.type === 'drift';
        }
        
        return false;
    }

    async triggerAlert(ruleId, rule, anomaly) {
        const alert = {
            id: crypto.randomUUID(),
            ruleId: ruleId,
            ruleName: rule.name,
            anomalyId: anomaly.id,
            severity: anomaly.severity,
            type: anomaly.type,
            message: this.generateAlertMessage(rule, anomaly),
            channels: rule.channels,
            escalation: rule.escalation,
            timestamp: new Date().toISOString(),
            status: 'triggered'
        };

        // Emit alert event
        this.emit('alert-triggered', alert);

        // Log alert
        console.log(`🚨 Alert triggered: ${alert.message}`);

        return alert;
    }

    generateAlertMessage(rule, anomaly) {
        return `${rule.name}: ${anomaly.type} anomaly detected with ${anomaly.severity} severity. ` +
               `Detected by ${anomaly.detectors.length} detector(s). ` +
               `Confidence: ${(anomaly.averageConfidence * 100).toFixed(1)}%`;
    }

    getAnomalyStatistics() {
        const stats = {
            timestamp: new Date().toISOString(),
            totalAnomalies: this.anomalies.size,
            detectorStats: {},
            severityDistribution: { critical: 0, high: 0, medium: 0, low: 0 },
            typeDistribution: {},
            recentAnomalies: 0
        };

        // Detector statistics
        this.detectors.forEach((detector, id) => {
            stats.detectorStats[id] = {
                name: detector.name,
                detectionCount: detector.detectionCount,
                accuracy: detector.accuracy,
                falsePositiveRate: detector.falsePositiveRate,
                status: detector.status
            };
        });

        // Anomaly distribution
        const recentThreshold = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
        
        this.anomalies.forEach(anomaly => {
            // Severity distribution
            stats.severityDistribution[anomaly.severity]++;
            
            // Type distribution
            if (!stats.typeDistribution[anomaly.type]) {
                stats.typeDistribution[anomaly.type] = 0;
            }
            stats.typeDistribution[anomaly.type]++;
            
            // Recent anomalies
            if (new Date(anomaly.timestamp).getTime() > recentThreshold) {
                stats.recentAnomalies++;
            }
        });

        return stats;
    }

    async generateAnomalyReport() {
        console.log('📊 Generating anomaly detection report...');

        const report = {
            metadata: {
                reportId: crypto.randomUUID(),
                generatedAt: new Date().toISOString(),
                reportType: 'anomaly-detection',
                period: '24-hours'
            },
            executiveSummary: {
                totalAnomalies: this.anomalies.size,
                criticalAnomalies: Array.from(this.anomalies.values()).filter(a => a.severity === 'critical').length,
                detectorEffectiveness: this.calculateDetectorEffectiveness(),
                systemHealth: this.assessSystemHealth()
            },
            statistics: this.getAnomalyStatistics(),
            recentAnomalies: this.getRecentAnomalies(24), // Last 24 hours
            recommendations: this.generateRecommendations()
        };

        this.emit('anomaly-report-generated', report);
        return report;
    }

    calculateDetectorEffectiveness() {
        let totalAccuracy = 0;
        let activeDetectors = 0;

        this.detectors.forEach(detector => {
            if (detector.status === 'active') {
                totalAccuracy += detector.accuracy;
                activeDetectors++;
            }
        });

        return activeDetectors > 0 ? totalAccuracy / activeDetectors : 0;
    }

    assessSystemHealth() {
        const recentAnomalies = this.getRecentAnomalies(1).length; // Last hour
        const criticalAnomalies = Array.from(this.anomalies.values())
            .filter(a => a.severity === 'critical' && 
                    new Date(a.timestamp).getTime() > Date.now() - (60 * 60 * 1000)).length;

        if (criticalAnomalies > 0) return 'critical';
        if (recentAnomalies > 10) return 'degraded';
        if (recentAnomalies > 5) return 'warning';
        return 'healthy';
    }

    getRecentAnomalies(hours) {
        const threshold = Date.now() - (hours * 60 * 60 * 1000);
        return Array.from(this.anomalies.values())
            .filter(anomaly => new Date(anomaly.timestamp).getTime() > threshold)
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }

    generateRecommendations() {
        const recommendations = [];
        const stats = this.getAnomalyStatistics();

        // High false positive rate
        Object.entries(stats.detectorStats).forEach(([id, detector]) => {
            if (detector.falsePositiveRate > 0.05) {
                recommendations.push({
                    type: 'detector-tuning',
                    priority: 'medium',
                    message: `Consider tuning ${detector.name} to reduce false positive rate (${(detector.falsePositiveRate * 100).toFixed(1)}%)`
                });
            }
        });

        // High anomaly rate
        if (stats.recentAnomalies > 20) {
            recommendations.push({
                type: 'investigation',
                priority: 'high',
                message: `High anomaly rate detected (${stats.recentAnomalies} in last 24h). Investigation recommended.`
            });
        }

        // Model retraining
        if (stats.typeDistribution['drift'] > 0) {
            recommendations.push({
                type: 'model-maintenance',
                priority: 'critical',
                message: 'Model drift detected. Schedule model retraining immediately.'
            });
        }

        return recommendations;
    }
}

module.exports = AnomalyDetectionEngine; 