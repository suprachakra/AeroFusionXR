#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Print step with color
print_step() {
    echo -e "${GREEN}==> $1${NC}"
}

# Print warning with color
print_warning() {
    echo -e "${YELLOW}WARNING: $1${NC}"
}

# Print error with color
print_error() {
    echo -e "${RED}ERROR: $1${NC}"
}

# Check prerequisites
check_prerequisites() {
    print_step "Checking prerequisites..."
    
    # Check required tools
    local required_tools=("docker" "docker-compose" "node" "python" "pip")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            print_error "$tool is required but not installed."
            exit 1
        fi
    done
}

# Setup Node.js services
setup_node_services() {
    print_step "Setting up Node.js services..."
    
    local node_services=("ai-concierge" "wayfinding" "baggage-tracker" "commerce")
    
    for service in "${node_services[@]}"; do
        if [ -d "services/$service" ]; then
            print_step "Setting up $service..."
            cd "services/$service"
            npm install
            npm run build
            cd ../..
        fi
    done
}

# Setup Python services
setup_python_services() {
    print_step "Setting up Python services..."
    
    local python_services=("feature-store" "model-registry" "flight-info")
    
    for service in "${python_services[@]}"; do
        if [ -d "services/$service" ]; then
            print_step "Setting up $service..."
            cd "services/$service"
            python -m venv venv
            source venv/bin/activate
            pip install -r requirements.txt
            deactivate
            cd ../..
        fi
    done
}

# Setup web client
setup_web_client() {
    print_step "Setting up web client..."
    
    if [ -d "clients/web" ]; then
        cd clients/web
        npm install
        npm run build
        cd ../..
    fi
}

# Setup development databases
setup_databases() {
    print_step "Setting up development databases..."
    
    # Start databases using Docker Compose
    docker-compose up -d mongodb redis postgres
    
    # Wait for databases to be ready
    print_step "Waiting for databases to be ready..."
    sleep 10
    
    # Initialize databases with sample data
    print_step "Initializing databases with sample data..."
    for service in services/*/scripts/init-db.*; do
        if [ -f "$service" ]; then
            if [[ "$service" == *.js ]]; then
                node "$service"
            elif [[ "$service" == *.py ]]; then
                python "$service"
            fi
        fi
    done
}

# Start development environment
start_dev_environment() {
    print_step "Starting development environment..."
    
    # Start all services in development mode
    docker-compose up -d
    
    print_step "Development environment is ready!"
    echo -e "${GREEN}Access the services at:${NC}"
    echo "- Web Client: http://localhost:3000"
    echo "- API Gateway: http://localhost:8000"
    echo "- Grafana: http://localhost:3001"
    echo "- Kibana: http://localhost:5601"
    echo "- Prometheus: http://localhost:9090"
    echo "- Jaeger UI: http://localhost:16686"
}

# Setup development tools
setup_dev_tools() {
    print_step "Setting up development tools..."
    
    # Install global development dependencies
    npm install -g typescript ts-node nodemon
    pip install pre-commit black isort mypy
    
    # Initialize git hooks
    pre-commit install
    
    # Setup IDE configurations
    if [ -d ".vscode" ]; then
        print_step "Setting up VSCode configurations..."
        cp config/vscode/* .vscode/
    fi
}

# Main execution
main() {
    print_step "Starting development environment setup..."
    
    check_prerequisites
    setup_node_services
    setup_python_services
    setup_web_client
    setup_databases
    setup_dev_tools
    start_dev_environment
    
    print_step "Development environment setup completed successfully!"
}

main "$@" 