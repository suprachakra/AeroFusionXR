output "mongodb_endpoint" {
  description = "MongoDB cluster endpoint"
  value       = aws_docdb_cluster.mongodb.endpoint
  sensitive   = true
}

output "mongodb_port" {
  description = "MongoDB cluster port"
  value       = aws_docdb_cluster.mongodb.port
}

output "mongodb_cluster_identifier" {
  description = "MongoDB cluster identifier"
  value       = aws_docdb_cluster.mongodb.cluster_identifier
}

output "redis_endpoint" {
  description = "Redis primary endpoint"
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
  sensitive   = true
}

output "redis_port" {
  description = "Redis port"
  value       = aws_elasticache_replication_group.redis.port
}

output "redis_cluster_id" {
  description = "Redis cluster identifier"
  value       = aws_elasticache_replication_group.redis.replication_group_id
}

output "mongodb_security_group_id" {
  description = "Security group ID for MongoDB"
  value       = aws_security_group.mongodb.id
}

output "redis_security_group_id" {
  description = "Security group ID for Redis"
  value       = aws_security_group.redis.id
} 