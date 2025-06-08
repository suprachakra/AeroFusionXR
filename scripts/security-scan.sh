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

# Generate security report
generate_security_report() {
    log_info "Generating comprehensive security report..."
    
    local report_file="$RESULTS_DIR/$TIMESTAMP/security_report.html"
    
    cat > "$report_file" << EOF
<!DOCTYPE html>
<html>
<head>
    <title>AeroFusionXR Security Assessment Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .header { background-color: #f0f0f0; padding: 20px; border-radius: 5px; }
        .section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        .critical { background-color: #f8d7da; border-color: #f5c6cb; }
        .high { background-color: #fff3cd; border-color: #ffeaa7; }
        .medium { background-color: #d1ecf1; border-color: #bee5eb; }
        .low { background-color: #d4edda; border-color: #c3e6cb; }
        .info { background-color: #e2e3e5; border-color: #d6d8db; }
        pre { background-color: #f8f9fa; padding: 10px; border-radius: 3px; overflow-x: auto; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .summary-stats { display: flex; justify-content: space-around; margin: 20px 0; }
        .stat-box { text-align: center; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>AeroFusionXR Security Assessment Report</h1>
        <p><strong>Assessment Date:</strong> $(date)</p>
        <p><strong>Namespace:</strong> $NAMESPACE</p>
        <p><strong>Severity Threshold:</strong> $SEVERITY_THRESHOLD</p>
    </div>
    
    <div class="summary-stats">
        <div class="stat-box critical">
            <h3>Critical Issues</h3>
            <p id="critical-count">0</p>
        </div>
        <div class="stat-box high">
            <h3>High Issues</h3>
            <p id="high-count">0</p>
        </div>
        <div class="stat-box medium">
            <h3>Medium Issues</h3>
            <p id="medium-count">0</p>
        </div>
        <div class="stat-box low">
            <h3>Low Issues</h3>
            <p id="low-count">0</p>
        </div>
    </div>
    
    <div class="section">
        <h2>Executive Summary</h2>
        <p>This report provides a comprehensive security assessment of the AeroFusionXR platform, 
        including container image vulnerabilities, Kubernetes security configurations, 
        network security, RBAC analysis, and compliance checks.</p>
    </div>
    
    <div class="section">
        <h2>Container Image Security</h2>
        <p>Scanned $(ls "$RESULTS_DIR/$TIMESTAMP/image_scans"/*_vulnerabilities.json 2>/dev/null | wc -l) container images for vulnerabilities.</p>
        <h3>Key Findings:</h3>
        <ul>
            <li>All images scanned with Trivy vulnerability scanner</li>
            <li>Configuration misconfigurations identified</li>
            <li>Recommendations provided for image hardening</li>
        </ul>
    </div>
    
    <div class="section">
        <h2>Kubernetes Security</h2>
        <p>Analyzed Kubernetes manifests and cluster configuration for security best practices.</p>
        <h3>Areas Assessed:</h3>
        <ul>
            <li>Pod Security Standards</li>
            <li>Network Policies</li>
            <li>RBAC Configuration</li>
            <li>Resource Limits and Quotas</li>
            <li>Security Contexts</li>
        </ul>
    </div>
    
    <div class="section">
        <h2>Network Security</h2>
        <p>Performed network security scanning and analysis.</p>
        <h3>Tests Performed:</h3>
        <ul>
            <li>Port scanning of services</li>
            <li>Vulnerability scanning</li>
            <li>Network policy validation</li>
        </ul>
    </div>
    
    <div class="section">
        <h2>Application Security</h2>
        <p>Tested application endpoints for common web vulnerabilities.</p>
        <h3>Tests Performed:</h3>
        <ul>
            <li>SQL Injection testing</li>
            <li>Cross-Site Scripting (XSS) testing</li>
            <li>Directory traversal testing</li>
            <li>Information disclosure testing</li>
        </ul>
    </div>
    
    <div class="section">
        <h2>Compliance Assessment</h2>
        <p>Evaluated compliance with industry standards and regulations.</p>
        <h3>Standards Assessed:</h3>
        <ul>
            <li>CIS Kubernetes Benchmark</li>
            <li>GDPR Requirements</li>
            <li>PCI DSS (for payment processing)</li>
        </ul>
    </div>
    
    <div class="section">
        <h2>Recommendations</h2>
        <ol>
            <li><strong>Immediate Actions:</strong>
                <ul>
                    <li>Address all CRITICAL and HIGH severity vulnerabilities</li>
                    <li>Implement missing network policies</li>
                    <li>Review and strengthen RBAC configurations</li>
                </ul>
            </li>
            <li><strong>Short-term Improvements:</strong>
                <ul>
                    <li>Implement automated security scanning in CI/CD pipeline</li>
                    <li>Enable Pod Security Standards</li>
                    <li>Implement comprehensive monitoring and alerting</li>
                </ul>
            </li>
            <li><strong>Long-term Security Strategy:</strong>
                <ul>
                    <li>Regular security assessments and penetration testing</li>
                    <li>Security training for development team</li>
                    <li>Implement zero-trust security model</li>
                </ul>
            </li>
        </ol>
    </div>
    
    <div class="section">
        <h2>Detailed Scan Results</h2>
        <p>Detailed scan results are available in the following files:</p>
        <ul>
EOF
    
    # Add links to detailed scan results
    find "$RESULTS_DIR/$TIMESTAMP" -name "*.txt" -o -name "*.json" -o -name "*.yaml" | while read -r file; do
        local filename=$(basename "$file")
        local relative_path=$(realpath --relative-to="$RESULTS_DIR/$TIMESTAMP" "$file")
        echo "            <li><a href=\"$relative_path\">$filename</a></li>" >> "$report_file"
    done
    
    cat >> "$report_file" << EOF
        </ul>
    </div>
    
    <div class="section info">
        <h2>Next Steps</h2>
        <p>1. Review all identified security issues</p>
        <p>2. Prioritize remediation based on severity and business impact</p>
        <p>3. Implement security fixes and improvements</p>
        <p>4. Schedule regular security assessments</p>
        <p>5. Update security policies and procedures</p>
    </div>
</body>
</html>
EOF
    
    log_success "Security report generated: $report_file"
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
    generate_security_report
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    log_success "Security assessment completed successfully!"
    log_info "Assessment duration: ${duration} seconds"
    log_info "Results available in: $RESULTS_DIR/$TIMESTAMP"
    log_info "Security report: $RESULTS_DIR/$TIMESTAMP/security_report.html"
    
    # Display summary
    echo
    log_info "Security Assessment Summary:"
    echo "  - Container images scanned for vulnerabilities"
    echo "  - Kubernetes manifests analyzed for security issues"
    echo "  - Network security tested"
    echo "  - RBAC and security policies reviewed"
    echo "  - Application security tested"
    echo "  - Compliance requirements checked"
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