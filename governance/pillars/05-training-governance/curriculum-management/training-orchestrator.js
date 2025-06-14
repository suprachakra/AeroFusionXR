/**
 * AeroFusionXR - Pillar 5: Training Governance
 * Training Orchestrator - Comprehensive AI governance training management
 */

const { EventEmitter } = require('events');
const winston = require('winston');

class TrainingOrchestrator extends EventEmitter {
    constructor(config) {
        super();
        this.config = {
            certificationValidityPeriod: 365 * 24 * 60 * 60 * 1000, // 1 year
            mandatoryTrainingInterval: 90 * 24 * 60 * 60 * 1000, // 90 days
            competencyThreshold: 0.8,
            ...config
        };

        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
            transports: [
                new winston.transports.File({ filename: 'logs/training-governance.log' }),
                new winston.transports.Console()
            ]
        });

        // Core data structures
        this.trainingPrograms = new Map();
        this.learnerProfiles = new Map();
        this.competencyFramework = new Map();
        this.certifications = new Map();
        this.trainingHistory = new Map();
        
        this.initializeTrainingPrograms();
        this.initializeCompetencyFramework();
        this.startTrainingMonitoring();
    }

    /**
     * Initialize training programs
     */
    initializeTrainingPrograms() {
        const programs = [
            {
                id: 'ai_governance_fundamentals',
                name: 'AI Governance Fundamentals',
                type: 'mandatory',
                duration: 120, // minutes
                competencies: ['ai_ethics', 'bias_awareness', 'compliance_basics'],
                prerequisites: [],
                validityPeriod: this.config.certificationValidityPeriod
            },
            {
                id: 'bias_detection_advanced',
                name: 'Advanced Bias Detection',
                type: 'role_specific',
                duration: 180,
                competencies: ['bias_detection', 'fairness_metrics', 'mitigation_strategies'],
                prerequisites: ['ai_governance_fundamentals'],
                validityPeriod: this.config.certificationValidityPeriod
            },
            {
                id: 'privacy_protection',
                name: 'Privacy Protection in AI',
                type: 'mandatory',
                duration: 90,
                competencies: ['privacy_principles', 'data_protection', 'consent_management'],
                prerequisites: [],
                validityPeriod: this.config.certificationValidityPeriod
            },
            {
                id: 'incident_response',
                name: 'AI Incident Response',
                type: 'role_specific',
                duration: 150,
                competencies: ['incident_identification', 'response_procedures', 'escalation_protocols'],
                prerequisites: ['ai_governance_fundamentals'],
                validityPeriod: this.config.certificationValidityPeriod
            }
        ];

        programs.forEach(program => {
            this.trainingPrograms.set(program.id, {
                ...program,
                createdAt: new Date(),
                enrollments: 0,
                completions: 0,
                averageScore: 0,
                modules: this.generateTrainingModules(program)
            });
        });

        this.logger.info('Training programs initialized', { count: programs.length });
    }

    /**
     * Initialize competency framework
     */
    initializeCompetencyFramework() {
        const competencies = [
            {
                id: 'ai_ethics',
                name: 'AI Ethics',
                category: 'foundational',
                description: 'Understanding of ethical principles in AI development and deployment',
                assessmentCriteria: ['ethical_reasoning', 'case_study_analysis', 'decision_making'],
                proficiencyLevels: ['novice', 'competent', 'proficient', 'expert']
            },
            {
                id: 'bias_awareness',
                name: 'Bias Awareness',
                category: 'technical',
                description: 'Ability to identify and understand various forms of AI bias',
                assessmentCriteria: ['bias_identification', 'impact_assessment', 'prevention_strategies'],
                proficiencyLevels: ['novice', 'competent', 'proficient', 'expert']
            },
            {
                id: 'compliance_basics',
                name: 'Compliance Fundamentals',
                category: 'regulatory',
                description: 'Knowledge of AI governance regulations and compliance requirements',
                assessmentCriteria: ['regulation_knowledge', 'compliance_procedures', 'documentation'],
                proficiencyLevels: ['novice', 'competent', 'proficient', 'expert']
            }
        ];

        competencies.forEach(competency => {
            this.competencyFramework.set(competency.id, {
                ...competency,
                createdAt: new Date(),
                assessments: this.generateCompetencyAssessments(competency)
            });
        });

        this.logger.info('Competency framework initialized', { count: competencies.length });
    }

    /**
     * Enroll learner in training program
     */
    async enrollLearner(learnerId, programId, enrollmentData = {}) {
        const program = this.trainingPrograms.get(programId);
        if (!program) {
            throw new Error(`Training program not found: ${programId}`);
        }

        // Check prerequisites
        const prerequisitesMet = await this.checkPrerequisites(learnerId, program.prerequisites);
        if (!prerequisitesMet.allMet) {
            throw new Error(`Prerequisites not met: ${prerequisitesMet.missing.join(', ')}`);
        }

        const enrollment = {
            learnerId: learnerId,
            programId: programId,
            enrolledAt: new Date(),
            status: 'enrolled',
            progress: 0,
            currentModule: 0,
            completedModules: [],
            assessmentScores: {},
            estimatedCompletion: new Date(Date.now() + program.duration * 60 * 1000),
            metadata: enrollmentData
        };

        // Update learner profile
        if (!this.learnerProfiles.has(learnerId)) {
            this.learnerProfiles.set(learnerId, {
                id: learnerId,
                enrollments: [],
                completions: [],
                competencies: new Map(),
                certifications: [],
                lastActivity: new Date()
            });
        }

        const learnerProfile = this.learnerProfiles.get(learnerId);
        learnerProfile.enrollments.push(enrollment);
        learnerProfile.lastActivity = new Date();

        // Update program statistics
        program.enrollments++;

        this.logger.info(`Learner enrolled in training`, {
            learnerId: learnerId,
            programId: programId,
            estimatedCompletion: enrollment.estimatedCompletion
        });

        this.emit('learnerEnrolled', { learnerId, programId, enrollment });
        return enrollment;
    }

    /**
     * Track learning progress
     */
    async trackProgress(learnerId, programId, progressData) {
        const learnerProfile = this.learnerProfiles.get(learnerId);
        if (!learnerProfile) {
            throw new Error(`Learner not found: ${learnerId}`);
        }

        const enrollment = learnerProfile.enrollments.find(e => 
            e.programId === programId && e.status === 'enrolled'
        );
        if (!enrollment) {
            throw new Error(`Active enrollment not found for learner ${learnerId} in program ${programId}`);
        }

        // Update progress
        enrollment.progress = progressData.progress || enrollment.progress;
        enrollment.currentModule = progressData.currentModule || enrollment.currentModule;
        
        if (progressData.completedModule) {
            enrollment.completedModules.push({
                moduleId: progressData.completedModule,
                completedAt: new Date(),
                score: progressData.moduleScore || null
            });
        }

        if (progressData.assessmentScore) {
            enrollment.assessmentScores[progressData.assessmentId] = {
                score: progressData.assessmentScore,
                completedAt: new Date(),
                attempts: progressData.attempts || 1
            };
        }

        learnerProfile.lastActivity = new Date();

        // Check for completion
        if (enrollment.progress >= 100) {
            await this.completeTraining(learnerId, programId);
        }

        this.logger.debug(`Progress tracked for learner`, {
            learnerId: learnerId,
            programId: programId,
            progress: enrollment.progress
        });

        this.emit('progressTracked', { learnerId, programId, progressData });
    }

    /**
     * Complete training program
     */
    async completeTraining(learnerId, programId) {
        const learnerProfile = this.learnerProfiles.get(learnerId);
        const enrollment = learnerProfile.enrollments.find(e => 
            e.programId === programId && e.status === 'enrolled'
        );

        if (!enrollment) {
            throw new Error(`Active enrollment not found`);
        }

        const program = this.trainingPrograms.get(programId);
        
        // Calculate final score
        const assessmentScores = Object.values(enrollment.assessmentScores).map(a => a.score);
        const finalScore = assessmentScores.length > 0 ? 
            assessmentScores.reduce((sum, score) => sum + score, 0) / assessmentScores.length : 0;

        // Update enrollment status
        enrollment.status = finalScore >= this.config.competencyThreshold ? 'completed' : 'failed';
        enrollment.completedAt = new Date();
        enrollment.finalScore = finalScore;

        // Add to completions
        learnerProfile.completions.push({
            programId: programId,
            completedAt: enrollment.completedAt,
            finalScore: finalScore,
            status: enrollment.status
        });

        // Update competencies if passed
        if (enrollment.status === 'completed') {
            await this.updateLearnerCompetencies(learnerId, program.competencies, finalScore);
            
            // Issue certification if applicable
            if (program.type === 'mandatory' || finalScore >= 0.9) {
                await this.issueCertification(learnerId, programId, finalScore);
            }
        }

        // Update program statistics
        program.completions++;
        program.averageScore = (program.averageScore * (program.completions - 1) + finalScore) / program.completions;

        this.logger.info(`Training completed`, {
            learnerId: learnerId,
            programId: programId,
            status: enrollment.status,
            finalScore: finalScore
        });

        this.emit('trainingCompleted', { learnerId, programId, enrollment });
    }

    /**
     * Update learner competencies
     */
    async updateLearnerCompetencies(learnerId, competencyIds, score) {
        const learnerProfile = this.learnerProfiles.get(learnerId);
        
        for (const competencyId of competencyIds) {
            const competency = this.competencyFramework.get(competencyId);
            if (competency) {
                const proficiencyLevel = this.calculateProficiencyLevel(score);
                
                learnerProfile.competencies.set(competencyId, {
                    competencyId: competencyId,
                    proficiencyLevel: proficiencyLevel,
                    assessedAt: new Date(),
                    score: score,
                    validUntil: new Date(Date.now() + this.config.certificationValidityPeriod)
                });
            }
        }

        this.logger.info(`Competencies updated for learner`, {
            learnerId: learnerId,
            competencies: competencyIds,
            proficiencyLevel: this.calculateProficiencyLevel(score)
        });
    }

    /**
     * Issue certification
     */
    async issueCertification(learnerId, programId, score) {
        const certificationId = this.generateCertificationId();
        const program = this.trainingPrograms.get(programId);
        
        const certification = {
            id: certificationId,
            learnerId: learnerId,
            programId: programId,
            programName: program.name,
            issuedAt: new Date(),
            validUntil: new Date(Date.now() + program.validityPeriod),
            score: score,
            competencies: program.competencies,
            status: 'active'
        };

        this.certifications.set(certificationId, certification);
        
        const learnerProfile = this.learnerProfiles.get(learnerId);
        learnerProfile.certifications.push(certification);

        this.logger.info(`Certification issued`, {
            certificationId: certificationId,
            learnerId: learnerId,
            programId: programId
        });

        this.emit('certificationIssued', certification);
        return certificationId;
    }

    /**
     * Assess competency
     */
    async assessCompetency(learnerId, competencyId, assessmentData) {
        const competency = this.competencyFramework.get(competencyId);
        if (!competency) {
            throw new Error(`Competency not found: ${competencyId}`);
        }

        const assessment = {
            learnerId: learnerId,
            competencyId: competencyId,
            assessedAt: new Date(),
            assessmentType: assessmentData.type || 'practical',
            score: assessmentData.score,
            assessor: assessmentData.assessor,
            evidence: assessmentData.evidence || [],
            feedback: assessmentData.feedback || ''
        };

        // Store assessment history
        if (!this.trainingHistory.has(learnerId)) {
            this.trainingHistory.set(learnerId, []);
        }
        this.trainingHistory.get(learnerId).push(assessment);

        // Update learner competency
        const learnerProfile = this.learnerProfiles.get(learnerId);
        if (learnerProfile) {
            const proficiencyLevel = this.calculateProficiencyLevel(assessment.score);
            learnerProfile.competencies.set(competencyId, {
                competencyId: competencyId,
                proficiencyLevel: proficiencyLevel,
                assessedAt: assessment.assessedAt,
                score: assessment.score,
                validUntil: new Date(Date.now() + this.config.certificationValidityPeriod)
            });
        }

        this.logger.info(`Competency assessed`, {
            learnerId: learnerId,
            competencyId: competencyId,
            score: assessment.score,
            proficiencyLevel: this.calculateProficiencyLevel(assessment.score)
        });

        this.emit('competencyAssessed', assessment);
        return assessment;
    }

    /**
     * Start training monitoring
     */
    startTrainingMonitoring() {
        // Check for expired certifications
        setInterval(() => {
            this.checkExpiredCertifications();
        }, 24 * 60 * 60 * 1000); // Daily

        // Send training reminders
        setInterval(() => {
            this.sendTrainingReminders();
        }, 7 * 24 * 60 * 60 * 1000); // Weekly

        this.logger.info('Training monitoring started');
    }

    /**
     * Check for expired certifications
     */
    async checkExpiredCertifications() {
        const now = new Date();
        const expiredCertifications = [];

        for (const [certId, certification] of this.certifications) {
            if (certification.validUntil < now && certification.status === 'active') {
                certification.status = 'expired';
                expiredCertifications.push(certification);
                
                this.emit('certificationExpired', certification);
            }
        }

        if (expiredCertifications.length > 0) {
            this.logger.warn(`Certifications expired`, { count: expiredCertifications.length });
        }
    }

    /**
     * Send training reminders
     */
    async sendTrainingReminders() {
        const reminderThreshold = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

        for (const [learnerId, profile] of this.learnerProfiles) {
            // Check for expiring certifications
            const expiringCertifications = profile.certifications.filter(cert => 
                cert.validUntil < reminderThreshold && cert.status === 'active'
            );

            if (expiringCertifications.length > 0) {
                this.emit('trainingReminderNeeded', {
                    learnerId: learnerId,
                    type: 'certification_renewal',
                    certifications: expiringCertifications
                });
            }

            // Check for mandatory training requirements
            const lastMandatoryTraining = profile.completions
                .filter(c => {
                    const program = this.trainingPrograms.get(c.programId);
                    return program && program.type === 'mandatory';
                })
                .sort((a, b) => b.completedAt - a.completedAt)[0];

            if (!lastMandatoryTraining || 
                (new Date() - lastMandatoryTraining.completedAt) > this.config.mandatoryTrainingInterval) {
                this.emit('trainingReminderNeeded', {
                    learnerId: learnerId,
                    type: 'mandatory_training',
                    lastCompleted: lastMandatoryTraining?.completedAt
                });
            }
        }
    }

    /**
     * Utility methods
     */
    generateTrainingModules(program) {
        const moduleTemplates = {
            'ai_governance_fundamentals': [
                { id: 'intro_ai_governance', name: 'Introduction to AI Governance', duration: 30 },
                { id: 'ethical_principles', name: 'Ethical Principles in AI', duration: 45 },
                { id: 'regulatory_landscape', name: 'Regulatory Landscape', duration: 45 }
            ],
            'bias_detection_advanced': [
                { id: 'bias_types', name: 'Types of AI Bias', duration: 60 },
                { id: 'detection_methods', name: 'Bias Detection Methods', duration: 60 },
                { id: 'mitigation_strategies', name: 'Mitigation Strategies', duration: 60 }
            ]
        };

        return moduleTemplates[program.id] || [
            { id: 'module_1', name: 'Module 1', duration: program.duration / 3 },
            { id: 'module_2', name: 'Module 2', duration: program.duration / 3 },
            { id: 'module_3', name: 'Module 3', duration: program.duration / 3 }
        ];
    }

    generateCompetencyAssessments(competency) {
        return [
            {
                id: `${competency.id}_knowledge_test`,
                type: 'knowledge_test',
                questions: 20,
                passingScore: 0.8,
                timeLimit: 60 // minutes
            },
            {
                id: `${competency.id}_practical_assessment`,
                type: 'practical',
                scenarios: 3,
                passingScore: 0.8,
                timeLimit: 120
            }
        ];
    }

    async checkPrerequisites(learnerId, prerequisites) {
        const learnerProfile = this.learnerProfiles.get(learnerId);
        if (!learnerProfile || prerequisites.length === 0) {
            return { allMet: true, missing: [] };
        }

        const completedPrograms = learnerProfile.completions
            .filter(c => c.status === 'completed')
            .map(c => c.programId);

        const missing = prerequisites.filter(prereq => !completedPrograms.includes(prereq));

        return {
            allMet: missing.length === 0,
            missing: missing
        };
    }

    calculateProficiencyLevel(score) {
        if (score >= 0.9) return 'expert';
        if (score >= 0.8) return 'proficient';
        if (score >= 0.7) return 'competent';
        return 'novice';
    }

    generateCertificationId() {
        return `cert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * API Methods
     */
    getLearnerProfile(learnerId) {
        return this.learnerProfiles.get(learnerId);
    }

    getTrainingProgram(programId) {
        return this.trainingPrograms.get(programId);
    }

    getAllTrainingPrograms() {
        return Array.from(this.trainingPrograms.values());
    }

    getCertification(certificationId) {
        return this.certifications.get(certificationId);
    }

    getLearnerCertifications(learnerId) {
        const profile = this.learnerProfiles.get(learnerId);
        return profile ? profile.certifications : [];
    }

    getDashboardMetrics() {
        const totalLearners = this.learnerProfiles.size;
        const totalPrograms = this.trainingPrograms.size;
        const totalCertifications = this.certifications.size;
        const activeCertifications = Array.from(this.certifications.values())
            .filter(c => c.status === 'active').length;
        
        const completionRate = totalLearners > 0 ? 
            Array.from(this.learnerProfiles.values())
                .reduce((sum, profile) => sum + profile.completions.length, 0) / totalLearners : 0;

        return {
            totalLearners: totalLearners,
            totalPrograms: totalPrograms,
            totalCertifications: totalCertifications,
            activeCertifications: activeCertifications,
            completionRate: completionRate,
            averageCompetencyScore: this.calculateAverageCompetencyScore(),
            lastUpdated: new Date()
        };
    }

    calculateAverageCompetencyScore() {
        let totalScore = 0;
        let count = 0;

        for (const profile of this.learnerProfiles.values()) {
            for (const competency of profile.competencies.values()) {
                totalScore += competency.score;
                count++;
            }
        }

        return count > 0 ? totalScore / count : 0;
    }
}

module.exports = TrainingOrchestrator; 