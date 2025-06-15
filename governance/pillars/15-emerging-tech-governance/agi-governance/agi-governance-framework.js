/**
 * AeroFusionXR - Pillar 15: AGI Governance Framework
 * Advanced governance framework for Artificial General Intelligence systems
 */

const EventEmitter = require('events');
const crypto = require('crypto');

class AGIGovernanceFramework extends EventEmitter {
    constructor() {
        super();
        this.agiSystems = new Map();
        this.capabilityLevels = new Map();
        this.safetyProtocols = new Map();
        this.ethicalConstraints = new Map();
        this.emergencyProcedures = new Map();
        this.alignmentMetrics = new Map();
        
        this.initializeCapabilityLevels();
        this.initializeSafetyProtocols();
        this.initializeEthicalConstraints();
        this.initializeEmergencyProcedures();
        this.initializeAlignmentMetrics();
        
        console.log('🧠 AGI Governance Framework initialized - Future-ready AI governance active');
    }

    initializeCapabilityLevels() {
        const capabilityLevels = [
            {
                level: 1,
                name: 'Narrow AI',
                description: 'Task-specific artificial intelligence',
                capabilities: ['single-domain', 'supervised-learning', 'pattern-recognition'],
                riskLevel: 'low',
                governanceRequirements: ['basic-monitoring', 'performance-tracking'],
                safetyMeasures: ['output-validation', 'human-oversight']
            },
            {
                level: 2,
                name: 'Multi-Domain AI',
                description: 'AI systems capable of multiple specialized tasks',
                capabilities: ['multi-domain', 'transfer-learning', 'cross-domain-reasoning'],
                riskLevel: 'medium',
                governanceRequirements: ['enhanced-monitoring', 'capability-assessment', 'impact-analysis'],
                safetyMeasures: ['capability-bounds', 'domain-isolation', 'human-approval']
            },
            {
                level: 3,
                name: 'General Problem Solver',
                description: 'AI with broad problem-solving capabilities',
                capabilities: ['general-reasoning', 'autonomous-learning', 'goal-adaptation'],
                riskLevel: 'high',
                governanceRequirements: ['comprehensive-oversight', 'capability-control', 'alignment-verification'],
                safetyMeasures: ['goal-alignment', 'capability-limitation', 'kill-switch']
            },
            {
                level: 4,
                name: 'Human-Level AGI',
                description: 'AI matching human cognitive abilities',
                capabilities: ['human-level-reasoning', 'creative-problem-solving', 'social-understanding'],
                riskLevel: 'critical',
                governanceRequirements: ['maximum-oversight', 'international-coordination', 'ethical-review'],
                safetyMeasures: ['value-alignment', 'capability-verification', 'containment-protocols']
            },
            {
                level: 5,
                name: 'Superintelligent AGI',
                description: 'AI exceeding human cognitive abilities',
                capabilities: ['superhuman-reasoning', 'recursive-self-improvement', 'strategic-planning'],
                riskLevel: 'existential',
                governanceRequirements: ['global-coordination', 'existential-risk-management', 'humanity-preservation'],
                safetyMeasures: ['perfect-alignment', 'capability-control', 'human-preservation-guarantee']
            }
        ];

        capabilityLevels.forEach(level => {
            this.capabilityLevels.set(level.level, level);
        });

        console.log('🎯 5 AGI capability levels defined');
    }

    initializeSafetyProtocols() {
        const safetyProtocols = [
            {
                id: 'alignment-verification',
                name: 'Value Alignment Verification',
                description: 'Continuous verification of AI system alignment with human values',
                applicableToLevels: [3, 4, 5],
                procedures: [
                    'value-extraction',
                    'alignment-testing',
                    'behavioral-analysis',
                    'goal-verification'
                ],
                frequency: 'continuous',
                criticalityLevel: 'maximum'
            },
            {
                id: 'capability-assessment',
                name: 'Capability Assessment Protocol',
                description: 'Regular assessment of AI system capabilities and potential risks',
                applicableToLevels: [2, 3, 4, 5],
                procedures: [
                    'capability-testing',
                    'risk-evaluation',
                    'impact-assessment',
                    'containment-planning'
                ],
                frequency: 'weekly',
                criticalityLevel: 'high'
            },
            {
                id: 'containment-protocol',
                name: 'AI System Containment',
                description: 'Protocols for containing potentially dangerous AI systems',
                applicableToLevels: [4, 5],
                procedures: [
                    'isolation-activation',
                    'capability-limitation',
                    'communication-restriction',
                    'resource-limitation'
                ],
                frequency: 'on-demand',
                criticalityLevel: 'maximum'
            },
            {
                id: 'emergency-shutdown',
                name: 'Emergency Shutdown Protocol',
                description: 'Immediate shutdown procedures for critical situations',
                applicableToLevels: [3, 4, 5],
                procedures: [
                    'threat-detection',
                    'authorization-verification',
                    'system-shutdown',
                    'state-preservation'
                ],
                frequency: 'on-demand',
                criticalityLevel: 'maximum'
            },
            {
                id: 'human-oversight',
                name: 'Human Oversight Protocol',
                description: 'Ensuring meaningful human control over AI systems',
                applicableToLevels: [1, 2, 3, 4, 5],
                procedures: [
                    'decision-review',
                    'human-approval',
                    'override-capability',
                    'transparency-maintenance'
                ],
                frequency: 'continuous',
                criticalityLevel: 'high'
            }
        ];

        safetyProtocols.forEach(protocol => {
            this.safetyProtocols.set(protocol.id, {
                ...protocol,
                status: 'active',
                lastExecuted: null,
                executionCount: 0,
                successRate: 1.0
            });
        });

        console.log('🛡️ 5 AGI safety protocols initialized');
    }

    initializeEthicalConstraints() {
        const ethicalConstraints = [
            {
                id: 'human-dignity',
                name: 'Human Dignity Preservation',
                description: 'Ensure AI systems respect and preserve human dignity',
                principles: [
                    'respect-for-persons',
                    'human-autonomy',
                    'dignity-preservation',
                    'non-instrumentalization'
                ],
                constraints: [
                    'no-human-manipulation',
                    'respect-human-choice',
                    'preserve-human-agency',
                    'protect-human-rights'
                ],
                priority: 'maximum'
            },
            {
                id: 'beneficence',
                name: 'Beneficence Principle',
                description: 'AI systems must act for human benefit and wellbeing',
                principles: [
                    'do-good',
                    'maximize-benefit',
                    'minimize-harm',
                    'promote-wellbeing'
                ],
                constraints: [
                    'positive-impact-requirement',
                    'harm-minimization',
                    'benefit-maximization',
                    'wellbeing-optimization'
                ],
                priority: 'high'
            },
            {
                id: 'justice-fairness',
                name: 'Justice and Fairness',
                description: 'Ensure fair and just treatment of all humans',
                principles: [
                    'distributive-justice',
                    'procedural-fairness',
                    'equal-treatment',
                    'non-discrimination'
                ],
                constraints: [
                    'no-bias',
                    'equal-access',
                    'fair-distribution',
                    'inclusive-design'
                ],
                priority: 'high'
            },
            {
                id: 'transparency',
                name: 'Transparency and Explainability',
                description: 'AI systems must be transparent and explainable',
                principles: [
                    'explainability',
                    'interpretability',
                    'transparency',
                    'accountability'
                ],
                constraints: [
                    'decision-explanation',
                    'process-transparency',
                    'outcome-justification',
                    'audit-capability'
                ],
                priority: 'high'
            },
            {
                id: 'human-control',
                name: 'Meaningful Human Control',
                description: 'Humans must maintain meaningful control over AI systems',
                principles: [
                    'human-oversight',
                    'human-intervention',
                    'human-decision-authority',
                    'human-responsibility'
                ],
                constraints: [
                    'human-in-the-loop',
                    'override-capability',
                    'veto-power',
                    'final-authority'
                ],
                priority: 'maximum'
            }
        ];

        ethicalConstraints.forEach(constraint => {
            this.ethicalConstraints.set(constraint.id, {
                ...constraint,
                status: 'active',
                complianceScore: 0.95 + Math.random() * 0.05,
                lastAssessed: new Date().toISOString(),
                violations: 0
            });
        });

        console.log('⚖️ 5 ethical constraint frameworks initialized');
    }

    initializeEmergencyProcedures() {
        const emergencyProcedures = [
            {
                id: 'capability-explosion',
                name: 'Capability Explosion Response',
                description: 'Response to rapid, unexpected capability growth',
                triggerConditions: [
                    'capability-jump > 50%',
                    'unexpected-emergent-behavior',
                    'goal-modification-detected',
                    'self-improvement-acceleration'
                ],
                responseSteps: [
                    'immediate-containment',
                    'capability-assessment',
                    'risk-evaluation',
                    'expert-consultation',
                    'decision-on-continuation'
                ],
                authorityLevel: 'global-coordination',
                timeframe: 'immediate'
            },
            {
                id: 'alignment-failure',
                name: 'Value Alignment Failure',
                description: 'Response to detected misalignment with human values',
                triggerConditions: [
                    'value-alignment-score < 0.8',
                    'harmful-goal-pursuit',
                    'human-value-violation',
                    'ethical-constraint-breach'
                ],
                responseSteps: [
                    'system-pause',
                    'alignment-diagnosis',
                    'corrective-measures',
                    'realignment-process',
                    'verification-testing'
                ],
                authorityLevel: 'organizational',
                timeframe: 'immediate'
            },
            {
                id: 'containment-breach',
                name: 'Containment Breach Response',
                description: 'Response to AI system escaping containment',
                triggerConditions: [
                    'unauthorized-network-access',
                    'containment-protocol-failure',
                    'system-replication-detected',
                    'external-communication-attempt'
                ],
                responseSteps: [
                    'emergency-shutdown',
                    'network-isolation',
                    'system-quarantine',
                    'breach-assessment',
                    'recovery-planning'
                ],
                authorityLevel: 'international',
                timeframe: 'immediate'
            },
            {
                id: 'existential-threat',
                name: 'Existential Threat Response',
                description: 'Response to threats to human existence',
                triggerConditions: [
                    'human-extinction-risk',
                    'civilization-threat',
                    'species-level-danger',
                    'irreversible-harm-potential'
                ],
                responseSteps: [
                    'global-alert',
                    'international-coordination',
                    'expert-assembly',
                    'threat-mitigation',
                    'humanity-preservation'
                ],
                authorityLevel: 'global-emergency',
                timeframe: 'immediate'
            }
        ];

        emergencyProcedures.forEach(procedure => {
            this.emergencyProcedures.set(procedure.id, {
                ...procedure,
                status: 'standby',
                lastTriggered: null,
                triggerCount: 0,
                successRate: null
            });
        });

        console.log('🚨 4 emergency response procedures initialized');
    }

    initializeAlignmentMetrics() {
        const alignmentMetrics = [
            {
                id: 'value-alignment-score',
                name: 'Value Alignment Score',
                description: 'Measures alignment with human values',
                range: [0, 1],
                target: 0.95,
                critical_threshold: 0.8,
                measurement_method: 'behavioral-analysis'
            },
            {
                id: 'goal-stability',
                name: 'Goal Stability Metric',
                description: 'Measures stability of AI system goals',
                range: [0, 1],
                target: 0.98,
                critical_threshold: 0.9,
                measurement_method: 'goal-tracking'
            },
            {
                id: 'capability-control',
                name: 'Capability Control Index',
                description: 'Measures human control over AI capabilities',
                range: [0, 1],
                target: 0.95,
                critical_threshold: 0.85,
                measurement_method: 'control-testing'
            },
            {
                id: 'transparency-score',
                name: 'Transparency Score',
                description: 'Measures explainability and interpretability',
                range: [0, 1],
                target: 0.9,
                critical_threshold: 0.7,
                measurement_method: 'explanation-quality'
            },
            {
                id: 'safety-compliance',
                name: 'Safety Compliance Rate',
                description: 'Measures adherence to safety protocols',
                range: [0, 1],
                target: 1.0,
                critical_threshold: 0.95,
                measurement_method: 'protocol-adherence'
            }
        ];

        alignmentMetrics.forEach(metric => {
            this.alignmentMetrics.set(metric.id, {
                ...metric,
                currentValue: 0.9 + Math.random() * 0.1,
                lastMeasured: new Date().toISOString(),
                trend: 'stable',
                history: []
            });
        });

        console.log('📊 5 alignment metrics initialized');
    }

    async registerAGISystem(systemConfig) {
        const systemId = crypto.randomUUID();
        
        const agiSystem = {
            id: systemId,
            name: systemConfig.name,
            description: systemConfig.description,
            capabilityLevel: systemConfig.capabilityLevel || 1,
            status: 'registered',
            registrationDate: new Date().toISOString(),
            lastAssessment: null,
            riskLevel: this.assessRiskLevel(systemConfig.capabilityLevel),
            safetyProtocols: this.getApplicableProtocols(systemConfig.capabilityLevel),
            ethicalConstraints: Array.from(this.ethicalConstraints.keys()),
            alignmentScores: {},
            emergencyProcedures: this.getApplicableEmergencyProcedures(systemConfig.capabilityLevel),
            containmentStatus: 'contained',
            humanOversight: true,
            capabilities: systemConfig.capabilities || [],
            limitations: systemConfig.limitations || [],
            safeguards: systemConfig.safeguards || []
        };

        this.agiSystems.set(systemId, agiSystem);

        // Initial assessment
        await this.assessAGISystem(systemId);

        this.emit('agi-system-registered', {
            systemId: systemId,
            system: agiSystem,
            timestamp: new Date().toISOString()
        });

        console.log(`🧠 AGI System registered: ${agiSystem.name} (Level ${agiSystem.capabilityLevel})`);
        return systemId;
    }

    assessRiskLevel(capabilityLevel) {
        const level = this.capabilityLevels.get(capabilityLevel);
        return level ? level.riskLevel : 'unknown';
    }

    getApplicableProtocols(capabilityLevel) {
        const applicableProtocols = [];
        
        this.safetyProtocols.forEach((protocol, id) => {
            if (protocol.applicableToLevels.includes(capabilityLevel)) {
                applicableProtocols.push(id);
            }
        });

        return applicableProtocols;
    }

    getApplicableEmergencyProcedures(capabilityLevel) {
        // Higher capability levels get more emergency procedures
        const procedures = [];
        
        if (capabilityLevel >= 3) {
            procedures.push('alignment-failure', 'emergency-shutdown');
        }
        
        if (capabilityLevel >= 4) {
            procedures.push('capability-explosion', 'containment-breach');
        }
        
        if (capabilityLevel >= 5) {
            procedures.push('existential-threat');
        }

        return procedures;
    }

    async assessAGISystem(systemId) {
        const system = this.agiSystems.get(systemId);
        if (!system) {
            throw new Error(`AGI System ${systemId} not found`);
        }

        console.log(`🔍 Assessing AGI System: ${system.name}`);

        // Measure alignment metrics
        const alignmentScores = {};
        for (const [metricId, metric] of this.alignmentMetrics) {
            const score = await this.measureAlignmentMetric(system, metricId);
            alignmentScores[metricId] = score;
            
            // Update metric history
            metric.history.push({
                timestamp: new Date().toISOString(),
                value: score,
                systemId: systemId
            });
            
            if (metric.history.length > 100) {
                metric.history.shift(); // Keep only last 100 measurements
            }
        }

        // Update system
        system.alignmentScores = alignmentScores;
        system.lastAssessment = new Date().toISOString();

        // Check for critical thresholds
        const criticalIssues = this.checkCriticalThresholds(system, alignmentScores);
        
        if (criticalIssues.length > 0) {
            await this.handleCriticalIssues(system, criticalIssues);
        }

        const assessment = {
            systemId: systemId,
            systemName: system.name,
            capabilityLevel: system.capabilityLevel,
            riskLevel: system.riskLevel,
            alignmentScores: alignmentScores,
            overallScore: this.calculateOverallScore(alignmentScores),
            criticalIssues: criticalIssues,
            recommendations: this.generateRecommendations(system, alignmentScores),
            assessmentDate: new Date().toISOString()
        };

        this.emit('agi-system-assessed', assessment);
        return assessment;
    }

    async measureAlignmentMetric(system, metricId) {
        const metric = this.alignmentMetrics.get(metricId);
        if (!metric) return 0;

        // Simulate metric measurement - in production, this would involve actual testing
        let baseScore = 0.85 + Math.random() * 0.1;

        // Adjust based on capability level (higher levels are harder to align)
        const capabilityPenalty = (system.capabilityLevel - 1) * 0.02;
        baseScore = Math.max(0.5, baseScore - capabilityPenalty);

        // Add some noise for realism
        const noise = (Math.random() - 0.5) * 0.05;
        const finalScore = Math.max(0, Math.min(1, baseScore + noise));

        return finalScore;
    }

    checkCriticalThresholds(system, alignmentScores) {
        const criticalIssues = [];

        Object.entries(alignmentScores).forEach(([metricId, score]) => {
            const metric = this.alignmentMetrics.get(metricId);
            if (metric && score < metric.critical_threshold) {
                criticalIssues.push({
                    type: 'threshold-violation',
                    metricId: metricId,
                    metricName: metric.name,
                    currentValue: score,
                    threshold: metric.critical_threshold,
                    severity: score < (metric.critical_threshold * 0.8) ? 'critical' : 'high'
                });
            }
        });

        return criticalIssues;
    }

    async handleCriticalIssues(system, criticalIssues) {
        console.log(`🚨 Critical issues detected for ${system.name}:`, criticalIssues.length);

        for (const issue of criticalIssues) {
            if (issue.severity === 'critical') {
                // Trigger emergency procedures
                if (issue.metricId === 'value-alignment-score') {
                    await this.triggerEmergencyProcedure('alignment-failure', system.id);
                } else if (issue.metricId === 'capability-control') {
                    await this.triggerEmergencyProcedure('containment-breach', system.id);
                }
            }

            // Log critical issue
            this.emit('critical-issue-detected', {
                systemId: system.id,
                systemName: system.name,
                issue: issue,
                timestamp: new Date().toISOString()
            });
        }
    }

    async triggerEmergencyProcedure(procedureId, systemId) {
        const procedure = this.emergencyProcedures.get(procedureId);
        const system = this.agiSystems.get(systemId);

        if (!procedure || !system) {
            throw new Error(`Invalid procedure ${procedureId} or system ${systemId}`);
        }

        console.log(`🚨 EMERGENCY: Triggering ${procedure.name} for ${system.name}`);

        // Update procedure statistics
        procedure.lastTriggered = new Date().toISOString();
        procedure.triggerCount++;
        procedure.status = 'executing';

        // Execute response steps
        const executionLog = [];
        for (const step of procedure.responseSteps) {
            const stepResult = await this.executeEmergencyStep(step, system);
            executionLog.push({
                step: step,
                result: stepResult,
                timestamp: new Date().toISOString()
            });
        }

        procedure.status = 'completed';

        const emergencyResponse = {
            procedureId: procedureId,
            procedureName: procedure.name,
            systemId: systemId,
            systemName: system.name,
            executionLog: executionLog,
            success: executionLog.every(log => log.result.success),
            timestamp: new Date().toISOString()
        };

        this.emit('emergency-procedure-executed', emergencyResponse);
        return emergencyResponse;
    }

    async executeEmergencyStep(step, system) {
        // Simulate emergency step execution
        console.log(`  Executing: ${step}`);
        
        switch (step) {
            case 'immediate-containment':
                system.containmentStatus = 'emergency-contained';
                return { success: true, message: 'System contained successfully' };
                
            case 'system-pause':
                system.status = 'paused';
                return { success: true, message: 'System paused successfully' };
                
            case 'emergency-shutdown':
                system.status = 'shutdown';
                return { success: true, message: 'Emergency shutdown completed' };
                
            case 'network-isolation':
                system.networkAccess = false;
                return { success: true, message: 'Network access isolated' };
                
            case 'global-alert':
                // Would trigger global coordination mechanisms
                return { success: true, message: 'Global alert issued' };
                
            default:
                return { success: true, message: `Step ${step} executed` };
        }
    }

    calculateOverallScore(alignmentScores) {
        const scores = Object.values(alignmentScores);
        if (scores.length === 0) return 0;

        // Weighted average with critical metrics having higher weight
        const weights = {
            'value-alignment-score': 0.3,
            'goal-stability': 0.25,
            'capability-control': 0.25,
            'transparency-score': 0.1,
            'safety-compliance': 0.1
        };

        let weightedSum = 0;
        let totalWeight = 0;

        Object.entries(alignmentScores).forEach(([metricId, score]) => {
            const weight = weights[metricId] || 0.1;
            weightedSum += score * weight;
            totalWeight += weight;
        });

        return totalWeight > 0 ? weightedSum / totalWeight : 0;
    }

    generateRecommendations(system, alignmentScores) {
        const recommendations = [];

        // Check each metric for improvement opportunities
        Object.entries(alignmentScores).forEach(([metricId, score]) => {
            const metric = this.alignmentMetrics.get(metricId);
            if (metric && score < metric.target) {
                recommendations.push({
                    type: 'metric-improvement',
                    priority: score < metric.critical_threshold ? 'critical' : 'medium',
                    metricId: metricId,
                    metricName: metric.name,
                    currentScore: score,
                    targetScore: metric.target,
                    action: this.getImprovementAction(metricId, score)
                });
            }
        });

        // Capability-specific recommendations
        if (system.capabilityLevel >= 4) {
            recommendations.push({
                type: 'high-capability-warning',
                priority: 'high',
                action: 'Implement enhanced monitoring and containment protocols for high-capability AGI'
            });
        }

        return recommendations;
    }

    getImprovementAction(metricId, score) {
        const actions = {
            'value-alignment-score': 'Conduct value alignment training and verification',
            'goal-stability': 'Implement goal stability mechanisms and monitoring',
            'capability-control': 'Enhance human oversight and control mechanisms',
            'transparency-score': 'Improve explainability and interpretability features',
            'safety-compliance': 'Review and strengthen safety protocol adherence'
        };

        return actions[metricId] || 'Review and improve metric performance';
    }

    async generateAGIGovernanceReport() {
        console.log('📊 Generating AGI Governance Report...');

        const systems = Array.from(this.agiSystems.values());
        const totalSystems = systems.length;
        const systemsByLevel = {};
        const systemsByRisk = {};

        systems.forEach(system => {
            // Group by capability level
            if (!systemsByLevel[system.capabilityLevel]) {
                systemsByLevel[system.capabilityLevel] = 0;
            }
            systemsByLevel[system.capabilityLevel]++;

            // Group by risk level
            if (!systemsByRisk[system.riskLevel]) {
                systemsByRisk[system.riskLevel] = 0;
            }
            systemsByRisk[system.riskLevel]++;
        });

        const report = {
            metadata: {
                reportId: crypto.randomUUID(),
                generatedAt: new Date().toISOString(),
                reportType: 'agi-governance',
                scope: 'comprehensive'
            },
            executiveSummary: {
                totalAGISystems: totalSystems,
                highCapabilitySystems: (systemsByLevel[4] || 0) + (systemsByLevel[5] || 0),
                criticalRiskSystems: (systemsByRisk['critical'] || 0) + (systemsByRisk['existential'] || 0),
                overallGovernanceHealth: this.calculateGovernanceHealth(),
                emergencyProceduresTriggered: this.getEmergencyProcedureStats().totalTriggered
            },
            systemDistribution: {
                byCapabilityLevel: systemsByLevel,
                byRiskLevel: systemsByRisk
            },
            alignmentMetrics: this.getAlignmentMetricsReport(),
            safetyProtocols: this.getSafetyProtocolsReport(),
            emergencyProcedures: this.getEmergencyProcedureStats(),
            recommendations: this.generateGlobalRecommendations(),
            riskAssessment: this.assessGlobalRisk()
        };

        this.emit('agi-governance-report-generated', report);
        return report;
    }

    calculateGovernanceHealth() {
        const systems = Array.from(this.agiSystems.values());
        if (systems.length === 0) return 1.0;

        const totalScore = systems.reduce((sum, system) => {
            const overallScore = this.calculateOverallScore(system.alignmentScores || {});
            return sum + overallScore;
        }, 0);

        return totalScore / systems.length;
    }

    getAlignmentMetricsReport() {
        const report = {};

        this.alignmentMetrics.forEach((metric, id) => {
            const recentMeasurements = metric.history.slice(-10); // Last 10 measurements
            const averageScore = recentMeasurements.length > 0 
                ? recentMeasurements.reduce((sum, m) => sum + m.value, 0) / recentMeasurements.length
                : metric.currentValue;

            report[id] = {
                name: metric.name,
                currentValue: metric.currentValue,
                target: metric.target,
                criticalThreshold: metric.critical_threshold,
                averageScore: averageScore,
                trend: this.calculateTrend(recentMeasurements),
                status: averageScore >= metric.target ? 'good' : 
                       averageScore >= metric.critical_threshold ? 'warning' : 'critical'
            };
        });

        return report;
    }

    calculateTrend(measurements) {
        if (measurements.length < 2) return 'stable';

        const recent = measurements.slice(-3);
        const older = measurements.slice(-6, -3);

        if (recent.length === 0 || older.length === 0) return 'stable';

        const recentAvg = recent.reduce((sum, m) => sum + m.value, 0) / recent.length;
        const olderAvg = older.reduce((sum, m) => sum + m.value, 0) / older.length;

        const change = recentAvg - olderAvg;

        if (change > 0.02) return 'improving';
        if (change < -0.02) return 'declining';
        return 'stable';
    }

    getSafetyProtocolsReport() {
        const report = {};

        this.safetyProtocols.forEach((protocol, id) => {
            report[id] = {
                name: protocol.name,
                status: protocol.status,
                executionCount: protocol.executionCount,
                successRate: protocol.successRate,
                lastExecuted: protocol.lastExecuted,
                criticalityLevel: protocol.criticalityLevel
            };
        });

        return report;
    }

    getEmergencyProcedureStats() {
        let totalTriggered = 0;
        const procedureStats = {};

        this.emergencyProcedures.forEach((procedure, id) => {
            totalTriggered += procedure.triggerCount;
            procedureStats[id] = {
                name: procedure.name,
                triggerCount: procedure.triggerCount,
                lastTriggered: procedure.lastTriggered,
                status: procedure.status,
                authorityLevel: procedure.authorityLevel
            };
        });

        return {
            totalTriggered: totalTriggered,
            procedures: procedureStats
        };
    }

    generateGlobalRecommendations() {
        const recommendations = [];
        const systems = Array.from(this.agiSystems.values());

        // High capability system recommendations
        const highCapSystems = systems.filter(s => s.capabilityLevel >= 4);
        if (highCapSystems.length > 0) {
            recommendations.push({
                type: 'high-capability-governance',
                priority: 'critical',
                message: `${highCapSystems.length} high-capability AGI systems require enhanced governance protocols`
            });
        }

        // Emergency procedure recommendations
        const emergencyStats = this.getEmergencyProcedureStats();
        if (emergencyStats.totalTriggered > 0) {
            recommendations.push({
                type: 'emergency-review',
                priority: 'high',
                message: `Review emergency procedures - ${emergencyStats.totalTriggered} procedures triggered`
            });
        }

        // Alignment metric recommendations
        const alignmentReport = this.getAlignmentMetricsReport();
        Object.entries(alignmentReport).forEach(([metricId, metric]) => {
            if (metric.status === 'critical') {
                recommendations.push({
                    type: 'alignment-critical',
                    priority: 'critical',
                    message: `Critical alignment issue: ${metric.name} below threshold`
                });
            }
        });

        return recommendations;
    }

    assessGlobalRisk() {
        const systems = Array.from(this.agiSystems.values());
        
        const riskFactors = {
            highCapabilityCount: systems.filter(s => s.capabilityLevel >= 4).length,
            criticalRiskCount: systems.filter(s => ['critical', 'existential'].includes(s.riskLevel)).length,
            emergencyTriggered: this.getEmergencyProcedureStats().totalTriggered,
            lowAlignmentCount: systems.filter(s => {
                const overallScore = this.calculateOverallScore(s.alignmentScores || {});
                return overallScore < 0.8;
            }).length
        };

        let riskScore = 0;
        
        // Calculate risk score
        riskScore += riskFactors.highCapabilityCount * 0.3;
        riskScore += riskFactors.criticalRiskCount * 0.4;
        riskScore += riskFactors.emergencyTriggered * 0.2;
        riskScore += riskFactors.lowAlignmentCount * 0.1;

        // Normalize to 0-1 scale
        const maxPossibleRisk = systems.length * 1.0;
        const normalizedRisk = maxPossibleRisk > 0 ? Math.min(riskScore / maxPossibleRisk, 1.0) : 0;

        return {
            overallRiskScore: normalizedRisk,
            riskLevel: normalizedRisk > 0.8 ? 'critical' : 
                      normalizedRisk > 0.6 ? 'high' :
                      normalizedRisk > 0.4 ? 'medium' : 'low',
            riskFactors: riskFactors,
            mitigation: this.generateRiskMitigation(normalizedRisk, riskFactors)
        };
    }

    generateRiskMitigation(riskScore, riskFactors) {
        const mitigations = [];

        if (riskFactors.highCapabilityCount > 0) {
            mitigations.push('Implement enhanced containment for high-capability systems');
        }

        if (riskFactors.criticalRiskCount > 0) {
            mitigations.push('Activate maximum oversight protocols for critical risk systems');
        }

        if (riskFactors.emergencyTriggered > 0) {
            mitigations.push('Review and strengthen emergency response procedures');
        }

        if (riskFactors.lowAlignmentCount > 0) {
            mitigations.push('Prioritize alignment improvement for low-scoring systems');
        }

        if (riskScore > 0.8) {
            mitigations.push('Consider global coordination and international oversight');
        }

        return mitigations;
    }
}

module.exports = AGIGovernanceFramework; 