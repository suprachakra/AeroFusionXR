package ai.governance

import rego.v1

# =============================================================================
# AI Governance Policy-as-Code for AeroFusionXR
# Enforces governance gates in CI/CD pipeline
# =============================================================================

# Gate A: DPIA Completion Validation
deny contains msg if {
    # Check if this is an AI service deployment
    is_ai_service
    
    # Check if DPIA file exists
    not dpia_exists
    
    msg := "DPIA missing: AI services require Data Protection Impact Assessment. Please add governance/compliance/dpia-{service_name}.md"
}

# Gate B: Model Card Validation
deny contains msg if {
    # Check if this is an ML model deployment
    is_ml_model_deployment
    
    # Check if model card exists and is complete
    not model_card_complete
    
    msg := "Model card incomplete: Please ensure governance/frameworks/model-cards/{model_name}.md contains all required sections"
}

# Gate C: Bias Audit Validation
deny contains msg if {
    # Check if this involves ML models
    is_ml_model_deployment
    
    # Check if bias audit has been completed
    not bias_audit_passed
    
    msg := "Bias audit required: Please run bias tests and add 'bias-audit:passed' label after successful validation"
}

# Gate D: Security Review Validation
deny contains msg if {
    # Check if this is a production deployment
    is_production_deployment
    
    # Check if security review is complete
    not security_review_complete
    
    msg := "Security review incomplete: Production AI deployments require security sign-off in governance/compliance/security-review-{service_name}.md"
}

# =============================================================================
# Helper Functions
# =============================================================================

# Detect AI service based on file patterns
is_ai_service if {
    some file in input.files
    contains(file, "ai-concierge")
}

is_ai_service if {
    some file in input.files
    contains(file, "ml-model")
}

is_ai_service if {
    some file in input.files
    contains(file, "recommendations-engine")
}

# Detect ML model deployment
is_ml_model_deployment if {
    some file in input.files
    endswith(file, ".pkl")
}

is_ml_model_deployment if {
    some file in input.files
    endswith(file, ".joblib")
}

is_ml_model_deployment if {
    some file in input.files
    contains(file, "models/")
}

# Check if production deployment
is_production_deployment if {
    input.environment == "production"
}

is_production_deployment if {
    input.branch == "main"
}

# Validate DPIA exists
dpia_exists if {
    some file in input.files
    startswith(file, "governance/compliance/dpia-")
    endswith(file, ".md")
}

# Validate model card completeness
model_card_complete if {
    some file in input.files
    startswith(file, "governance/frameworks/model-cards/")
    endswith(file, ".md")
    
    # Check if model card has required sections
    model_card_content := input.file_contents[file]
    contains(model_card_content, "## Model Details")
    contains(model_card_content, "## Intended Use")
    contains(model_card_content, "## Training Data")
    contains(model_card_content, "## Evaluation Results")
    contains(model_card_content, "## Bias Analysis")
    contains(model_card_content, "## Ethical Considerations")
}

# Check bias audit status
bias_audit_passed if {
    some label in input.labels
    label == "bias-audit:passed"
}

bias_audit_passed if {
    some file in input.files
    startswith(file, "governance/compliance/bias-audit-")
    endswith(file, ".md")
    
    # Check if bias audit shows passing results
    audit_content := input.file_contents[file]
    contains(audit_content, "Status: PASSED")
}

# Check security review completion
security_review_complete if {
    some file in input.files
    startswith(file, "governance/compliance/security-review-")
    endswith(file, ".md")
    
    # Check if security review is approved
    review_content := input.file_contents[file]
    contains(review_content, "Security Approval: APPROVED")
}

# =============================================================================
# Warnings (Non-blocking but flagged)
# =============================================================================

warn contains msg if {
    is_ai_service
    not explainability_documented
    
    msg := "Warning: Consider documenting explainability measures for AI service transparency"
}

warn contains msg if {
    is_ml_model_deployment
    not performance_benchmarks_documented
    
    msg := "Warning: Performance benchmarks should be documented for model monitoring"
}

# Check explainability documentation
explainability_documented if {
    some file in input.files
    contains(file, "explainability")
}

explainability_documented if {
    some file in input.files
    model_card_content := input.file_contents[file]
    contains(model_card_content, "explainability")
}

# Check performance benchmarks
performance_benchmarks_documented if {
    some file in input.files
    model_card_content := input.file_contents[file]
    contains(model_card_content, "## Performance Metrics")
} 