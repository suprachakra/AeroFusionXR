#!/bin/bash

# AeroFusionXR Platform Load Testing Script
# This script performs comprehensive load testing of the platform

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
NAMESPACE="${NAMESPACE:-aerofusionxr}"
BASE_URL="${BASE_URL:-http://localhost:8000}"
CONCURRENT_USERS="${CONCURRENT_USERS:-100}"
TEST_DURATION="${TEST_DURATION:-300}"
RAMP_UP_TIME="${RAMP_UP_TIME:-60}"
RESULTS_DIR="${RESULTS_DIR:-$PROJECT_ROOT/test-results}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

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
    local required_tools=("kubectl" "curl" "jq" "ab" "wrk")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log_warning "$tool is not installed, some tests may be skipped"
        fi
    done
    
    # Create results directory
    mkdir -p "$RESULTS_DIR/$TIMESTAMP"
    
    # Check if services are running
    kubectl get pods -n "$NAMESPACE" | grep -E "(api-gateway|ai-concierge|wayfinding)" || {
        error_exit "Required services are not running in namespace $NAMESPACE"
    }
    
    log_success "Prerequisites check completed"
}

# Health check before testing
health_check() {
    log_info "Performing health check..."
    
    local services=(
        "api-gateway:8000"
        "ai-concierge:8001"
        "wayfinding-platform:8002"
        "flight-info:8003"
        "baggage-tracker:8004"
        "commerce:8005"
        "user-profile:8006"
        "notifications:8007"
        "recommendations-engine:8008"
    )
    
    for service_port in "${services[@]}"; do
        local service=$(echo "$service_port" | cut -d: -f1)
        local port=$(echo "$service_port" | cut -d: -f2)
        
        log_info "Checking $service health..."
        
        # Port forward to service
        kubectl port-forward -n "$NAMESPACE" "service/${service}-service" "$port:$port" &
        local pf_pid=$!
        sleep 2
        
        # Health check
        if curl -f "http://localhost:$port/health" &>/dev/null; then
            log_success "$service is healthy"
        else
            log_warning "$service health check failed"
        fi
        
        # Kill port forward
        kill $pf_pid 2>/dev/null || true
        sleep 1
    done
}

# Apache Bench load test
run_ab_test() {
    if ! command -v ab &> /dev/null; then
        log_warning "Apache Bench not available, skipping ab tests"
        return
    fi
    
    log_info "Running Apache Bench load tests..."
    
    local test_endpoints=(
        "/health"
        "/api/v1/auth/profile"
        "/api/v1/flights/search"
        "/api/v1/wayfinding/route"
        "/api/v1/recommendations"
    )
    
    for endpoint in "${test_endpoints[@]}"; do
        log_info "Testing endpoint: $endpoint"
        
        # Port forward to API Gateway
        kubectl port-forward -n "$NAMESPACE" service/api-gateway-service 8000:8000 &
        local pf_pid=$!
        sleep 2
        
        # Run ab test
        ab -n 1000 -c 10 -g "$RESULTS_DIR/$TIMESTAMP/ab_${endpoint//\//_}.tsv" \
           "http://localhost:8000$endpoint" > "$RESULTS_DIR/$TIMESTAMP/ab_${endpoint//\//_}.txt" 2>&1 || {
            log_warning "ab test failed for $endpoint"
        }
        
        # Kill port forward
        kill $pf_pid 2>/dev/null || true
        sleep 1
    done
    
    log_success "Apache Bench tests completed"
}

# wrk load test
run_wrk_test() {
    if ! command -v wrk &> /dev/null; then
        log_warning "wrk not available, skipping wrk tests"
        return
    fi
    
    log_info "Running wrk load tests..."
    
    # Port forward to API Gateway
    kubectl port-forward -n "$NAMESPACE" service/api-gateway-service 8000:8000 &
    local pf_pid=$!
    sleep 2
    
    # Create Lua script for complex scenarios
    cat > "$RESULTS_DIR/$TIMESTAMP/wrk_script.lua" << 'EOF'
-- wrk script for AeroFusionXR load testing

local counter = 1
local threads = {}

function setup(thread)
   thread:set("id", counter)
   table.insert(threads, thread)
   counter = counter + 1
end

function init(args)
   requests = 0
   responses = 0
   
   local msg = "thread %d created"
   print(msg:format(id))
end

function request()
   requests = requests + 1
   
   -- Rotate between different endpoints
   local endpoints = {
      "/health",
      "/api/v1/auth/profile",
      "/api/v1/flights/search?origin=JFK&destination=LAX",
      "/api/v1/wayfinding/route",
      "/api/v1/recommendations"
   }
   
   local endpoint = endpoints[(requests % #endpoints) + 1]
   return wrk.format("GET", endpoint)
end

function response(status, headers, body)
   responses = responses + 1
   
   if status ~= 200 then
      print("Error: " .. status)
   end
end

function done(summary, latency, requests)
   io.write("------------------------------\n")
   for index, thread in ipairs(threads) do
      local id        = thread:get("id")
      local requests  = thread:get("requests")
      local responses = thread:get("responses")
      local msg = "thread %d made %d requests and got %d responses"
      io.write(msg:format(id, requests, responses))
   end
end
EOF
    
    # Run wrk test
    wrk -t4 -c$CONCURRENT_USERS -d${TEST_DURATION}s -s "$RESULTS_DIR/$TIMESTAMP/wrk_script.lua" \
        --latency "http://localhost:8000" > "$RESULTS_DIR/$TIMESTAMP/wrk_results.txt" 2>&1 || {
        log_warning "wrk test failed"
    }
    
    # Kill port forward
    kill $pf_pid 2>/dev/null || true
    
    log_success "wrk tests completed"
}

# Stress test specific services
stress_test_services() {
    log_info "Running service-specific stress tests..."
    
    # AI Concierge stress test
    log_info "Stress testing AI Concierge..."
    kubectl port-forward -n "$NAMESPACE" service/ai-concierge-service 8001:8001 &
    local pf_pid=$!
    sleep 2
    
    # Simulate AI queries
    for i in {1..50}; do
        curl -X POST "http://localhost:8001/api/v1/chat/message" \
             -H "Content-Type: application/json" \
             -d '{"message": "What is the status of flight AA123?", "userId": "test_user_'$i'"}' \
             &>/dev/null &
    done
    wait
    
    kill $pf_pid 2>/dev/null || true
    
    # Wayfinding stress test
    log_info "Stress testing Wayfinding Platform..."
    kubectl port-forward -n "$NAMESPACE" service/wayfinding-service 8002:8002 &
    pf_pid=$!
    sleep 2
    
    # Simulate route requests
    for i in {1..100}; do
        curl -X POST "http://localhost:8002/api/route/find" \
             -H "Content-Type: application/json" \
             -d '{"start": {"x": '$((RANDOM % 1000))', "y": '$((RANDOM % 1000))'}, "end": {"x": '$((RANDOM % 1000))', "y": '$((RANDOM % 1000))'}}' \
             &>/dev/null &
    done
    wait
    
    kill $pf_pid 2>/dev/null || true
    
    log_success "Service stress tests completed"
}

# Database performance test
test_database_performance() {
    log_info "Testing database performance..."
    
    # MongoDB performance test
    local mongodb_pod=$(kubectl get pods -n "$NAMESPACE" -l app.kubernetes.io/name=mongodb -o jsonpath='{.items[0].metadata.name}')
    if [[ -n "$mongodb_pod" ]]; then
        log_info "Testing MongoDB performance..."
        
        # Run MongoDB performance test
        kubectl exec -n "$NAMESPACE" "$mongodb_pod" -- mongo --eval "
            db.test_collection.drop();
            var start = new Date();
            for(var i = 0; i < 10000; i++) {
                db.test_collection.insert({
                    index: i,
                    data: 'test data ' + i,
                    timestamp: new Date(),
                    random: Math.random()
                });
            }
            var end = new Date();
            print('MongoDB Insert Test: ' + (end - start) + 'ms for 10000 documents');
            
            start = new Date();
            db.test_collection.find({index: {\$lt: 5000}}).count();
            end = new Date();
            print('MongoDB Query Test: ' + (end - start) + 'ms for range query');
            
            db.test_collection.drop();
        " > "$RESULTS_DIR/$TIMESTAMP/mongodb_performance.txt" 2>&1 || {
            log_warning "MongoDB performance test failed"
        }
    fi
    
    # Redis performance test
    local redis_pod=$(kubectl get pods -n "$NAMESPACE" -l app.kubernetes.io/name=redis -o jsonpath='{.items[0].metadata.name}')
    if [[ -n "$redis_pod" ]]; then
        log_info "Testing Redis performance..."
        
        local redis_password=$(kubectl get secret aerofusionxr-secrets -n "$NAMESPACE" -o jsonpath='{.data.REDIS_PASSWORD}' | base64 -d)
        
        # Run Redis benchmark
        kubectl exec -n "$NAMESPACE" "$redis_pod" -- redis-benchmark \
            -a "$redis_password" \
            -n 10000 \
            -c 10 \
            -t set,get,incr,lpush,rpush,lpop,rpop,sadd,hset,spop,lrange,mset \
            > "$RESULTS_DIR/$TIMESTAMP/redis_performance.txt" 2>&1 || {
            log_warning "Redis performance test failed"
        }
    fi
    
    log_success "Database performance tests completed"
}

# Monitor resource usage during tests
monitor_resources() {
    log_info "Monitoring resource usage..."
    
    # Monitor for 5 minutes
    for i in {1..30}; do
        echo "=== Resource Usage - $(date) ===" >> "$RESULTS_DIR/$TIMESTAMP/resource_usage.txt"
        
        # Pod resource usage
        kubectl top pods -n "$NAMESPACE" >> "$RESULTS_DIR/$TIMESTAMP/resource_usage.txt" 2>/dev/null || {
            echo "kubectl top not available" >> "$RESULTS_DIR/$TIMESTAMP/resource_usage.txt"
        }
        
        # Node resource usage
        kubectl top nodes >> "$RESULTS_DIR/$TIMESTAMP/resource_usage.txt" 2>/dev/null || {
            echo "kubectl top nodes not available" >> "$RESULTS_DIR/$TIMESTAMP/resource_usage.txt"
        }
        
        echo "" >> "$RESULTS_DIR/$TIMESTAMP/resource_usage.txt"
        sleep 10
    done &
    
    local monitor_pid=$!
    
    # Return the PID so we can kill it later
    echo $monitor_pid
}

# Generate performance report
generate_report() {
    log_info "Generating performance report..."
    
    local report_file="$RESULTS_DIR/$TIMESTAMP/performance_report.html"
    
    cat > "$report_file" << EOF
<!DOCTYPE html>
<html>
<head>
    <title>AeroFusionXR Load Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .header { background-color: #f0f0f0; padding: 20px; border-radius: 5px; }
        .section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        .success { background-color: #d4edda; border-color: #c3e6cb; }
        .warning { background-color: #fff3cd; border-color: #ffeaa7; }
        .error { background-color: #f8d7da; border-color: #f5c6cb; }
        pre { background-color: #f8f9fa; padding: 10px; border-radius: 3px; overflow-x: auto; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <div class="header">
        <h1>AeroFusionXR Load Test Report</h1>
        <p><strong>Test Date:</strong> $(date)</p>
        <p><strong>Namespace:</strong> $NAMESPACE</p>
        <p><strong>Concurrent Users:</strong> $CONCURRENT_USERS</p>
        <p><strong>Test Duration:</strong> $TEST_DURATION seconds</p>
    </div>
    
    <div class="section">
        <h2>Test Summary</h2>
        <table>
            <tr><th>Metric</th><th>Value</th></tr>
            <tr><td>Total Requests</td><td>$(grep -h "Complete requests" "$RESULTS_DIR/$TIMESTAMP"/ab_*.txt 2>/dev/null | awk '{sum+=$3} END {print sum}' || echo "N/A")</td></tr>
            <tr><td>Failed Requests</td><td>$(grep -h "Failed requests" "$RESULTS_DIR/$TIMESTAMP"/ab_*.txt 2>/dev/null | awk '{sum+=$3} END {print sum}' || echo "N/A")</td></tr>
            <tr><td>Average Response Time</td><td>$(grep -h "Time per request" "$RESULTS_DIR/$TIMESTAMP"/ab_*.txt 2>/dev/null | head -1 | awk '{print $4}' || echo "N/A") ms</td></tr>
        </table>
    </div>
    
    <div class="section">
        <h2>Service Health Status</h2>
        <p>All critical services were tested for availability and performance.</p>
    </div>
    
    <div class="section">
        <h2>Performance Recommendations</h2>
        <ul>
            <li>Monitor response times under load</li>
            <li>Consider horizontal pod autoscaling for high-traffic services</li>
            <li>Implement caching strategies for frequently accessed data</li>
            <li>Optimize database queries and indexing</li>
        </ul>
    </div>
    
    <div class="section">
        <h2>Test Files</h2>
        <ul>
EOF
    
    # Add links to test result files
    for file in "$RESULTS_DIR/$TIMESTAMP"/*.txt; do
        if [[ -f "$file" ]]; then
            local filename=$(basename "$file")
            echo "            <li><a href=\"$filename\">$filename</a></li>" >> "$report_file"
        fi
    done
    
    cat >> "$report_file" << EOF
        </ul>
    </div>
</body>
</html>
EOF
    
    log_success "Performance report generated: $report_file"
}

# Cleanup function
cleanup() {
    log_info "Cleaning up..."
    
    # Kill any remaining port forwards
    pkill -f "kubectl port-forward" 2>/dev/null || true
    
    # Kill any background processes
    jobs -p | xargs -r kill 2>/dev/null || true
}

# Main function
main() {
    log_info "Starting AeroFusionXR load testing..."
    log_info "Test configuration:"
    log_info "  Concurrent users: $CONCURRENT_USERS"
    log_info "  Test duration: $TEST_DURATION seconds"
    log_info "  Results directory: $RESULTS_DIR/$TIMESTAMP"
    
    # Set trap for cleanup
    trap cleanup EXIT
    
    local start_time=$(date +%s)
    
    # Start resource monitoring
    local monitor_pid=$(monitor_resources)
    
    # Execute test steps
    check_prerequisites
    health_check
    run_ab_test
    run_wrk_test
    stress_test_services
    test_database_performance
    
    # Stop resource monitoring
    kill $monitor_pid 2>/dev/null || true
    
    # Generate report
    generate_report
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    log_success "Load testing completed successfully!"
    log_info "Test duration: ${duration} seconds"
    log_info "Results available in: $RESULTS_DIR/$TIMESTAMP"
    
    # Display summary
    echo
    log_info "Test Summary:"
    if [[ -f "$RESULTS_DIR/$TIMESTAMP/wrk_results.txt" ]]; then
        echo "wrk Results:"
        grep -E "(Requests/sec|Latency|Transfer/sec)" "$RESULTS_DIR/$TIMESTAMP/wrk_results.txt" || true
    fi
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --namespace)
            NAMESPACE="$2"
            shift 2
            ;;
        --base-url)
            BASE_URL="$2"
            shift 2
            ;;
        --concurrent-users)
            CONCURRENT_USERS="$2"
            shift 2
            ;;
        --duration)
            TEST_DURATION="$2"
            shift 2
            ;;
        --results-dir)
            RESULTS_DIR="$2"
            shift 2
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  --namespace NAMESPACE        Kubernetes namespace (default: aerofusionxr)"
            echo "  --base-url URL              Base URL for testing (default: http://localhost:8000)"
            echo "  --concurrent-users NUM      Number of concurrent users (default: 100)"
            echo "  --duration SECONDS          Test duration in seconds (default: 300)"
            echo "  --results-dir DIR           Results directory (default: ./test-results)"
            echo "  --help                      Show this help message"
            exit 0
            ;;
        *)
            error_exit "Unknown option: $1"
            ;;
    esac
done

# Run main function
main "$@" 