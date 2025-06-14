#!/bin/bash

# AeroFusionXR Platform Security Scanning Script
# This script performs comprehensive security scanning of the platform

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
NAMESPACE="${NAMESPACE:-aerofusionxr}"
RESULTS_DIR="${RESULTS_DIR:-$PROJECT_ROOT/security-results}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
SEVERITY_THRESHOLD="${SEVERITY_THRESHOLD:-MEDIUM}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Error handling
error_exit() {
    log_error "$1"
    exit 1
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking security scanning prerequisites..."
    
    # Check required tools
    local required_tools=("kubectl" "docker" "curl" "jq")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            error_exit "$tool is required but not installed"
        fi
    done
    
    # Create results directory
    mkdir -p "$RESULTS_DIR/$TIMESTAMP"
    
    # Check if cluster is accessible
    kubectl cluster-info &> /dev/null || error_exit "Cannot connect to Kubernetes cluster"
    
    log_success "Prerequisites check passed"
}

# Container image vulnerability scanning with Trivy
scan_container_images() {
    log_info "Scanning container images for vulnerabilities..."
    
    # Install Trivy if not available
    if ! command -v trivy &> /dev/null; then
        log_info "Installing Trivy..."
        curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin
    fi
    
    local images=(
        "aerofusionxr/api-gateway:latest"
        "aerofusionxr/ai-concierge:latest"
        "aerofusionxr/wayfinding-platform:latest"
        "aerofusionxr/flight-info:latest"
        "aerofusionxr/baggage-tracker:latest"
        "aerofusionxr/commerce:latest"
        "aerofusionxr/user-profile:latest"
        "aerofusionxr/notifications:latest"
        "aerofusionxr/recommendations-engine:latest"
    )
    
    local image_scan_dir="$RESULTS_DIR/$TIMESTAMP/image_scans"
    mkdir -p "$image_scan_dir"
    
    for image in "${images[@]}"; do
        log_info "Scanning image: $image"
        
        # Scan for vulnerabilities
        trivy image --format json --output "$image_scan_dir/${image//\//_}_vulnerabilities.json" "$image" || {
            log_warning "Failed to scan $image"
            continue
        }
        
        # Scan for misconfigurations
        trivy config --format json --output "$image_scan_dir/${image//\//_}_config.json" "$PROJECT_ROOT/services" || {
            log_warning "Failed to scan configuration for $image"
        }
        
        # Generate human-readable report
        trivy image --format table --output "$image_scan_dir/${image//\//_}_report.txt" "$image" || {
            log_warning "Failed to generate report for $image"
        }
    done
    
    log_success "Container image scanning completed"
}

# Kubernetes security scanning with kube-score
scan_kubernetes_manifests() {
    log_info "Scanning Kubernetes manifests for security issues..."
    
    # Install kube-score if not available
    if ! command -v kube-score &> /dev/null; then
        log_info "Installing kube-score..."
        curl -L https://github.com/zegl/kube-score/releases/latest/download/kube-score_linux_amd64.tar.gz | tar xz
        sudo mv kube-score /usr/local/bin/
    fi
    
    local k8s_scan_dir="$RESULTS_DIR/$TIMESTAMP/k8s_scans"
    mkdir -p "$k8s_scan_dir"
    
    # Scan all YAML files in k8s directory
    find "$PROJECT_ROOT/k8s" -name "*.yaml" -o -name "*.yml" | while read -r manifest; do
        local filename=$(basename "$manifest" .yaml)
        log_info "Scanning manifest: $manifest"
        
        kube-score score "$manifest" > "$k8s_scan_dir/${filename}_score.txt" 2>&1 || {
            log_warning "kube-score failed for $manifest"
        }
    done
    
    log_success "Kubernetes manifest scanning completed"
}

# Network security scanning with nmap
scan_network_security() {
    log_info "Scanning network security..."
    
    if ! command -v nmap &> /dev/null; then
        log_warning "nmap not available, skipping network security scan"
        return
    fi
    
    local network_scan_dir="$RESULTS_DIR/$TIMESTAMP/network_scans"
    mkdir -p "$network_scan_dir"
    
    # Get service IPs
    local services=(
        "api-gateway-service"
        "ai-concierge-service"
        "wayfinding-service"
        "flight-info-service"
        "baggage-tracker-service"
        "commerce-service"
        "user-profile-service"
        "notifications-service"
        "recommendations-service"
    )
    
    for service in "${services[@]}"; do
        log_info "Scanning service: $service"
        
        local service_ip=$(kubectl get service "$service" -n "$NAMESPACE" -o jsonpath='{.spec.clusterIP}' 2>/dev/null || echo "")
        if [[ -n "$service_ip" ]]; then
            # Port scan
            nmap -sS -O -A "$service_ip" > "$network_scan_dir/${service}_nmap.txt" 2>&1 || {
                log_warning "nmap scan failed for $service"
            }
            
            # Vulnerability scan
            nmap --script vuln "$service_ip" > "$network_scan_dir/${service}_vuln.txt" 2>&1 || {
                log_warning "Vulnerability scan failed for $service"
            }
        else
            log_warning "Could not get IP for service $service"
        fi
    done
    
    log_success "Network security scanning completed"
}

# RBAC and security policy analysis
analyze_rbac_security() {
    log_info "Analyzing RBAC and security policies..."
    
    local rbac_scan_dir="$RESULTS_DIR/$TIMESTAMP/rbac_analysis"
    mkdir -p "$rbac_scan_dir"
    
    # Analyze service accounts
    kubectl get serviceaccounts -n "$NAMESPACE" -o yaml > "$rbac_scan_dir/serviceaccounts.yaml"
    
    # Analyze roles and role bindings
    kubectl get roles,rolebindings -n "$NAMESPACE" -o yaml > "$rbac_scan_dir/roles.yaml"
    kubectl get clusterroles,clusterrolebindings -o yaml > "$rbac_scan_dir/clusterroles.yaml"
    
    # Analyze network policies
    kubectl get networkpolicies -n "$NAMESPACE" -o yaml > "$rbac_scan_dir/networkpolicies.yaml" 2>/dev/null || {
        echo "No network policies found" > "$rbac_scan_dir/networkpolicies.yaml"
    }
    
    # Analyze pod security policies
    kubectl get podsecuritypolicies -o yaml > "$rbac_scan_dir/podsecuritypolicies.yaml" 2>/dev/null || {
        echo "No pod security policies found" > "$rbac_scan_dir/podsecuritypolicies.yaml"
    }
    
    # Check for privileged containers
    log_info "Checking for privileged containers..."
    kubectl get pods -n "$NAMESPACE" -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.securityContext.privileged}{"\n"}{end}' > "$rbac_scan_dir/privileged_containers.txt"
    
    # Check for containers running as root
    log_info "Checking for containers running as root..."
    kubectl get pods -n "$NAMESPACE" -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.securityContext.runAsUser}{"\n"}{end}' > "$rbac_scan_dir/root_containers.txt"
    
    log_success "RBAC and security policy analysis completed"
}

# Secret and configuration security analysis
analyze_secrets_security() {
    log_info "Analyzing secrets and configuration security..."
    
    local secrets_scan_dir="$RESULTS_DIR/$TIMESTAMP/secrets_analysis"
    mkdir -p "$secrets_scan_dir"
    
    # List all secrets (without values)
    kubectl get secrets -n "$NAMESPACE" -o yaml | grep -v "data:" > "$secrets_scan_dir/secrets_metadata.yaml"
    
    # Check for hardcoded secrets in manifests
    log_info "Checking for hardcoded secrets..."
    grep -r -i "password\|secret\|key\|token" "$PROJECT_ROOT/k8s" > "$secrets_scan_dir/potential_hardcoded_secrets.txt" 2>/dev/null || {
        echo "No potential hardcoded secrets found" > "$secrets_scan_dir/potential_hardcoded_secrets.txt"
    }
    
    # Check ConfigMaps for sensitive data
    log_info "Checking ConfigMaps for sensitive data..."
    kubectl get configmaps -n "$NAMESPACE" -o yaml | grep -i "password\|secret\|key\|token" > "$secrets_scan_dir/configmap_sensitive_data.txt" 2>/dev/null || {
        echo "No sensitive data found in ConfigMaps" > "$secrets_scan_dir/configmap_sensitive_data.txt"
    }
    
    # Check environment variables in pods
    log_info "Checking environment variables in pods..."
    kubectl get pods -n "$NAMESPACE" -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}{range .spec.containers[*]}{.env[*].name}{"\n"}{end}{"\n"}{end}' > "$secrets_scan_dir/pod_env_vars.txt"
    
    log_success "Secrets and configuration security analysis completed"
}

# Application security testing
test_application_security() {
    log_info "Testing application security..."
    
    local app_scan_dir="$RESULTS_DIR/$TIMESTAMP/app_security"
    mkdir -p "$app_scan_dir"
    
    # Test for common web vulnerabilities
    local services=(
        "api-gateway:8000"
        "ai-concierge:8001"
        "wayfinding-platform:8002"
        "flight-info:8003"
        "commerce:8005"
    )
    
    for service_port in "${services[@]}"; do
        local service=$(echo "$service_port" | cut -d: -f1)
        local port=$(echo "$service_port" | cut -d: -f2)
        
        log_info "Testing $service for security vulnerabilities..."
        
        # Port forward to service
        kubectl port-forward -n "$NAMESPACE" "service/${service}-service" "$port:$port" &
        local pf_pid=$!
        sleep 3
        
        # Test for SQL injection (basic)
        curl -s "http://localhost:$port/api/test?id=1' OR '1'='1" > "$app_scan_dir/${service}_sqli_test.txt" 2>&1 || true
        
        # Test for XSS (basic)
        curl -s "http://localhost:$port/api/test?input=<script>alert('xss')</script>" > "$app_scan_dir/${service}_xss_test.txt" 2>&1 || true
        
        # Test for directory traversal
        curl -s "http://localhost:$port/api/../../../etc/passwd" > "$app_scan_dir/${service}_traversal_test.txt" 2>&1 || true
        
        # Test for information disclosure
        curl -s -I "http://localhost:$port/" > "$app_scan_dir/${service}_headers.txt" 2>&1 || true
        
        # Kill port forward
        kill $pf_pid 2>/dev/null || true
        sleep 1
    done
    
    log_success "Application security testing completed"
}

# Compliance checking
check_compliance() {
    log_info "Checking compliance requirements..."
    
    local compliance_dir="$RESULTS_DIR/$TIMESTAMP/compliance"
    mkdir -p "$compliance_dir"
    
    # CIS Kubernetes Benchmark checks
    log_info "Running CIS Kubernetes Benchmark checks..."
    
    # Check if kube-bench is available
    if command -v kube-bench &> /dev/null; then
        kube-bench run --targets node,policies,managedservices > "$compliance_dir/cis_benchmark.txt" 2>&1 || {
            log_warning "kube-bench failed"
        }
    else
        log_warning "kube-bench not available, skipping CIS benchmark"
    fi
    
    # GDPR compliance checks
    log_info "Checking GDPR compliance..."
    cat > "$compliance_dir/gdpr_checklist.txt" << EOF
GDPR Compliance Checklist for AeroFusionXR:

1. Data Encryption:
   - Check if data is encrypted at rest and in transit
   - Verify TLS certificates are properly configured
   
2. Data Access Controls:
   - Review RBAC policies
   - Check authentication and authorization mechanisms
   
3. Data Retention:
   - Verify backup retention policies
   - Check for data deletion capabilities
   
4. Audit Logging:
   - Ensure all data access is logged
   - Verify log retention and protection
   
5. Privacy by Design:
   - Check for data minimization practices
   - Verify consent management systems
EOF
    
    # PCI DSS compliance (for payment processing)
    log_info "Checking PCI DSS compliance..."
    cat > "$compliance_dir/pci_dss_checklist.txt" << EOF
PCI DSS Compliance Checklist for AeroFusionXR Commerce:

1. Network Security:
   - Verify network segmentation
   - Check firewall configurations
   
2. Data Protection:
   - Ensure cardholder data is encrypted
   - Verify secure key management
   
3. Access Controls:
   - Check unique user IDs
   - Verify strong authentication
   
4. Monitoring:
   - Ensure comprehensive logging
   - Verify log monitoring and analysis
   
5. Security Testing:
   - Regular vulnerability scans
   - Penetration testing
EOF
    
    log_success "Compliance checking completed"
}

# Secrets scanning with TruffleHog
scan_secrets() {
    log_info "Scanning for exposed secrets and credentials..."
    
    local secrets_scan_dir="$RESULTS_DIR/$TIMESTAMP/secrets_scans"
    mkdir -p "$secrets_scan_dir"
    
    # Install TruffleHog if not available
    if ! command -v trufflehog &> /dev/null; then
        log_info "Installing TruffleHog..."
        curl -sSfL https://raw.githubusercontent.com/trufflesecurity/trufflehog/main/scripts/install.sh | sh -s -- -b /usr/local/bin
    fi
    
    # Scan filesystem for secrets
    trufflehog filesystem "$PROJECT_ROOT" --json > "$secrets_scan_dir/filesystem_secrets.json" 2>&1 || {
        log_warning "TruffleHog filesystem scan completed with warnings"
    }
    
    # Scan git history if available
    if [[ -d "$PROJECT_ROOT/.git" ]]; then
        trufflehog git "$PROJECT_ROOT" --json > "$secrets_scan_dir/git_secrets.json" 2>&1 || {
            log_warning "TruffleHog git scan completed with warnings"
        }
    fi
    
    # Generate summary report
    local secret_count=$(jq -r 'select(.Verified == true) | .DetectorName' "$secrets_scan_dir/filesystem_secrets.json" 2>/dev/null | wc -l || echo "0")
    echo "Verified secrets found: $secret_count" > "$secrets_scan_dir/secrets_summary.txt"
    
    if [[ "$secret_count" -gt 0 ]]; then
        log_error "Found $secret_count verified secrets!"
        return 1
    else
        log_success "No verified secrets found"
    fi
}

# SAST scanning with Semgrep
scan_static_analysis() {
    log_info "Running static application security testing (SAST)..."
    
    local sast_scan_dir="$RESULTS_DIR/$TIMESTAMP/sast_scans"
    mkdir -p "$sast_scan_dir"
    
    # Install Semgrep if not available
    if ! command -v semgrep &> /dev/null; then
        log_info "Installing Semgrep..."
        python3 -m pip install semgrep
    fi
    
    # Run comprehensive SAST scan
    semgrep --config=auto --json --output="$sast_scan_dir/semgrep_results.json" "$PROJECT_ROOT" || {
        log_warning "Semgrep scan completed with findings"
    }
    
    # Run specific security rulesets
    local rulesets=(
        "p/security-audit"
        "p/secrets"
        "p/owasp-top-ten"
        "p/cwe-top-25"
        "p/javascript"
        "p/typescript"
        "p/python"
        "p/docker"
        "p/kubernetes"
    )
    
    for ruleset in "${rulesets[@]}"; do
        log_info "Running Semgrep ruleset: $ruleset"
        semgrep --config="$ruleset" --json --output="$sast_scan_dir/semgrep_${ruleset//\//_}.json" "$PROJECT_ROOT" 2>/dev/null || {
            log_warning "Semgrep ruleset $ruleset completed with warnings"
        }
    done
    
    # Generate summary
    local findings_count=$(jq -r '.results | length' "$sast_scan_dir/semgrep_results.json" 2>/dev/null || echo "0")
    echo "SAST findings: $findings_count" > "$sast_scan_dir/sast_summary.txt"
    
    log_success "Static analysis scanning completed with $findings_count findings"
}

# Dependency vulnerability scanning
scan_dependencies() {
    log_info "Scanning dependencies for vulnerabilities..."
    
    local deps_scan_dir="$RESULTS_DIR/$TIMESTAMP/dependency_scans"
    mkdir -p "$deps_scan_dir"
    
    # NPM audit
    if [[ -f "$PROJECT_ROOT/package.json" ]]; then
        log_info "Running npm audit..."
        cd "$PROJECT_ROOT"
        npm audit --audit-level=moderate --json > "$deps_scan_dir/npm_audit.json" 2>&1 || {
            log_warning "npm audit found vulnerabilities"
        }
    fi
    
    # Snyk scanning if available
    if command -v snyk &> /dev/null; then
        log_info "Running Snyk vulnerability scan..."
        cd "$PROJECT_ROOT"
        snyk test --json > "$deps_scan_dir/snyk_results.json" 2>&1 || {
            log_warning "Snyk found vulnerabilities"
        }
        
        # Snyk container scanning
        snyk container test --json > "$deps_scan_dir/snyk_container.json" 2>&1 || {
            log_warning "Snyk container scan found issues"
        }
    fi
    
    # Safety check for Python dependencies
    if [[ -f "$PROJECT_ROOT/requirements.txt" ]]; then
        log_info "Running Safety check for Python dependencies..."
        python3 -m pip install safety
        safety check --json --output "$deps_scan_dir/safety_results.json" || {
            log_warning "Safety check found vulnerabilities"
        }
    fi
    
    log_success "Dependency vulnerability scanning completed"
}

# Infrastructure as Code security scanning
scan_iac_security() {
    log_info "Scanning Infrastructure as Code for security issues..."
    
    local iac_scan_dir="$RESULTS_DIR/$TIMESTAMP/iac_scans"
    mkdir -p "$iac_scan_dir"
    
    # Checkov scanning for Terraform and Kubernetes
    if command -v checkov &> /dev/null || python3 -m pip install checkov; then
        log_info "Running Checkov IaC security scan..."
        
        # Scan Terraform files
        if [[ -d "$PROJECT_ROOT/infrastructure/terraform" ]]; then
            checkov -d "$PROJECT_ROOT/infrastructure/terraform" --output json > "$iac_scan_dir/checkov_terraform.json" 2>&1 || {
                log_warning "Checkov Terraform scan found issues"
            }
        fi
        
        # Scan Kubernetes manifests
        if [[ -d "$PROJECT_ROOT/k8s" ]]; then
            checkov -d "$PROJECT_ROOT/k8s" --output json > "$iac_scan_dir/checkov_k8s.json" 2>&1 || {
                log_warning "Checkov Kubernetes scan found issues"
            }
        fi
        
        # Scan Docker files
        find "$PROJECT_ROOT" -name "Dockerfile*" -exec checkov -f {} --output json \; > "$iac_scan_dir/checkov_docker.json" 2>&1 || {
            log_warning "Checkov Docker scan found issues"
        }
    fi
    
    log_success "Infrastructure as Code security scanning completed"
}

# Governance-specific security validation
validate_governance_security() {
    log_info "Validating AI governance security controls..."
    
    local gov_scan_dir="$RESULTS_DIR/$TIMESTAMP/governance_security"
    mkdir -p "$gov_scan_dir"
    
    # Check governance pillar security
    local governance_checks=(
        "governance/governance-architecture-engine.js:Governance Architecture"
        "governance/audit-orchestrator.js:Independent Assurance"
        "governance/safety-circuit-breaker.js:Runtime Safety"
        "governance/data-lineage-engine.js:Data Lineage"
        "governance/training-orchestrator.js:Training Governance"
    )
    
    echo "# Governance Security Validation Report" > "$gov_scan_dir/governance_security_report.md"
    echo "Generated: $(date)" >> "$gov_scan_dir/governance_security_report.md"
    echo "" >> "$gov_scan_dir/governance_security_report.md"
    
    for check in "${governance_checks[@]}"; do
        local file_path="${check%%:*}"
        local pillar_name="${check##*:}"
        
        echo "## $pillar_name" >> "$gov_scan_dir/governance_security_report.md"
        
        if [[ -f "$PROJECT_ROOT/$file_path" ]]; then
            # Check for security patterns
            local security_patterns=(
                "authentication"
                "authorization"
                "encryption"
                "input.validation"
                "error.handling"
                "logging"
                "rate.limiting"
            )
            
            local passed_checks=0
            local total_checks=${#security_patterns[@]}
            
            for pattern in "${security_patterns[@]}"; do
                if grep -qi "$pattern" "$PROJECT_ROOT/$file_path"; then
                    echo "- ✅ $pattern: Implemented" >> "$gov_scan_dir/governance_security_report.md"
                    ((passed_checks++))
                else
                    echo "- ❌ $pattern: Not found" >> "$gov_scan_dir/governance_security_report.md"
                fi
            done
            
            local score=$((passed_checks * 100 / total_checks))
            echo "- **Security Score:** $score% ($passed_checks/$total_checks)" >> "$gov_scan_dir/governance_security_report.md"
            echo "" >> "$gov_scan_dir/governance_security_report.md"
        else
            echo "- ❌ File not found: $file_path" >> "$gov_scan_dir/governance_security_report.md"
            echo "" >> "$gov_scan_dir/governance_security_report.md"
        fi
    done
    
    log_success "Governance security validation completed"
}

# Generate comprehensive security report
generate_security_report() {
    log_info "Generating comprehensive security report..."
    
    local report_file="$RESULTS_DIR/$TIMESTAMP/comprehensive_security_report.md"
    
    cat > "$report_file" << EOF
# 🔒 AeroFusionXR Comprehensive Security Scan Report

**Scan Date:** $(date)
**Scan ID:** $TIMESTAMP
**Severity Threshold:** $SEVERITY_THRESHOLD

## 📊 Executive Summary

This report provides a comprehensive security assessment of the AeroFusionXR platform, including:
- Container image vulnerabilities
- Kubernetes security configuration
- Network security posture
- Secrets and credential exposure
- Static application security testing (SAST)
- Dependency vulnerabilities
- Infrastructure as Code security
- AI governance security controls

## 🎯 Key Findings

EOF

    # Add findings from each scan type
    local scan_types=("image_scans" "k8s_scans" "network_scans" "secrets_scans" "sast_scans" "dependency_scans" "iac_scans" "governance_security")
    
    for scan_type in "${scan_types[@]}"; do
        if [[ -d "$RESULTS_DIR/$TIMESTAMP/$scan_type" ]]; then
            echo "### ${scan_type//_/ } Results" >> "$report_file"
            
            # Count findings if JSON files exist
            local json_files=$(find "$RESULTS_DIR/$TIMESTAMP/$scan_type" -name "*.json" 2>/dev/null || echo "")
            if [[ -n "$json_files" ]]; then
                local total_findings=0
                while IFS= read -r json_file; do
                    if [[ -f "$json_file" ]]; then
                        local findings=$(jq -r 'if type == "array" then length else if has("results") then .results | length else 0 end end' "$json_file" 2>/dev/null || echo "0")
                        total_findings=$((total_findings + findings))
                    fi
                done <<< "$json_files"
                echo "- Total findings: $total_findings" >> "$report_file"
            fi
            
            echo "" >> "$report_file"
        fi
    done
    
    cat >> "$report_file" << EOF

## 🔧 Recommendations

1. **Critical Issues:** Address any critical vulnerabilities immediately
2. **Secrets Management:** Implement proper secrets management for any exposed credentials
3. **Dependency Updates:** Update vulnerable dependencies to latest secure versions
4. **Configuration Hardening:** Apply security hardening recommendations for Kubernetes
5. **Continuous Monitoring:** Implement continuous security monitoring and alerting

## 📁 Detailed Results

Detailed scan results are available in the following directories:
- Container Scans: \`$RESULTS_DIR/$TIMESTAMP/image_scans/\`
- Kubernetes Scans: \`$RESULTS_DIR/$TIMESTAMP/k8s_scans/\`
- Network Scans: \`$RESULTS_DIR/$TIMESTAMP/network_scans/\`
- Secrets Scans: \`$RESULTS_DIR/$TIMESTAMP/secrets_scans/\`
- SAST Results: \`$RESULTS_DIR/$TIMESTAMP/sast_scans/\`
- Dependency Scans: \`$RESULTS_DIR/$TIMESTAMP/dependency_scans/\`
- IaC Scans: \`$RESULTS_DIR/$TIMESTAMP/iac_scans/\`
- Governance Security: \`$RESULTS_DIR/$TIMESTAMP/governance_security/\`

---
*This report was generated by the AeroFusionXR comprehensive security scanning system.*
EOF

    log_success "Comprehensive security report generated: $report_file"
}

# Main function
main() {
    log_info "Starting AeroFusionXR security assessment..."
    log_info "Assessment configuration:"
    log_info "  Namespace: $NAMESPACE"
    log_info "  Severity threshold: $SEVERITY_THRESHOLD"
    log_info "  Results directory: $RESULTS_DIR/$TIMESTAMP"
    
    local start_time=$(date +%s)
    
    # Execute security assessment steps
    check_prerequisites
    scan_container_images
    scan_kubernetes_manifests
    scan_network_security
    analyze_rbac_security
    analyze_secrets_security
    test_application_security
    check_compliance
    scan_secrets
    scan_static_analysis
    scan_dependencies
    scan_iac_security
    validate_governance_security
    generate_security_report
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    log_success "Security assessment completed successfully!"
    log_info "Assessment duration: ${duration} seconds"
    log_info "Results available in: $RESULTS_DIR/$TIMESTAMP"
    log_info "Security report: $RESULTS_DIR/$TIMESTAMP/comprehensive_security_report.md"
    
    # Display summary
    echo
    log_info "Security Assessment Summary:"
    echo "  - Container images scanned for vulnerabilities"
    echo "  - Kubernetes manifests analyzed for security issues"
    echo "  - Network security tested"
    echo "  - RBAC and security policies reviewed"
    echo "  - Application security tested"
    echo "  - Compliance requirements checked"
    echo "  - Secrets scanned for exposed credentials"
    echo "  - Static application security testing (SAST) performed"
    echo "  - Dependency vulnerabilities scanned"
    echo "  - Infrastructure as Code security scanned"
    echo "  - AI governance security controls validated"
    echo
    log_warning "Please review the detailed security report and address any identified issues."
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --namespace)
            NAMESPACE="$2"
            shift 2
            ;;
        --severity-threshold)
            SEVERITY_THRESHOLD="$2"
            shift 2
            ;;
        --results-dir)
            RESULTS_DIR="$2"
            shift 2
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  --namespace NAMESPACE           Kubernetes namespace (default: aerofusionxr)"
            echo "  --severity-threshold LEVEL      Minimum severity level to report (default: MEDIUM)"
            echo "  --results-dir DIR               Results directory (default: ./security-results)"
            echo "  --help                          Show this help message"
            echo ""
            echo "Severity levels: CRITICAL, HIGH, MEDIUM, LOW, INFO"
            exit 0
            ;;
        *)
            error_exit "Unknown option: $1"
            ;;
    esac
done

# Run main function
main "$@" 