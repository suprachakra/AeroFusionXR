#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Print colored output
print_status() {
    if [ "$2" = "OK" ]; then
        echo -e "${GREEN}✓ $1: $2${NC}"
    elif [ "$2" = "WARNING" ]; then
        echo -e "${YELLOW}⚠ $1: $3${NC}"
    else
        echo -e "${RED}✗ $1: $2${NC}"
    fi
}

# Check if kubectl is configured
check_kubectl() {
    if kubectl cluster-info &> /dev/null; then
        print_status "Kubernetes Connection" "OK"
        return 0
    else
        print_status "Kubernetes Connection" "FAILED" "Cannot connect to cluster"
        return 1
    fi
}

# Check namespace
check_namespace() {
    local namespace="aerofusion-dev"
    if kubectl get namespace "$namespace" &> /dev/null; then
        print_status "Namespace ($namespace)" "OK"
        return 0
    else
        print_status "Namespace ($namespace)" "FAILED" "Namespace not found"
        return 1
    fi
}

# Check service deployment
check_service() {
    local service_name="$1"
    local namespace="aerofusion-dev"
    
    # Check deployment
    local deployment_status=$(kubectl get deployment "$service_name" -n "$namespace" -o jsonpath='{.status.readyReplicas}/{.status.replicas}' 2>/dev/null || echo "0/0")
    
    if [[ "$deployment_status" == "0/0" ]]; then
        print_status "$service_name Deployment" "FAILED" "Deployment not found"
        return 1
    elif [[ "$deployment_status" =~ ^([0-9]+)\/\1$ ]]; then
        print_status "$service_name Deployment" "OK"
    else
        print_status "$service_name Deployment" "WARNING" "Not all replicas ready ($deployment_status)"
    fi
    
    # Check service
    if kubectl get service "$service_name" -n "$namespace" &> /dev/null; then
        print_status "$service_name Service" "OK"
    else
        print_status "$service_name Service" "FAILED" "Service not found"
        return 1
    fi
    
    return 0
}

# Check database connectivity
check_databases() {
    local namespace="aerofusion-dev"
    
    # Check if database secrets exist
    if kubectl get secret mongodb-credentials -n "$namespace" &> /dev/null; then
        print_status "MongoDB Credentials" "OK"
    else
        print_status "MongoDB Credentials" "WARNING" "Secret not found"
    fi
    
    if kubectl get secret redis-credentials -n "$namespace" &> /dev/null; then
        print_status "Redis Credentials" "OK"
    else
        print_status "Redis Credentials" "WARNING" "Secret not found"
    fi
}

# Check monitoring stack
check_monitoring() {
    local namespace="monitoring"
    
    # Check if monitoring namespace exists
    if kubectl get namespace "$namespace" &> /dev/null; then
        print_status "Monitoring Namespace" "OK"
        
        # Check Prometheus
        if kubectl get deployment prometheus-kube-prometheus-prometheus-operator -n "$namespace" &> /dev/null 2>&1; then
            print_status "Prometheus" "OK"
        else
            print_status "Prometheus" "WARNING" "Not deployed"
        fi
        
        # Check Grafana
        if kubectl get deployment prometheus-grafana -n "$namespace" &> /dev/null 2>&1; then
            print_status "Grafana" "OK"
        else
            print_status "Grafana" "WARNING" "Not deployed"
        fi
    else
        print_status "Monitoring Stack" "WARNING" "Monitoring namespace not found"
    fi
}

# Check ingress
check_ingress() {
    local namespace="aerofusion-dev"
    
    if kubectl get ingress -n "$namespace" &> /dev/null; then
        local ingress_count=$(kubectl get ingress -n "$namespace" --no-headers | wc -l)
        if [ "$ingress_count" -gt 0 ]; then
            print_status "Ingress Configuration" "OK"
        else
            print_status "Ingress Configuration" "WARNING" "No ingress rules found"
        fi
    else
        print_status "Ingress Configuration" "WARNING" "No ingress resources"
    fi
}

# Health check endpoints
check_endpoints() {
    local namespace="aerofusion-dev"
    local services=("ai-concierge" "wayfinding" "baggage-tracker" "commerce" "flight-info")
    
    echo -e "\n${YELLOW}Checking service endpoints...${NC}"
    
    for service in "${services[@]}"; do
        # Port forward to service and check health
        local port=$(kubectl get service "$service" -n "$namespace" -o jsonpath='{.spec.ports[0].port}' 2>/dev/null || echo "")
        
        if [ -n "$port" ]; then
            # Try to get service endpoint without port forwarding for simplicity
            local endpoint_check=$(kubectl exec -n "$namespace" $(kubectl get pods -n "$namespace" -l app="$service" -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "") -- curl -s -o /dev/null -w "%{http_code}" localhost:$(kubectl get service "$service" -n "$namespace" -o jsonpath='{.spec.ports[0].targetPort}' 2>/dev/null || echo "80")/health 2>/dev/null || echo "000")
            
            if [ "$endpoint_check" = "200" ]; then
                print_status "$service Health Endpoint" "OK"
            else
                print_status "$service Health Endpoint" "WARNING" "Endpoint not responding or no health check"
            fi
        else
            print_status "$service Health Endpoint" "WARNING" "Service not found"
        fi
    done
}

# Main health check function
main() {
    echo -e "${GREEN}🏥 AeroFusionXR Health Check${NC}"
    echo -e "${GREEN}================================${NC}\n"
    
    local failed_checks=0
    
    # Infrastructure checks
    echo -e "${YELLOW}Infrastructure Checks:${NC}"
    check_kubectl || ((failed_checks++))
    check_namespace || ((failed_checks++))
    
    echo ""
    
    # Service checks
    echo -e "${YELLOW}Service Checks:${NC}"
    local services=("ai-concierge" "wayfinding" "baggage-tracker" "commerce" "flight-info")
    for service in "${services[@]}"; do
        check_service "$service" || ((failed_checks++))
    done
    
    echo ""
    
    # Database checks
    echo -e "${YELLOW}Database Checks:${NC}"
    check_databases
    
    echo ""
    
    # Monitoring checks
    echo -e "${YELLOW}Monitoring Checks:${NC}"
    check_monitoring
    
    echo ""
    
    # Ingress checks
    echo -e "${YELLOW}Ingress Checks:${NC}"
    check_ingress
    
    echo ""
    
    # Endpoint checks
    check_endpoints
    
    echo ""
    
    # Summary
    if [ $failed_checks -eq 0 ]; then
        echo -e "${GREEN}🎉 All critical checks passed!${NC}"
        echo -e "${GREEN}AeroFusionXR platform is healthy.${NC}"
    else
        echo -e "${RED}❌ $failed_checks critical check(s) failed.${NC}"
        echo -e "${YELLOW}Please review the issues above.${NC}"
        exit 1
    fi
}

# Run health checks
main "$@" 