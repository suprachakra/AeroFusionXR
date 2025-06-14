-- PostgreSQL Governance Schema Extensions
-- Extends existing AeroFusionXR database with governance tables

-- Create governance schema
CREATE SCHEMA IF NOT EXISTS governance;

-- Set search path to include governance schema
SET search_path TO governance, public;

-- ============================================================================
-- PILLAR 1: MATURITY MODEL TABLES
-- ============================================================================

-- Maturity assessments and scoring
CREATE TABLE governance.maturity_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    overall_score DECIMAL(3,1) CHECK (overall_score >= 0 AND overall_score <= 10),
    level_achieved INTEGER CHECK (level_achieved >= 1 AND level_achieved <= 5),
    assessor_id VARCHAR(255),
    assessment_type VARCHAR(50) DEFAULT 'automated',
    dimensions JSONB,
    evidence_collected JSONB,
    recommendations JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Maturity evidence collection
CREATE TABLE governance.maturity_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID REFERENCES governance.maturity_assessments(id),
    pillar_id INTEGER CHECK (pillar_id >= 1 AND pillar_id <= 15),
    dimension VARCHAR(100),
    evidence_type VARCHAR(100),
    evidence_data JSONB,
    score DECIMAL(3,1),
    weight DECIMAL(3,2) DEFAULT 1.0,
    collected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    source_system VARCHAR(100),
    automated BOOLEAN DEFAULT true
);

-- ============================================================================
-- PILLAR 2: INDEPENDENT ASSURANCE TABLES
-- ============================================================================

-- Audit schedules and execution
CREATE TABLE governance.audit_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_type VARCHAR(100) NOT NULL,
    scope JSONB,
    frequency VARCHAR(50),
    next_due_date DATE,
    auditor_assignment JSONB,
    compliance_frameworks TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit findings and remediation
CREATE TABLE governance.audit_findings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_id UUID,
    finding_type VARCHAR(100),
    severity VARCHAR(20) CHECK (severity IN ('critical', 'high', 'medium', 'low')),
    title VARCHAR(500),
    description TEXT,
    affected_systems TEXT[],
    remediation_plan JSONB,
    due_date DATE,
    status VARCHAR(50) DEFAULT 'open',
    assignee VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- ============================================================================
-- PILLAR 3: RUNTIME SAFETY & MONITORING TABLES
-- ============================================================================

-- Anomaly detection results
CREATE TABLE governance.anomaly_detections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_name VARCHAR(100),
    detection_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    anomaly_type VARCHAR(100),
    severity VARCHAR(20),
    confidence_score DECIMAL(5,4),
    affected_metrics JSONB,
    baseline_values JSONB,
    current_values JSONB,
    alert_triggered BOOLEAN DEFAULT false,
    investigation_status VARCHAR(50) DEFAULT 'pending',
    resolution_notes TEXT
);

-- Bias detection results
CREATE TABLE governance.bias_detections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id VARCHAR(255),
    service_name VARCHAR(100),
    detection_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    bias_type VARCHAR(100),
    bias_score DECIMAL(5,4),
    bias_detected BOOLEAN,
    affected_groups JSONB,
    response_sample TEXT,
    mitigation_applied JSONB,
    human_review_required BOOLEAN DEFAULT false
);

-- ============================================================================
-- PILLAR 4: DATA & MODEL LINEAGE TABLES
-- ============================================================================

-- Data lineage tracking
CREATE TABLE governance.data_lineage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_id VARCHAR(255),
    dataset_name VARCHAR(255),
    source_system VARCHAR(100),
    upstream_dependencies TEXT[],
    downstream_dependencies TEXT[],
    transformation_logic JSONB,
    data_quality_metrics JSONB,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    lineage_version INTEGER DEFAULT 1,
    tags TEXT[]
);

-- Model lineage tracking
CREATE TABLE governance.model_lineage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id VARCHAR(255) UNIQUE,
    model_name VARCHAR(255),
    model_version VARCHAR(50),
    training_datasets TEXT[],
    feature_dependencies TEXT[],
    parent_models TEXT[],
    deployment_environments TEXT[],
    performance_metrics JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deployed_at TIMESTAMP WITH TIME ZONE,
    retired_at TIMESTAMP WITH TIME ZONE
);

-- Data quality monitoring
CREATE TABLE governance.data_quality_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_id VARCHAR(255),
    metric_name VARCHAR(100),
    metric_value DECIMAL(10,4),
    threshold_min DECIMAL(10,4),
    threshold_max DECIMAL(10,4),
    status VARCHAR(20) CHECK (status IN ('pass', 'warn', 'fail')),
    measured_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    measurement_context JSONB
);

-- ============================================================================
-- PILLAR 5: RISK CULTURE & TRAINING TABLES
-- ============================================================================

-- Training programs and completion
CREATE TABLE governance.training_programs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_name VARCHAR(255),
    program_type VARCHAR(100),
    target_roles TEXT[],
    content_modules JSONB,
    duration_hours INTEGER,
    certification_required BOOLEAN DEFAULT false,
    validity_period_months INTEGER DEFAULT 12,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Individual training records
CREATE TABLE governance.training_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255),
    program_id UUID REFERENCES governance.training_programs(id),
    enrollment_date DATE,
    completion_date DATE,
    score DECIMAL(5,2),
    certification_earned BOOLEAN DEFAULT false,
    certification_expiry DATE,
    next_recertification_due DATE,
    training_feedback JSONB
);

-- VR simulation results
CREATE TABLE governance.vr_simulation_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255),
    simulation_scenario VARCHAR(255),
    completion_time_minutes INTEGER,
    decisions_made JSONB,
    performance_score DECIMAL(5,2),
    areas_for_improvement TEXT[],
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- CROSS-PILLAR SHARED TABLES
-- ============================================================================

-- Comprehensive audit trail for all governance events
CREATE TABLE governance.audit_trail (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    event_type VARCHAR(100),
    service_name VARCHAR(100),
    user_id VARCHAR(255),
    session_id VARCHAR(255),
    request_id VARCHAR(255),
    client_ip INET,
    user_agent TEXT,
    event_data JSONB,
    governance_pillar INTEGER CHECK (governance_pillar >= 1 AND governance_pillar <= 15),
    compliance_relevant BOOLEAN DEFAULT false,
    retention_period_days INTEGER DEFAULT 2555
);

-- Governance metrics and KPIs
CREATE TABLE governance.governance_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_name VARCHAR(100),
    metric_category VARCHAR(50),
    metric_value DECIMAL(15,4),
    metric_unit VARCHAR(20),
    pillar_id INTEGER CHECK (pillar_id >= 1 AND pillar_id <= 15),
    service_name VARCHAR(100),
    measurement_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    tags JSONB,
    metadata JSONB
);

-- Compliance evidence repository
CREATE TABLE governance.compliance_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evidence_type VARCHAR(100),
    compliance_framework VARCHAR(100), -- 'ISO42001', 'GDPR', 'EU_AI_Act', etc.
    requirement_id VARCHAR(100),
    evidence_data JSONB,
    evidence_file_path VARCHAR(500),
    collected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    valid_until DATE,
    verification_status VARCHAR(50) DEFAULT 'pending',
    verified_by VARCHAR(255),
    verified_at TIMESTAMP WITH TIME ZONE
);

-- Governance notifications and alerts
CREATE TABLE governance.governance_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_type VARCHAR(100),
    severity VARCHAR(20) CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info')),
    title VARCHAR(500),
    description TEXT,
    affected_systems TEXT[],
    pillar_id INTEGER CHECK (pillar_id >= 1 AND pillar_id <= 15),
    triggered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    acknowledged_by VARCHAR(255),
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolution_notes TEXT,
    notification_channels TEXT[] DEFAULT ARRAY['email', 'slack']
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Audit trail indexes
CREATE INDEX idx_audit_trail_timestamp ON governance.audit_trail(event_timestamp);
CREATE INDEX idx_audit_trail_service ON governance.audit_trail(service_name);
CREATE INDEX idx_audit_trail_type ON governance.audit_trail(event_type);

-- Metrics indexes
CREATE INDEX idx_governance_metrics_name ON governance.governance_metrics(metric_name);
CREATE INDEX idx_governance_metrics_timestamp ON governance.governance_metrics(measurement_timestamp);

-- Grant appropriate permissions
GRANT USAGE ON SCHEMA governance TO aerofusionxr_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA governance TO aerofusionxr_app;

COMMENT ON SCHEMA governance IS 'AeroFusionXR AI Governance Platform - Database schema for 15-pillar governance framework';

-- ============================================================================
-- FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Function to automatically update updated_at timestamps
CREATE OR REPLACE FUNCTION governance.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_maturity_assessments_updated_at 
    BEFORE UPDATE ON governance.maturity_assessments 
    FOR EACH ROW EXECUTE FUNCTION governance.update_updated_at_column();

CREATE TRIGGER update_audit_schedules_updated_at 
    BEFORE UPDATE ON governance.audit_schedules 
    FOR EACH ROW EXECUTE FUNCTION governance.update_updated_at_column();

CREATE TRIGGER update_training_programs_updated_at 
    BEFORE UPDATE ON governance.training_programs 
    FOR EACH ROW EXECUTE FUNCTION governance.update_updated_at_column();

-- Function to automatically archive old audit trail records
CREATE OR REPLACE FUNCTION governance.archive_old_audit_records()
RETURNS INTEGER AS $$
DECLARE
    archived_count INTEGER;
BEGIN
    -- Move records older than retention period to archive table
    WITH archived AS (
        DELETE FROM governance.audit_trail 
        WHERE event_timestamp < NOW() - INTERVAL '1 day' * retention_period_days
        RETURNING *
    )
    INSERT INTO governance.audit_trail_archive 
    SELECT * FROM archived;
    
    GET DIAGNOSTICS archived_count = ROW_COUNT;
    RETURN archived_count;
END;
$$ LANGUAGE plpgsql;

-- Create archive table for audit trail
CREATE TABLE governance.audit_trail_archive (
    LIKE governance.audit_trail INCLUDING ALL
);

-- ============================================================================
-- INITIAL DATA AND CONFIGURATION
-- ============================================================================

-- Insert initial maturity assessment framework
INSERT INTO governance.maturity_assessments (
    assessment_date,
    overall_score,
    level_achieved,
    assessor_id,
    assessment_type,
    dimensions
) VALUES (
    NOW(),
    4.9,
    2,
    'system',
    'baseline',
    '{
        "policy_strategy": 6,
        "processes_procedures": 6,
        "technology_tools": 6,
        "people_culture": 4,
        "data_quality_lineage": 3,
        "risk_management": 5,
        "compliance_audit": 6,
        "innovation_improvement": 4
    }'::jsonb
);

-- Insert initial training programs
INSERT INTO governance.training_programs (
    program_name,
    program_type,
    target_roles,
    content_modules,
    duration_hours,
    certification_required
) VALUES 
(
    'AI Governance Fundamentals',
    'mandatory',
    ARRAY['developer', 'data_scientist', 'product_manager'],
    '{"modules": ["ethics", "bias_detection", "compliance", "risk_management"]}'::jsonb,
    8,
    true
),
(
    'Executive AI Leadership',
    'executive',
    ARRAY['executive', 'director', 'vp'],
    '{"modules": ["strategic_governance", "regulatory_landscape", "risk_oversight"]}'::jsonb,
    4,
    true
);

-- Grant appropriate permissions
GRANT USAGE ON SCHEMA governance TO aerofusionxr_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA governance TO aerofusionxr_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA governance TO aerofusionxr_app;

-- Create read-only role for governance reporting
CREATE ROLE governance_reader;
GRANT USAGE ON SCHEMA governance TO governance_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA governance TO governance_reader;

COMMENT ON SCHEMA governance IS 'AeroFusionXR AI Governance Platform - Database schema for 15-pillar governance framework';
COMMENT ON TABLE governance.audit_trail IS 'Comprehensive audit trail for all governance events across all 15 pillars';
COMMENT ON TABLE governance.maturity_assessments IS 'Pillar 1: Governance maturity model assessments and scoring';
COMMENT ON TABLE governance.bias_detections IS 'Pillar 3: Real-time bias detection results from AI services';
COMMENT ON TABLE governance.data_lineage IS 'Pillar 4: End-to-end data lineage tracking for governance';
COMMENT ON TABLE governance.training_records IS 'Pillar 5: Individual training completion and certification records'; 