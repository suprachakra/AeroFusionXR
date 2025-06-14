/**
 * AeroFusionXR - Pillar 4: Data Lineage
 * Data Lineage Engine - Comprehensive data flow tracking
 * 
 * Features:
 * - End-to-end data lineage tracking
 * - Real-time data flow monitoring
 * - Impact analysis for data changes
 * - Compliance and audit trail generation
 */

const { EventEmitter } = require('events');
const winston = require('winston');
const crypto = require('crypto');

class DataLineageEngine extends EventEmitter {
    constructor(config) {
        super();
        this.config = {
            retentionPeriod: 365 * 24 * 60 * 60 * 1000, // 1 year
            trackingLevel: 'detailed', // basic, detailed, comprehensive
            realTimeTracking: true,
            complianceFrameworks: ['GDPR', 'CCPA', 'SOC2'],
            ...config
        };

        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            transports: [
                new winston.transports.File({ filename: 'logs/data-lineage.log' }),
                new winston.transports.Console()
            ]
        });

        // Core data structures
        this.dataAssets = new Map(); // All tracked data assets
        this.lineageGraph = new Map(); // Relationships between assets
        this.transformations = new Map(); // Data transformation records
        this.dataFlows = new Map(); // Active data flows
        this.qualityMetrics = new Map(); // Data quality measurements
        this.complianceMapping = new Map(); // Compliance requirements mapping
        
        this.initializeTracking();
    }

    /**
     * Initialize data lineage tracking
     */
    initializeTracking() {
        // Register core data sources
        this.registerDataSources();
        
        // Initialize quality monitoring
        this.initializeQualityMonitoring();
        
        // Setup compliance tracking
        this.initializeComplianceTracking();
        
        // Start real-time monitoring
        if (this.config.realTimeTracking) {
            this.startRealTimeMonitoring();
        }

        this.logger.info('Data lineage tracking initialized');
    }

    /**
     * Register core data sources
     */
    registerDataSources() {
        const dataSources = [
            {
                id: 'passenger_data',
                name: 'Passenger Information',
                type: 'database',
                location: 'postgresql://passenger_db',
                schema: 'passengers',
                sensitivity: 'high',
                piiFields: ['name', 'email', 'phone', 'passport'],
                retentionPolicy: '7_years'
            },
            {
                id: 'flight_data',
                name: 'Flight Information',
                type: 'api',
                location: 'https://api.flightinfo.com',
                schema: 'flights',
                sensitivity: 'medium',
                piiFields: [],
                retentionPolicy: '2_years'
            },
            {
                id: 'baggage_data',
                name: 'Baggage Tracking',
                type: 'database',
                location: 'mongodb://baggage_db',
                schema: 'baggage',
                sensitivity: 'medium',
                piiFields: ['passenger_id'],
                retentionPolicy: '1_year'
            },
            {
                id: 'security_data',
                name: 'Security Screening',
                type: 'database',
                location: 'postgresql://security_db',
                schema: 'security_events',
                sensitivity: 'high',
                piiFields: ['passenger_id', 'biometric_data'],
                retentionPolicy: '10_years'
            },
            {
                id: 'commerce_data',
                name: 'Commerce Transactions',
                type: 'database',
                location: 'postgresql://commerce_db',
                schema: 'transactions',
                sensitivity: 'high',
                piiFields: ['customer_id', 'payment_info'],
                retentionPolicy: '7_years'
            }
        ];

        dataSources.forEach(source => {
            this.registerDataAsset(source);
        });
    }

    /**
     * Register a data asset
     */
    registerDataAsset(asset) {
        const assetId = asset.id || this.generateAssetId(asset);
        
        const dataAsset = {
            id: assetId,
            ...asset,
            registeredAt: new Date(),
            lastUpdated: new Date(),
            version: 1,
            lineageId: this.generateLineageId(),
            qualityScore: null,
            complianceStatus: {},
            dependencies: [],
            dependents: [],
            transformationHistory: []
        };

        this.dataAssets.set(assetId, dataAsset);
        this.lineageGraph.set(assetId, new Set());

        this.logger.info(`Data asset registered: ${assetId}`, { asset: dataAsset });
        this.emit('assetRegistered', dataAsset);

        return assetId;
    }

    /**
     * Track data transformation
     */
    async trackTransformation(transformationSpec) {
        const transformationId = this.generateTransformationId();
        
        const transformation = {
            id: transformationId,
            sourceAssets: transformationSpec.sources || [],
            targetAssets: transformationSpec.targets || [],
            transformationType: transformationSpec.type,
            transformationLogic: transformationSpec.logic,
            executedBy: transformationSpec.executor,
            executedAt: new Date(),
            parameters: transformationSpec.parameters || {},
            qualityChecks: transformationSpec.qualityChecks || [],
            complianceValidation: transformationSpec.compliance || {},
            metadata: transformationSpec.metadata || {}
        };

        this.transformations.set(transformationId, transformation);

        // Update lineage graph
        await this.updateLineageGraph(transformation);

        // Track data quality impact
        await this.trackQualityImpact(transformation);

        // Validate compliance
        await this.validateTransformationCompliance(transformation);

        this.logger.info(`Data transformation tracked: ${transformationId}`, {
            sources: transformation.sourceAssets,
            targets: transformation.targetAssets,
            type: transformation.transformationType
        });

        this.emit('transformationTracked', transformation);
        return transformationId;
    }

    /**
     * Update lineage graph with new transformation
     */
    async updateLineageGraph(transformation) {
        // Create relationships between source and target assets
        for (const sourceId of transformation.sourceAssets) {
            for (const targetId of transformation.targetAssets) {
                // Add edge from source to target
                if (!this.lineageGraph.has(sourceId)) {
                    this.lineageGraph.set(sourceId, new Set());
                }
                this.lineageGraph.get(sourceId).add(targetId);

                // Update asset dependencies
                const sourceAsset = this.dataAssets.get(sourceId);
                const targetAsset = this.dataAssets.get(targetId);

                if (sourceAsset && targetAsset) {
                    if (!sourceAsset.dependents.includes(targetId)) {
                        sourceAsset.dependents.push(targetId);
                    }
                    if (!targetAsset.dependencies.includes(sourceId)) {
                        targetAsset.dependencies.push(sourceId);
                    }

                    // Add transformation to history
                    targetAsset.transformationHistory.push({
                        transformationId: transformation.id,
                        sourceAssets: transformation.sourceAssets,
                        timestamp: transformation.executedAt,
                        type: transformation.transformationType
                    });

                    targetAsset.lastUpdated = new Date();
                    targetAsset.version++;
                }
            }
        }
    }

    /**
     * Track data flow in real-time
     */
    async trackDataFlow(flowSpec) {
        const flowId = this.generateFlowId();
        
        const dataFlow = {
            id: flowId,
            sourceAsset: flowSpec.source,
            targetAsset: flowSpec.target,
            flowType: flowSpec.type, // read, write, transform, delete
            dataVolume: flowSpec.volume || 0,
            startTime: new Date(),
            endTime: null,
            status: 'active',
            qualityChecks: [],
            complianceChecks: [],
            metadata: flowSpec.metadata || {}
        };

        this.dataFlows.set(flowId, dataFlow);

        // Perform real-time quality checks
        if (this.config.trackingLevel === 'comprehensive') {
            await this.performRealTimeQualityChecks(dataFlow);
        }

        // Perform compliance checks
        await this.performRealTimeComplianceChecks(dataFlow);

        this.logger.debug(`Data flow started: ${flowId}`, {
            source: dataFlow.sourceAsset,
            target: dataFlow.targetAsset,
            type: dataFlow.flowType
        });

        this.emit('dataFlowStarted', dataFlow);
        return flowId;
    }

    /**
     * Complete data flow tracking
     */
    async completeDataFlow(flowId, completionData = {}) {
        const dataFlow = this.dataFlows.get(flowId);
        if (!dataFlow) {
            throw new Error(`Data flow not found: ${flowId}`);
        }

        dataFlow.endTime = new Date();
        dataFlow.status = completionData.status || 'completed';
        dataFlow.dataVolume = completionData.volume || dataFlow.dataVolume;
        dataFlow.duration = dataFlow.endTime - dataFlow.startTime;

        // Final quality assessment
        const qualityAssessment = await this.assessDataFlowQuality(dataFlow);
        dataFlow.qualityAssessment = qualityAssessment;

        // Final compliance validation
        const complianceValidation = await this.validateDataFlowCompliance(dataFlow);
        dataFlow.complianceValidation = complianceValidation;

        this.logger.info(`Data flow completed: ${flowId}`, {
            duration: dataFlow.duration,
            volume: dataFlow.dataVolume,
            quality: qualityAssessment.score,
            compliance: complianceValidation.status
        });

        this.emit('dataFlowCompleted', dataFlow);
    }

    /**
     * Perform impact analysis
     */
    async performImpactAnalysis(assetId, changeType = 'modification') {
        const asset = this.dataAssets.get(assetId);
        if (!asset) {
            throw new Error(`Asset not found: ${assetId}`);
        }

        const impactAnalysis = {
            assetId: assetId,
            changeType: changeType,
            analysisTime: new Date(),
            directImpacts: [],
            indirectImpacts: [],
            complianceImpacts: [],
            qualityImpacts: [],
            riskAssessment: {}
        };

        // Analyze direct impacts (immediate dependents)
        for (const dependentId of asset.dependents) {
            const dependent = this.dataAssets.get(dependentId);
            if (dependent) {
                impactAnalysis.directImpacts.push({
                    assetId: dependentId,
                    assetName: dependent.name,
                    impactType: 'data_dependency',
                    severity: this.assessImpactSeverity(asset, dependent, changeType),
                    estimatedEffort: this.estimateRemediationEffort(asset, dependent, changeType)
                });
            }
        }

        // Analyze indirect impacts (downstream dependencies)
        const downstreamAssets = await this.findDownstreamAssets(assetId, 3); // 3 levels deep
        for (const downstreamId of downstreamAssets) {
            if (!asset.dependents.includes(downstreamId)) {
                const downstream = this.dataAssets.get(downstreamId);
                if (downstream) {
                    impactAnalysis.indirectImpacts.push({
                        assetId: downstreamId,
                        assetName: downstream.name,
                        impactType: 'indirect_dependency',
                        severity: this.assessImpactSeverity(asset, downstream, changeType, true),
                        estimatedEffort: this.estimateRemediationEffort(asset, downstream, changeType)
                    });
                }
            }
        }

        // Analyze compliance impacts
        impactAnalysis.complianceImpacts = await this.analyzeComplianceImpacts(asset, changeType);

        // Analyze quality impacts
        impactAnalysis.qualityImpacts = await this.analyzeQualityImpacts(asset, changeType);

        // Overall risk assessment
        impactAnalysis.riskAssessment = await this.assessOverallRisk(impactAnalysis);

        this.logger.info(`Impact analysis completed for ${assetId}`, {
            directImpacts: impactAnalysis.directImpacts.length,
            indirectImpacts: impactAnalysis.indirectImpacts.length,
            riskLevel: impactAnalysis.riskAssessment.level
        });

        return impactAnalysis;
    }

    /**
     * Find downstream assets
     */
    async findDownstreamAssets(assetId, maxDepth = 5, visited = new Set()) {
        if (maxDepth <= 0 || visited.has(assetId)) {
            return [];
        }

        visited.add(assetId);
        const downstream = [];
        const directDependents = this.lineageGraph.get(assetId) || new Set();

        for (const dependentId of directDependents) {
            downstream.push(dependentId);
            const indirectDownstream = await this.findDownstreamAssets(
                dependentId, 
                maxDepth - 1, 
                new Set(visited)
            );
            downstream.push(...indirectDownstream);
        }

        return [...new Set(downstream)]; // Remove duplicates
    }

    /**
     * Initialize quality monitoring
     */
    initializeQualityMonitoring() {
        // Quality dimensions to track
        const qualityDimensions = [
            'completeness',
            'accuracy',
            'consistency',
            'timeliness',
            'validity',
            'uniqueness'
        ];

        // Initialize quality metrics for each asset
        for (const [assetId, asset] of this.dataAssets) {
            const qualityMetric = {
                assetId: assetId,
                dimensions: {},
                overallScore: null,
                lastAssessed: null,
                history: []
            };

            qualityDimensions.forEach(dimension => {
                qualityMetric.dimensions[dimension] = {
                    score: null,
                    rules: this.getQualityRules(asset, dimension),
                    lastChecked: null,
                    issues: []
                };
            });

            this.qualityMetrics.set(assetId, qualityMetric);
        }

        // Schedule regular quality assessments
        setInterval(() => {
            this.performQualityAssessments();
        }, 60000); // Every minute

        this.logger.info('Quality monitoring initialized');
    }

    /**
     * Perform quality assessments
     */
    async performQualityAssessments() {
        for (const [assetId, qualityMetric] of this.qualityMetrics) {
            try {
                const assessment = await this.assessDataQuality(assetId);
                qualityMetric.overallScore = assessment.overallScore;
                qualityMetric.lastAssessed = new Date();
                qualityMetric.history.push({
                    timestamp: new Date(),
                    score: assessment.overallScore,
                    dimensions: assessment.dimensions
                });

                // Keep only recent history
                const cutoff = new Date(Date.now() - this.config.retentionPeriod);
                qualityMetric.history = qualityMetric.history.filter(h => h.timestamp > cutoff);

                // Update asset quality score
                const asset = this.dataAssets.get(assetId);
                if (asset) {
                    asset.qualityScore = assessment.overallScore;
                }

                // Emit quality events
                if (assessment.overallScore < 0.7) {
                    this.emit('qualityIssue', {
                        assetId: assetId,
                        score: assessment.overallScore,
                        issues: assessment.issues
                    });
                }

            } catch (error) {
                this.logger.error(`Quality assessment failed for ${assetId}`, { error: error.message });
            }
        }
    }

    /**
     * Assess data quality for an asset
     */
    async assessDataQuality(assetId) {
        const asset = this.dataAssets.get(assetId);
        const qualityMetric = this.qualityMetrics.get(assetId);
        
        if (!asset || !qualityMetric) {
            throw new Error(`Asset or quality metric not found: ${assetId}`);
        }

        const assessment = {
            assetId: assetId,
            timestamp: new Date(),
            dimensions: {},
            overallScore: 0,
            issues: []
        };

        let totalScore = 0;
        let dimensionCount = 0;

        // Assess each quality dimension
        for (const [dimension, config] of Object.entries(qualityMetric.dimensions)) {
            const dimensionAssessment = await this.assessQualityDimension(asset, dimension, config);
            assessment.dimensions[dimension] = dimensionAssessment;
            
            totalScore += dimensionAssessment.score;
            dimensionCount++;

            if (dimensionAssessment.issues.length > 0) {
                assessment.issues.push(...dimensionAssessment.issues);
            }
        }

        assessment.overallScore = dimensionCount > 0 ? totalScore / dimensionCount : 0;
        return assessment;
    }

    /**
     * Assess quality dimension
     */
    async assessQualityDimension(asset, dimension, config) {
        const assessment = {
            dimension: dimension,
            score: 1.0,
            issues: [],
            rulesEvaluated: config.rules.length,
            rulesPassed: 0
        };

        // Evaluate quality rules for this dimension
        for (const rule of config.rules) {
            try {
                const ruleResult = await this.evaluateQualityRule(asset, rule);
                if (ruleResult.passed) {
                    assessment.rulesPassed++;
                } else {
                    assessment.issues.push({
                        rule: rule.name,
                        severity: rule.severity || 'medium',
                        description: ruleResult.description,
                        impact: ruleResult.impact
                    });
                }
            } catch (error) {
                this.logger.error(`Quality rule evaluation failed`, {
                    asset: asset.id,
                    dimension: dimension,
                    rule: rule.name,
                    error: error.message
                });
            }
        }

        // Calculate dimension score
        assessment.score = assessment.rulesEvaluated > 0 ? 
            assessment.rulesPassed / assessment.rulesEvaluated : 1.0;

        return assessment;
    }

    /**
     * Initialize compliance tracking
     */
    initializeComplianceTracking() {
        // Map assets to compliance requirements
        for (const [assetId, asset] of this.dataAssets) {
            const complianceMapping = {
                assetId: assetId,
                frameworks: {},
                lastAssessed: null,
                overallStatus: 'unknown'
            };

            // Initialize framework-specific compliance
            for (const framework of this.config.complianceFrameworks) {
                complianceMapping.frameworks[framework] = {
                    status: 'unknown',
                    requirements: this.getComplianceRequirements(asset, framework),
                    gaps: [],
                    lastChecked: null
                };
            }

            this.complianceMapping.set(assetId, complianceMapping);
        }

        // Schedule regular compliance checks
        setInterval(() => {
            this.performComplianceChecks();
        }, 300000); // Every 5 minutes

        this.logger.info('Compliance tracking initialized');
    }

    /**
     * Perform compliance checks
     */
    async performComplianceChecks() {
        for (const [assetId, complianceMapping] of this.complianceMapping) {
            try {
                for (const framework of this.config.complianceFrameworks) {
                    const compliance = await this.assessFrameworkCompliance(assetId, framework);
                    complianceMapping.frameworks[framework] = compliance;
                }

                // Update overall compliance status
                complianceMapping.overallStatus = this.calculateOverallComplianceStatus(complianceMapping);
                complianceMapping.lastAssessed = new Date();

                // Update asset compliance status
                const asset = this.dataAssets.get(assetId);
                if (asset) {
                    asset.complianceStatus = complianceMapping.frameworks;
                }

            } catch (error) {
                this.logger.error(`Compliance check failed for ${assetId}`, { error: error.message });
            }
        }
    }

    /**
     * Start real-time monitoring
     */
    startRealTimeMonitoring() {
        // Monitor data access patterns
        setInterval(() => {
            this.monitorDataAccess();
        }, 10000); // Every 10 seconds

        // Monitor data modifications
        setInterval(() => {
            this.monitorDataModifications();
        }, 30000); // Every 30 seconds

        this.logger.info('Real-time monitoring started');
    }

    /**
     * Generate lineage report
     */
    async generateLineageReport(assetId, options = {}) {
        const asset = this.dataAssets.get(assetId);
        if (!asset) {
            throw new Error(`Asset not found: ${assetId}`);
        }

        const report = {
            assetId: assetId,
            assetName: asset.name,
            generatedAt: new Date(),
            lineageDepth: options.depth || 5,
            includeQuality: options.includeQuality !== false,
            includeCompliance: options.includeCompliance !== false,
            upstream: [],
            downstream: [],
            transformations: [],
            qualityMetrics: null,
            complianceStatus: null,
            riskAssessment: null
        };

        // Get upstream lineage
        report.upstream = await this.getUpstreamLineage(assetId, report.lineageDepth);

        // Get downstream lineage
        report.downstream = await this.getDownstreamLineage(assetId, report.lineageDepth);

        // Get transformation history
        report.transformations = asset.transformationHistory.slice(-50); // Last 50 transformations

        // Include quality metrics if requested
        if (report.includeQuality) {
            const qualityMetric = this.qualityMetrics.get(assetId);
            if (qualityMetric) {
                report.qualityMetrics = {
                    overallScore: qualityMetric.overallScore,
                    lastAssessed: qualityMetric.lastAssessed,
                    dimensions: qualityMetric.dimensions,
                    history: qualityMetric.history.slice(-10) // Last 10 assessments
                };
            }
        }

        // Include compliance status if requested
        if (report.includeCompliance) {
            const complianceMapping = this.complianceMapping.get(assetId);
            if (complianceMapping) {
                report.complianceStatus = {
                    overallStatus: complianceMapping.overallStatus,
                    frameworks: complianceMapping.frameworks,
                    lastAssessed: complianceMapping.lastAssessed
                };
            }
        }

        // Risk assessment
        report.riskAssessment = await this.assessAssetRisk(assetId);

        return report;
    }

    /**
     * Utility methods
     */
    generateAssetId(asset) {
        return `asset_${crypto.createHash('md5').update(asset.name + asset.location).digest('hex').substr(0, 8)}`;
    }

    generateLineageId() {
        return `lineage_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    generateTransformationId() {
        return `transform_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    generateFlowId() {
        return `flow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    getQualityRules(asset, dimension) {
        // Return quality rules based on asset type and dimension
        const rules = {
            completeness: [
                { name: 'no_null_values', severity: 'high' },
                { name: 'required_fields_present', severity: 'critical' }
            ],
            accuracy: [
                { name: 'data_format_validation', severity: 'medium' },
                { name: 'business_rule_validation', severity: 'high' }
            ],
            consistency: [
                { name: 'cross_field_consistency', severity: 'medium' },
                { name: 'referential_integrity', severity: 'high' }
            ],
            timeliness: [
                { name: 'data_freshness', severity: 'medium' },
                { name: 'update_frequency', severity: 'low' }
            ],
            validity: [
                { name: 'domain_validation', severity: 'high' },
                { name: 'constraint_validation', severity: 'medium' }
            ],
            uniqueness: [
                { name: 'duplicate_detection', severity: 'medium' },
                { name: 'primary_key_uniqueness', severity: 'critical' }
            ]
        };

        return rules[dimension] || [];
    }

    getComplianceRequirements(asset, framework) {
        // Return compliance requirements based on asset and framework
        const requirements = {
            GDPR: asset.piiFields.length > 0 ? [
                'data_minimization',
                'purpose_limitation',
                'consent_management',
                'right_to_erasure',
                'data_portability'
            ] : [],
            CCPA: asset.piiFields.length > 0 ? [
                'consumer_rights',
                'data_disclosure',
                'opt_out_mechanisms'
            ] : [],
            SOC2: [
                'access_controls',
                'data_encryption',
                'audit_logging',
                'backup_procedures'
            ]
        };

        return requirements[framework] || [];
    }

    async evaluateQualityRule(asset, rule) {
        // Simulate quality rule evaluation
        const passed = Math.random() > 0.1; // 90% pass rate
        
        return {
            passed: passed,
            description: passed ? 'Rule passed' : `Quality rule failed: ${rule.name}`,
            impact: passed ? 'none' : rule.severity
        };
    }

    async assessFrameworkCompliance(assetId, framework) {
        const asset = this.dataAssets.get(assetId);
        const requirements = this.getComplianceRequirements(asset, framework);
        
        const compliance = {
            status: 'compliant',
            requirements: requirements,
            gaps: [],
            lastChecked: new Date(),
            score: 100
        };

        // Simulate compliance assessment
        for (const requirement of requirements) {
            if (Math.random() < 0.1) { // 10% chance of gap
                compliance.gaps.push({
                    requirement: requirement,
                    severity: 'medium',
                    description: `Gap in ${requirement} compliance`,
                    remediation: `Implement ${requirement} controls`
                });
            }
        }

        if (compliance.gaps.length > 0) {
            compliance.status = 'non-compliant';
            compliance.score = Math.max(0, 100 - (compliance.gaps.length * 20));
        }

        return compliance;
    }

    calculateOverallComplianceStatus(complianceMapping) {
        const statuses = Object.values(complianceMapping.frameworks).map(f => f.status);
        
        if (statuses.includes('non-compliant')) {
            return 'non-compliant';
        } else if (statuses.includes('unknown')) {
            return 'unknown';
        } else {
            return 'compliant';
        }
    }

    async getUpstreamLineage(assetId, depth, visited = new Set()) {
        if (depth <= 0 || visited.has(assetId)) {
            return [];
        }

        visited.add(assetId);
        const upstream = [];
        const asset = this.dataAssets.get(assetId);

        if (asset) {
            for (const dependencyId of asset.dependencies) {
                const dependency = this.dataAssets.get(dependencyId);
                if (dependency) {
                    upstream.push({
                        assetId: dependencyId,
                        assetName: dependency.name,
                        relationship: 'dependency',
                        depth: depth
                    });

                    // Recursively get upstream dependencies
                    const nestedUpstream = await this.getUpstreamLineage(
                        dependencyId, 
                        depth - 1, 
                        new Set(visited)
                    );
                    upstream.push(...nestedUpstream);
                }
            }
        }

        return upstream;
    }

    async getDownstreamLineage(assetId, depth, visited = new Set()) {
        if (depth <= 0 || visited.has(assetId)) {
            return [];
        }

        visited.add(assetId);
        const downstream = [];
        const asset = this.dataAssets.get(assetId);

        if (asset) {
            for (const dependentId of asset.dependents) {
                const dependent = this.dataAssets.get(dependentId);
                if (dependent) {
                    downstream.push({
                        assetId: dependentId,
                        assetName: dependent.name,
                        relationship: 'dependent',
                        depth: depth
                    });

                    // Recursively get downstream dependents
                    const nestedDownstream = await this.getDownstreamLineage(
                        dependentId, 
                        depth - 1, 
                        new Set(visited)
                    );
                    downstream.push(...nestedDownstream);
                }
            }
        }

        return downstream;
    }

    assessImpactSeverity(sourceAsset, targetAsset, changeType, indirect = false) {
        let severity = 'low';
        
        if (sourceAsset.sensitivity === 'high' || targetAsset.sensitivity === 'high') {
            severity = 'high';
        } else if (sourceAsset.sensitivity === 'medium' || targetAsset.sensitivity === 'medium') {
            severity = 'medium';
        }

        if (changeType === 'deletion' || changeType === 'schema_change') {
            severity = severity === 'low' ? 'medium' : 'high';
        }

        if (indirect) {
            // Reduce severity for indirect impacts
            severity = severity === 'high' ? 'medium' : 'low';
        }

        return severity;
    }

    estimateRemediationEffort(sourceAsset, targetAsset, changeType) {
        const effortMap = {
            'modification': { low: '2-4 hours', medium: '1-2 days', high: '3-5 days' },
            'deletion': { low: '4-8 hours', medium: '2-3 days', high: '1-2 weeks' },
            'schema_change': { low: '1-2 days', medium: '3-5 days', high: '1-2 weeks' }
        };

        const severity = this.assessImpactSeverity(sourceAsset, targetAsset, changeType);
        return effortMap[changeType]?.[severity] || '1-2 days';
    }

    async analyzeComplianceImpacts(asset, changeType) {
        const impacts = [];
        const complianceMapping = this.complianceMapping.get(asset.id);

        if (complianceMapping) {
            for (const [framework, compliance] of Object.entries(complianceMapping.frameworks)) {
                if (compliance.requirements.length > 0) {
                    impacts.push({
                        framework: framework,
                        impactType: 'compliance_validation_required',
                        severity: asset.sensitivity === 'high' ? 'high' : 'medium',
                        description: `${changeType} may affect ${framework} compliance`,
                        requirements: compliance.requirements
                    });
                }
            }
        }

        return impacts;
    }

    async analyzeQualityImpacts(asset, changeType) {
        const impacts = [];
        const qualityMetric = this.qualityMetrics.get(asset.id);

        if (qualityMetric && qualityMetric.overallScore < 0.8) {
            impacts.push({
                impactType: 'quality_degradation_risk',
                severity: 'medium',
                description: `${changeType} may further degrade data quality`,
                currentScore: qualityMetric.overallScore,
                affectedDimensions: Object.keys(qualityMetric.dimensions)
            });
        }

        return impacts;
    }

    async assessOverallRisk(impactAnalysis) {
        const riskFactors = {
            directImpacts: impactAnalysis.directImpacts.length,
            indirectImpacts: impactAnalysis.indirectImpacts.length,
            complianceImpacts: impactAnalysis.complianceImpacts.length,
            qualityImpacts: impactAnalysis.qualityImpacts.length
        };

        const totalImpacts = Object.values(riskFactors).reduce((sum, count) => sum + count, 0);
        const highSeverityImpacts = [
            ...impactAnalysis.directImpacts,
            ...impactAnalysis.indirectImpacts,
            ...impactAnalysis.complianceImpacts,
            ...impactAnalysis.qualityImpacts
        ].filter(impact => impact.severity === 'high').length;

        let riskLevel = 'low';
        if (totalImpacts > 10 || highSeverityImpacts > 3) {
            riskLevel = 'high';
        } else if (totalImpacts > 5 || highSeverityImpacts > 1) {
            riskLevel = 'medium';
        }

        return {
            level: riskLevel,
            score: Math.min(100, totalImpacts * 10 + highSeverityImpacts * 20),
            factors: riskFactors,
            recommendation: this.getRiskRecommendation(riskLevel, totalImpacts)
        };
    }

    getRiskRecommendation(riskLevel, totalImpacts) {
        const recommendations = {
            low: 'Proceed with standard change management procedures',
            medium: 'Implement additional testing and validation before deployment',
            high: 'Conduct thorough impact assessment and consider phased rollout'
        };

        return recommendations[riskLevel] || recommendations.medium;
    }

    async assessAssetRisk(assetId) {
        const asset = this.dataAssets.get(assetId);
        const qualityMetric = this.qualityMetrics.get(assetId);
        const complianceMapping = this.complianceMapping.get(assetId);

        let riskScore = 0;
        const riskFactors = [];

        // Quality risk
        if (qualityMetric && qualityMetric.overallScore < 0.7) {
            riskScore += 30;
            riskFactors.push('Poor data quality');
        }

        // Compliance risk
        if (complianceMapping && complianceMapping.overallStatus === 'non-compliant') {
            riskScore += 40;
            riskFactors.push('Compliance gaps');
        }

        // Sensitivity risk
        if (asset.sensitivity === 'high') {
            riskScore += 20;
            riskFactors.push('High sensitivity data');
        }

        // Dependency risk
        if (asset.dependents.length > 5) {
            riskScore += 10;
            riskFactors.push('High dependency count');
        }

        const riskLevel = riskScore > 70 ? 'high' : riskScore > 40 ? 'medium' : 'low';

        return {
            level: riskLevel,
            score: riskScore,
            factors: riskFactors,
            lastAssessed: new Date()
        };
    }

    // Monitoring methods (simplified implementations)
    async monitorDataAccess() {
        // Monitor data access patterns
        this.logger.debug('Monitoring data access patterns');
    }

    async monitorDataModifications() {
        // Monitor data modifications
        this.logger.debug('Monitoring data modifications');
    }

    async performRealTimeQualityChecks(dataFlow) {
        // Perform real-time quality checks during data flow
        dataFlow.qualityChecks.push({
            timestamp: new Date(),
            passed: Math.random() > 0.1,
            checks: ['format_validation', 'completeness_check']
        });
    }

    async performRealTimeComplianceChecks(dataFlow) {
        // Perform real-time compliance checks during data flow
        dataFlow.complianceChecks.push({
            timestamp: new Date(),
            passed: Math.random() > 0.05,
            frameworks: this.config.complianceFrameworks
        });
    }

    async assessDataFlowQuality(dataFlow) {
        return {
            score: Math.random() * 0.3 + 0.7, // 0.7 - 1.0
            issues: []
        };
    }

    async validateDataFlowCompliance(dataFlow) {
        return {
            status: Math.random() > 0.1 ? 'compliant' : 'non-compliant',
            frameworks: this.config.complianceFrameworks
        };
    }

    async trackQualityImpact(transformation) {
        // Track how transformation affects data quality
        this.logger.debug(`Tracking quality impact for transformation: ${transformation.id}`);
    }

    async validateTransformationCompliance(transformation) {
        // Validate transformation compliance
        this.logger.debug(`Validating compliance for transformation: ${transformation.id}`);
    }

    /**
     * API Methods
     */
    getAsset(assetId) {
        return this.dataAssets.get(assetId);
    }

    getAllAssets() {
        return Array.from(this.dataAssets.values());
    }

    getLineageGraph() {
        const graph = {};
        for (const [assetId, connections] of this.lineageGraph) {
            graph[assetId] = Array.from(connections);
        }
        return graph;
    }

    getDashboardMetrics() {
        const totalAssets = this.dataAssets.size;
        const qualityIssues = Array.from(this.qualityMetrics.values())
            .filter(q => q.overallScore && q.overallScore < 0.7).length;
        const complianceIssues = Array.from(this.complianceMapping.values())
            .filter(c => c.overallStatus === 'non-compliant').length;
        const activeFlows = Array.from(this.dataFlows.values())
            .filter(f => f.status === 'active').length;

        return {
            totalAssets: totalAssets,
            qualityIssues: qualityIssues,
            complianceIssues: complianceIssues,
            activeFlows: activeFlows,
            totalTransformations: this.transformations.size,
            lastUpdated: new Date()
        };
    }
}

module.exports = DataLineageEngine; 