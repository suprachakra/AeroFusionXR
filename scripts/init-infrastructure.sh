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
    local required_tools=("docker" "docker-compose" "kubectl" "helm" "terraform" "aws")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            print_error "$tool is required but not installed."
            exit 1
        fi
    done
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        print_error "AWS credentials not configured."
        exit 1
    fi
}

# Initialize Terraform
init_terraform() {
    print_step "Initializing Terraform..."
    
    cd infrastructure/terraform
    
    # Create S3 bucket for Terraform state if it doesn't exist
    if ! aws s3 ls "s3://aerofusion-terraform-state" &> /dev/null; then
        aws s3 mb s3://aerofusion-terraform-state --region us-west-2
        aws s3api put-bucket-versioning \
            --bucket aerofusion-terraform-state \
            --versioning-configuration Status=Enabled
        aws s3api put-bucket-encryption \
            --bucket aerofusion-terraform-state \
            --server-side-encryption-configuration \
                '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
    fi
    
    # Create DynamoDB table for state locking if it doesn't exist
    if ! aws dynamodb describe-table --table-name aerofusion-terraform-locks &> /dev/null; then
        aws dynamodb create-table \
            --table-name aerofusion-terraform-locks \
            --attribute-definitions AttributeName=LockID,AttributeType=S \
            --key-schema AttributeName=LockID,KeyType=HASH \
            --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 \
            --region us-west-2
    fi
    
    terraform init
    cd ../..
}

# Create EKS cluster
create_cluster() {
    print_step "Creating EKS cluster..."
    
    cd infrastructure/terraform
    terraform apply -target=module.vpc -target=module.eks -auto-approve
    
    # Update kubeconfig
    aws eks update-kubeconfig --name $(terraform output -raw eks_cluster_name) --region us-west-2
    cd ../..
}

# Install cluster addons
install_addons() {
    print_step "Installing cluster addons..."
    
    # Add Helm repositories
    helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
    helm repo add grafana https://grafana.github.io/helm-charts
    helm repo add jetstack https://charts.jetstack.io
    helm repo add elastic https://helm.elastic.co
    helm repo update
    
    # Install cert-manager
    kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.8.0/cert-manager.crds.yaml
    helm install cert-manager jetstack/cert-manager --namespace cert-manager --create-namespace --version v1.8.0
    
    # Install monitoring stack
    helm install prometheus prometheus-community/kube-prometheus-stack \
        -f infrastructure/kubernetes/values.yaml \
        --namespace monitoring \
        --create-namespace
    
    # Install logging stack
    helm install elasticsearch elastic/elasticsearch \
        -f infrastructure/kubernetes/values.yaml \
        --namespace logging \
        --create-namespace
    
    helm install kibana elastic/kibana \
        -f infrastructure/kubernetes/values.yaml \
        --namespace logging
}

# Deploy core services
deploy_services() {
    print_step "Deploying core services..."
    
    # Create namespaces
    kubectl create namespace aerofusion-system --dry-run=client -o yaml | kubectl apply -f -
    kubectl create namespace aerofusion-dev --dry-run=client -o yaml | kubectl apply -f -
    
    # Deploy services
    helm install aerofusion ./infrastructure/kubernetes \
        -f infrastructure/kubernetes/values.yaml \
        --namespace aerofusion-dev
}

# Main execution
main() {
    print_step "Starting infrastructure initialization..."
    
    check_prerequisites
    init_terraform
    create_cluster
    install_addons
    deploy_services
    
    print_step "Infrastructure initialization completed successfully!"
}

main "$@" 