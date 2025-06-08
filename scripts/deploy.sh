#!/bin/bash

# AeroFusionXR Platform Deployment Script
# This script deploys the entire AeroFusionXR platform to Kubernetes

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
NAMESPACE="${NAMESPACE:-aerofusionxr}"
ENVIRONMENT="${ENVIRONMENT:-production}"
KUBECTL_CONTEXT="${KUBECTL_CONTEXT:-}"
DRY_RUN="${DRY_RUN:-false}"
SKIP_BUILD="${SKIP_BUILD:-false}"
SKIP_TESTS="${SKIP_TESTS:-false}"

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
    log_info "Checking prerequisites..."
    
    # Check required tools
    local required_tools=("kubectl" "docker" "helm" "jq")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            error_exit "$tool is required but not installed"
        fi
    done
    
    # Check kubectl context
    if [[ -n "$KUBECTL_CONTEXT" ]]; then
        kubectl config use-context "$KUBECTL_CONTEXT" || error_exit "Failed to set kubectl context"
    fi
    
    # Verify cluster connectivity
    kubectl cluster-info &> /dev/null || error_exit "Cannot connect to Kubernetes cluster"
    
    log_success "Prerequisites check passed"
}

# Build Docker images
build_images() {
    if [[ "$SKIP_BUILD" == "true" ]]; then
        log_warning "Skipping image build"
        return
    fi
    
    log_info "Building Docker images..."
    
    local services=(
        "api-gateway"
        "ai-concierge"
        "wayfinding-platform"
        "flight-info"
        "baggage-tracker"
        "commerce"
        "user-profile"
        "notifications"
        "recommendations-engine"
    )
    
    for service in "${services[@]}"; do
        log_info "Building $service..."
        
        if [[ -f "$PROJECT_ROOT/services/$service/Dockerfile" ]]; then
            docker build \
                -t "aerofusionxr/$service:latest" \
                -t "aerofusionxr/$service:$ENVIRONMENT" \
                "$PROJECT_ROOT/services/$service" || error_exit "Failed to build $service"
        else
            log_warning "Dockerfile not found for $service, skipping..."
        fi
    done
    
    log_success "Docker images built successfully"
}

# Run tests
run_tests() {
    if [[ "$SKIP_TESTS" == "true" ]]; then
        log_warning "Skipping tests"
        return
    fi
    
    log_info "Running tests..."
    
    # Run unit tests
    cd "$PROJECT_ROOT"
    npm test || error_exit "Tests failed"
    
    # Run integration tests
    if [[ -f "$PROJECT_ROOT/scripts/integration-tests.sh" ]]; then
        "$PROJECT_ROOT/scripts/integration-tests.sh" || error_exit "Integration tests failed"
    fi
    
    log_success "All tests passed"
}

# Create namespace
create_namespace() {
    log_info "Creating namespace: $NAMESPACE"
    
    if kubectl get namespace "$NAMESPACE" &> /dev/null; then
        log_warning "Namespace $NAMESPACE already exists"
    else
        kubectl create namespace "$NAMESPACE" || error_exit "Failed to create namespace"
        log_success "Namespace $NAMESPACE created"
    fi
}

# Deploy infrastructure components
deploy_infrastructure() {
    log_info "Deploying infrastructure components..."
    
    # Apply namespace
    kubectl apply -f "$PROJECT_ROOT/k8s/namespace.yaml" ${DRY_RUN:+--dry-run=client}
    
    # Apply RBAC
    kubectl apply -f "$PROJECT_ROOT/k8s/rbac.yaml" ${DRY_RUN:+--dry-run=client}
    
    # Apply network policies
    kubectl apply -f "$PROJECT_ROOT/k8s/network-policies.yaml" ${DRY_RUN:+--dry-run=client}
    
    # Apply ConfigMaps
    kubectl apply -f "$PROJECT_ROOT/k8s/configmap.yaml" ${DRY_RUN:+--dry-run=client}
    
    # Apply Secrets (only if not dry run)
    if [[ "$DRY_RUN" != "true" ]]; then
        kubectl apply -f "$PROJECT_ROOT/k8s/secrets.yaml"
    fi
    
    log_success "Infrastructure components deployed"
}

# Deploy databases
deploy_databases() {
    log_info "Deploying databases..."
    
    # Deploy MongoDB
    helm repo add bitnami https://charts.bitnami.com/bitnami
    helm repo update
    
    helm upgrade --install mongodb bitnami/mongodb \
        --namespace "$NAMESPACE" \
        --set auth.rootPassword="$(kubectl get secret aerofusionxr-secrets -n $NAMESPACE -o jsonpath='{.data.MONGODB_PASSWORD}' | base64 -d)" \
        --set auth.username="$(kubectl get secret aerofusionxr-secrets -n $NAMESPACE -o jsonpath='{.data.MONGODB_USERNAME}' | base64 -d)" \
        --set auth.password="$(kubectl get secret aerofusionxr-secrets -n $NAMESPACE -o jsonpath='{.data.MONGODB_PASSWORD}' | base64 -d)" \
        --set auth.database="aerofusionxr" \
        --set persistence.size="100Gi" \
        ${DRY_RUN:+--dry-run}
    
    # Deploy Redis
    helm upgrade --install redis bitnami/redis \
        --namespace "$NAMESPACE" \
        --set auth.password="$(kubectl get secret aerofusionxr-secrets -n $NAMESPACE -o jsonpath='{.data.REDIS_PASSWORD}' | base64 -d)" \
        --set master.persistence.size="20Gi" \
        --set replica.replicaCount=2 \
        ${DRY_RUN:+--dry-run}
    
    log_success "Databases deployed"
}

# Deploy monitoring stack
deploy_monitoring() {
    log_info "Deploying monitoring stack..."
    
    # Create monitoring namespace
    kubectl create namespace aerofusionxr-monitoring --dry-run=client -o yaml | kubectl apply -f -
    
    # Deploy Prometheus
    kubectl apply -f "$PROJECT_ROOT/k8s/monitoring/prometheus.yaml" ${DRY_RUN:+--dry-run=client}
    
    # Deploy Grafana
    kubectl apply -f "$PROJECT_ROOT/k8s/monitoring/grafana.yaml" ${DRY_RUN:+--dry-run=client}
    
    # Deploy Jaeger
    helm repo add jaegertracing https://jaegertracing.github.io/helm-charts
    helm repo update
    
    helm upgrade --install jaeger jaegertracing/jaeger \
        --namespace aerofusionxr-monitoring \
        --set provisionDataStore.cassandra=false \
        --set provisionDataStore.elasticsearch=true \
        --set storage.type=elasticsearch \
        ${DRY_RUN:+--dry-run}
    
    log_success "Monitoring stack deployed"
}

# Deploy services
deploy_services() {
    log_info "Deploying application services..."
    
    local services=(
        "api-gateway"
        "ai-concierge"
        "wayfinding-platform"
        "flight-info"
        "baggage-tracker"
        "commerce"
        "user-profile"
        "notifications"
        "recommendations-engine"
    )
    
    for service in "${services[@]}"; do
        log_info "Deploying $service..."
        
        if [[ -f "$PROJECT_ROOT/k8s/$service/deployment.yaml" ]]; then
            kubectl apply -f "$PROJECT_ROOT/k8s/$service/" ${DRY_RUN:+--dry-run=client}
        else
            log_warning "Deployment manifest not found for $service, skipping..."
        fi
    done
    
    log_success "Application services deployed"
}

# Wait for deployments
wait_for_deployments() {
    if [[ "$DRY_RUN" == "true" ]]; then
        log_warning "Skipping deployment wait (dry run mode)"
        return
    fi
    
    log_info "Waiting for deployments to be ready..."
    
    local services=(
        "api-gateway"
        "ai-concierge"
        "wayfinding-platform"
        "flight-info"
        "baggage-tracker"
        "commerce"
        "user-profile"
        "notifications"
        "recommendations-engine"
    )
    
    for service in "${services[@]}"; do
        log_info "Waiting for $service to be ready..."
        kubectl wait --for=condition=available --timeout=300s deployment/"$service" -n "$NAMESPACE" || {
            log_error "Deployment $service failed to become ready"
            kubectl describe deployment "$service" -n "$NAMESPACE"
            kubectl logs -l app="$service" -n "$NAMESPACE" --tail=50
            error_exit "Deployment failed"
        }
    done
    
    log_success "All deployments are ready"
}

# Run health checks
run_health_checks() {
    if [[ "$DRY_RUN" == "true" ]]; then
        log_warning "Skipping health checks (dry run mode)"
        return
    fi
    
    log_info "Running health checks..."
    
    # Check API Gateway health
    local api_gateway_pod=$(kubectl get pods -n "$NAMESPACE" -l app=api-gateway -o jsonpath='{.items[0].metadata.name}')
    if [[ -n "$api_gateway_pod" ]]; then
        kubectl exec -n "$NAMESPACE" "$api_gateway_pod" -- curl -f http://localhost:8000/health || {
            log_error "API Gateway health check failed"
            return 1
        }
    fi
    
    log_success "Health checks passed"
}

# Display deployment status
show_status() {
    log_info "Deployment Status:"
    echo
    
    # Show pods
    echo "Pods:"
    kubectl get pods -n "$NAMESPACE" -o wide
    echo
    
    # Show services
    echo "Services:"
    kubectl get services -n "$NAMESPACE"
    echo
    
    # Show ingresses
    echo "Ingresses:"
    kubectl get ingresses -n "$NAMESPACE" 2>/dev/null || echo "No ingresses found"
    echo
    
    # Show HPA
    echo "Horizontal Pod Autoscalers:"
    kubectl get hpa -n "$NAMESPACE" 2>/dev/null || echo "No HPAs found"
}

# Cleanup function
cleanup() {
    log_info "Cleaning up temporary files..."
    # Add cleanup logic here if needed
}

# Main deployment function
main() {
    log_info "Starting AeroFusionXR platform deployment..."
    log_info "Environment: $ENVIRONMENT"
    log_info "Namespace: $NAMESPACE"
    log_info "Dry run: $DRY_RUN"
    
    # Set trap for cleanup
    trap cleanup EXIT
    
    # Execute deployment steps
    check_prerequisites
    build_images
    run_tests
    create_namespace
    deploy_infrastructure
    deploy_databases
    deploy_monitoring
    deploy_services
    wait_for_deployments
    run_health_checks
    show_status
    
    log_success "AeroFusionXR platform deployment completed successfully!"
    
    if [[ "$DRY_RUN" != "true" ]]; then
        echo
        log_info "Access URLs:"
        echo "  API Gateway: http://$(kubectl get service api-gateway-service -n $NAMESPACE -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'):8000"
        echo "  Grafana: http://$(kubectl get service grafana-service -n aerofusionxr-monitoring -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'):3000"
        echo "  Prometheus: http://$(kubectl get service prometheus-service -n aerofusionxr-monitoring -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'):9090"
    fi
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --namespace)
            NAMESPACE="$2"
            shift 2
            ;;
        --environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --context)
            KUBECTL_CONTEXT="$2"
            shift 2
            ;;
        --dry-run)
            DRY_RUN="true"
            shift
            ;;
        --skip-build)
            SKIP_BUILD="true"
            shift
            ;;
        --skip-tests)
            SKIP_TESTS="true"
            shift
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  --namespace NAMESPACE    Kubernetes namespace (default: aerofusionxr)"
            echo "  --environment ENV        Environment name (default: production)"
            echo "  --context CONTEXT        Kubectl context to use"
            echo "  --dry-run               Perform a dry run"
            echo "  --skip-build            Skip Docker image building"
            echo "  --skip-tests            Skip running tests"
            echo "  --help                  Show this help message"
            exit 0
            ;;
        *)
            error_exit "Unknown option: $1"
            ;;
    esac
done

# Run main function
main "$@" 