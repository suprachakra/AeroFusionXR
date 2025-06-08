#!/bin/bash

# AeroFusionXR Platform Backup Script
# This script creates comprehensive backups of all platform data

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
NAMESPACE="${NAMESPACE:-aerofusionxr}"
BACKUP_DIR="${BACKUP_DIR:-/backups/aerofusionxr}"
S3_BUCKET="${S3_BUCKET:-aerofusionxr-backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="aerofusionxr_backup_${TIMESTAMP}"

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
    local required_tools=("kubectl" "mongodump" "redis-cli" "aws" "tar" "gzip")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            error_exit "$tool is required but not installed"
        fi
    done
    
    # Verify cluster connectivity
    kubectl cluster-info &> /dev/null || error_exit "Cannot connect to Kubernetes cluster"
    
    # Check namespace exists
    kubectl get namespace "$NAMESPACE" &> /dev/null || error_exit "Namespace $NAMESPACE does not exist"
    
    # Create backup directory
    mkdir -p "$BACKUP_DIR/$BACKUP_NAME"
    
    log_success "Prerequisites check passed"
}

# Backup MongoDB
backup_mongodb() {
    log_info "Backing up MongoDB..."
    
    local mongodb_pod=$(kubectl get pods -n "$NAMESPACE" -l app.kubernetes.io/name=mongodb -o jsonpath='{.items[0].metadata.name}')
    if [[ -z "$mongodb_pod" ]]; then
        log_warning "MongoDB pod not found, skipping MongoDB backup"
        return
    fi
    
    local mongodb_password=$(kubectl get secret aerofusionxr-secrets -n "$NAMESPACE" -o jsonpath='{.data.MONGODB_PASSWORD}' | base64 -d)
    local mongodb_username=$(kubectl get secret aerofusionxr-secrets -n "$NAMESPACE" -o jsonpath='{.data.MONGODB_USERNAME}' | base64 -d)
    
    # Create MongoDB backup
    kubectl exec -n "$NAMESPACE" "$mongodb_pod" -- mongodump \
        --username="$mongodb_username" \
        --password="$mongodb_password" \
        --authenticationDatabase=admin \
        --db=aerofusionxr \
        --out=/tmp/mongodb_backup || error_exit "MongoDB backup failed"
    
    # Copy backup from pod
    kubectl cp "$NAMESPACE/$mongodb_pod:/tmp/mongodb_backup" "$BACKUP_DIR/$BACKUP_NAME/mongodb_backup"
    
    # Compress MongoDB backup
    tar -czf "$BACKUP_DIR/$BACKUP_NAME/mongodb_backup.tar.gz" -C "$BACKUP_DIR/$BACKUP_NAME" mongodb_backup
    rm -rf "$BACKUP_DIR/$BACKUP_NAME/mongodb_backup"
    
    log_success "MongoDB backup completed"
}

# Backup Redis
backup_redis() {
    log_info "Backing up Redis..."
    
    local redis_pod=$(kubectl get pods -n "$NAMESPACE" -l app.kubernetes.io/name=redis -o jsonpath='{.items[0].metadata.name}')
    if [[ -z "$redis_pod" ]]; then
        log_warning "Redis pod not found, skipping Redis backup"
        return
    fi
    
    local redis_password=$(kubectl get secret aerofusionxr-secrets -n "$NAMESPACE" -o jsonpath='{.data.REDIS_PASSWORD}' | base64 -d)
    
    # Create Redis backup
    kubectl exec -n "$NAMESPACE" "$redis_pod" -- redis-cli \
        --rdb /tmp/redis_backup.rdb \
        -a "$redis_password" || error_exit "Redis backup failed"
    
    # Copy backup from pod
    kubectl cp "$NAMESPACE/$redis_pod:/tmp/redis_backup.rdb" "$BACKUP_DIR/$BACKUP_NAME/redis_backup.rdb"
    
    # Compress Redis backup
    gzip "$BACKUP_DIR/$BACKUP_NAME/redis_backup.rdb"
    
    log_success "Redis backup completed"
}

# Backup Kubernetes manifests
backup_k8s_manifests() {
    log_info "Backing up Kubernetes manifests..."
    
    local k8s_backup_dir="$BACKUP_DIR/$BACKUP_NAME/k8s_manifests"
    mkdir -p "$k8s_backup_dir"
    
    # Backup all resources in the namespace
    local resources=(
        "deployments"
        "services"
        "configmaps"
        "secrets"
        "persistentvolumeclaims"
        "ingresses"
        "horizontalpodautoscalers"
        "networkpolicies"
    )
    
    for resource in "${resources[@]}"; do
        log_info "Backing up $resource..."
        kubectl get "$resource" -n "$NAMESPACE" -o yaml > "$k8s_backup_dir/${resource}.yaml" 2>/dev/null || {
            log_warning "No $resource found in namespace $NAMESPACE"
        }
    done
    
    # Backup cluster-wide resources
    kubectl get clusterroles,clusterrolebindings -l app=aerofusionxr -o yaml > "$k8s_backup_dir/cluster_resources.yaml" 2>/dev/null || {
        log_warning "No cluster-wide resources found"
    }
    
    # Compress K8s manifests
    tar -czf "$BACKUP_DIR/$BACKUP_NAME/k8s_manifests.tar.gz" -C "$BACKUP_DIR/$BACKUP_NAME" k8s_manifests
    rm -rf "$k8s_backup_dir"
    
    log_success "Kubernetes manifests backup completed"
}

# Backup application logs
backup_logs() {
    log_info "Backing up application logs..."
    
    local logs_backup_dir="$BACKUP_DIR/$BACKUP_NAME/logs"
    mkdir -p "$logs_backup_dir"
    
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
        log_info "Backing up logs for $service..."
        kubectl logs -l app="$service" -n "$NAMESPACE" --tail=10000 > "$logs_backup_dir/${service}.log" 2>/dev/null || {
            log_warning "No logs found for $service"
        }
    done
    
    # Compress logs
    tar -czf "$BACKUP_DIR/$BACKUP_NAME/logs.tar.gz" -C "$BACKUP_DIR/$BACKUP_NAME" logs
    rm -rf "$logs_backup_dir"
    
    log_success "Application logs backup completed"
}

# Backup monitoring data
backup_monitoring() {
    log_info "Backing up monitoring data..."
    
    local monitoring_backup_dir="$BACKUP_DIR/$BACKUP_NAME/monitoring"
    mkdir -p "$monitoring_backup_dir"
    
    # Backup Prometheus data
    local prometheus_pod=$(kubectl get pods -n aerofusionxr-monitoring -l app=prometheus -o jsonpath='{.items[0].metadata.name}')
    if [[ -n "$prometheus_pod" ]]; then
        kubectl exec -n aerofusionxr-monitoring "$prometheus_pod" -- tar -czf /tmp/prometheus_data.tar.gz -C /prometheus . || {
            log_warning "Failed to backup Prometheus data"
        }
        kubectl cp "aerofusionxr-monitoring/$prometheus_pod:/tmp/prometheus_data.tar.gz" "$monitoring_backup_dir/prometheus_data.tar.gz" || {
            log_warning "Failed to copy Prometheus backup"
        }
    fi
    
    # Backup Grafana dashboards
    local grafana_pod=$(kubectl get pods -n aerofusionxr-monitoring -l app=grafana -o jsonpath='{.items[0].metadata.name}')
    if [[ -n "$grafana_pod" ]]; then
        kubectl exec -n aerofusionxr-monitoring "$grafana_pod" -- tar -czf /tmp/grafana_data.tar.gz -C /var/lib/grafana . || {
            log_warning "Failed to backup Grafana data"
        }
        kubectl cp "aerofusionxr-monitoring/$grafana_pod:/tmp/grafana_data.tar.gz" "$monitoring_backup_dir/grafana_data.tar.gz" || {
            log_warning "Failed to copy Grafana backup"
        }
    fi
    
    log_success "Monitoring data backup completed"
}

# Create backup metadata
create_metadata() {
    log_info "Creating backup metadata..."
    
    local metadata_file="$BACKUP_DIR/$BACKUP_NAME/metadata.json"
    
    cat > "$metadata_file" << EOF
{
  "backup_name": "$BACKUP_NAME",
  "timestamp": "$TIMESTAMP",
  "namespace": "$NAMESPACE",
  "kubernetes_version": "$(kubectl version --short --client | grep 'Client Version' | cut -d' ' -f3)",
  "cluster_info": "$(kubectl cluster-info | head -1)",
  "backup_components": [
    "mongodb",
    "redis",
    "kubernetes_manifests",
    "application_logs",
    "monitoring_data"
  ],
  "retention_days": $RETENTION_DAYS,
  "created_by": "$(whoami)",
  "hostname": "$(hostname)"
}
EOF
    
    log_success "Backup metadata created"
}

# Upload to S3
upload_to_s3() {
    log_info "Uploading backup to S3..."
    
    # Create final backup archive
    local backup_archive="$BACKUP_DIR/${BACKUP_NAME}.tar.gz"
    tar -czf "$backup_archive" -C "$BACKUP_DIR" "$BACKUP_NAME"
    
    # Upload to S3
    aws s3 cp "$backup_archive" "s3://$S3_BUCKET/backups/" || error_exit "Failed to upload backup to S3"
    
    # Upload metadata separately for easy querying
    aws s3 cp "$BACKUP_DIR/$BACKUP_NAME/metadata.json" "s3://$S3_BUCKET/metadata/${BACKUP_NAME}.json" || {
        log_warning "Failed to upload metadata to S3"
    }
    
    log_success "Backup uploaded to S3: s3://$S3_BUCKET/backups/${BACKUP_NAME}.tar.gz"
}

# Cleanup old backups
cleanup_old_backups() {
    log_info "Cleaning up old backups..."
    
    # Cleanup local backups
    find "$BACKUP_DIR" -name "aerofusionxr_backup_*" -type d -mtime +$RETENTION_DAYS -exec rm -rf {} \; 2>/dev/null || true
    find "$BACKUP_DIR" -name "aerofusionxr_backup_*.tar.gz" -type f -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
    
    # Cleanup S3 backups
    local cutoff_date=$(date -d "$RETENTION_DAYS days ago" +%Y%m%d)
    aws s3 ls "s3://$S3_BUCKET/backups/" | while read -r line; do
        local backup_file=$(echo "$line" | awk '{print $4}')
        if [[ "$backup_file" =~ aerofusionxr_backup_([0-9]{8})_ ]]; then
            local backup_date="${BASH_REMATCH[1]}"
            if [[ "$backup_date" < "$cutoff_date" ]]; then
                log_info "Deleting old backup: $backup_file"
                aws s3 rm "s3://$S3_BUCKET/backups/$backup_file" || {
                    log_warning "Failed to delete $backup_file"
                }
            fi
        fi
    done
    
    log_success "Old backups cleaned up"
}

# Verify backup integrity
verify_backup() {
    log_info "Verifying backup integrity..."
    
    local backup_archive="$BACKUP_DIR/${BACKUP_NAME}.tar.gz"
    
    # Test archive integrity
    tar -tzf "$backup_archive" > /dev/null || error_exit "Backup archive is corrupted"
    
    # Check file sizes
    local archive_size=$(stat -f%z "$backup_archive" 2>/dev/null || stat -c%s "$backup_archive")
    if [[ "$archive_size" -lt 1000000 ]]; then  # Less than 1MB
        log_warning "Backup archive seems unusually small: $archive_size bytes"
    fi
    
    log_success "Backup integrity verified"
}

# Send notification
send_notification() {
    local status="$1"
    local message="$2"
    
    log_info "Sending backup notification..."
    
    # Send to webhook if configured
    if [[ -n "${WEBHOOK_URL:-}" ]]; then
        curl -X POST "$WEBHOOK_URL" \
            -H "Content-Type: application/json" \
            -d "{
                \"text\": \"AeroFusionXR Backup $status\",
                \"attachments\": [{
                    \"color\": \"$([ "$status" = "SUCCESS" ] && echo "good" || echo "danger")\",
                    \"fields\": [{
                        \"title\": \"Backup Name\",
                        \"value\": \"$BACKUP_NAME\",
                        \"short\": true
                    }, {
                        \"title\": \"Namespace\",
                        \"value\": \"$NAMESPACE\",
                        \"short\": true
                    }, {
                        \"title\": \"Message\",
                        \"value\": \"$message\",
                        \"short\": false
                    }]
                }]
            }" || log_warning "Failed to send webhook notification"
    fi
    
    # Send email if configured
    if [[ -n "${EMAIL_RECIPIENT:-}" ]]; then
        echo "$message" | mail -s "AeroFusionXR Backup $status" "$EMAIL_RECIPIENT" || {
            log_warning "Failed to send email notification"
        }
    fi
}

# Main backup function
main() {
    log_info "Starting AeroFusionXR platform backup..."
    log_info "Backup name: $BACKUP_NAME"
    log_info "Namespace: $NAMESPACE"
    log_info "Backup directory: $BACKUP_DIR"
    
    local start_time=$(date +%s)
    
    # Execute backup steps
    check_prerequisites
    backup_mongodb
    backup_redis
    backup_k8s_manifests
    backup_logs
    backup_monitoring
    create_metadata
    upload_to_s3
    verify_backup
    cleanup_old_backups
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    log_success "AeroFusionXR platform backup completed successfully!"
    log_info "Backup duration: ${duration} seconds"
    log_info "Backup location: s3://$S3_BUCKET/backups/${BACKUP_NAME}.tar.gz"
    
    send_notification "SUCCESS" "Backup completed successfully in ${duration} seconds"
    
    # Cleanup local backup directory
    rm -rf "$BACKUP_DIR/$BACKUP_NAME"
}

# Error handling with notification
trap 'send_notification "FAILED" "Backup failed with error: $?"' ERR

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --namespace)
            NAMESPACE="$2"
            shift 2
            ;;
        --backup-dir)
            BACKUP_DIR="$2"
            shift 2
            ;;
        --s3-bucket)
            S3_BUCKET="$2"
            shift 2
            ;;
        --retention-days)
            RETENTION_DAYS="$2"
            shift 2
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  --namespace NAMESPACE      Kubernetes namespace (default: aerofusionxr)"
            echo "  --backup-dir DIR          Local backup directory (default: /backups/aerofusionxr)"
            echo "  --s3-bucket BUCKET        S3 bucket for backup storage (default: aerofusionxr-backups)"
            echo "  --retention-days DAYS     Backup retention period (default: 30)"
            echo "  --help                    Show this help message"
            echo ""
            echo "Environment variables:"
            echo "  WEBHOOK_URL               Webhook URL for notifications"
            echo "  EMAIL_RECIPIENT           Email address for notifications"
            exit 0
            ;;
        *)
            error_exit "Unknown option: $1"
            ;;
    esac
done

# Run main function
main "$@" 