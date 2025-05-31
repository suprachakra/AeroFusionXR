# MongoDB DocumentDB Cluster
resource "aws_docdb_cluster" "mongodb" {
  cluster_identifier      = "${var.environment}-mongodb"
  engine                 = "docdb"
  master_username        = "admin"
  master_password        = random_password.mongodb_password.result
  backup_retention_period = 7
  preferred_backup_window = "07:00-09:00"
  skip_final_snapshot    = true
  
  db_cluster_parameter_group_name = aws_docdb_cluster_parameter_group.mongodb.name
  db_subnet_group_name           = aws_docdb_subnet_group.mongodb.name
  vpc_security_group_ids         = [aws_security_group.mongodb.id]
  
  tags = {
    Name        = "${var.environment}-mongodb"
    Environment = var.environment
  }
}

resource "aws_docdb_cluster_instance" "mongodb" {
  count              = 2
  identifier         = "${var.environment}-mongodb-${count.index}"
  cluster_identifier = aws_docdb_cluster.mongodb.id
  instance_class     = var.mongodb_config.instance_class

  tags = {
    Name        = "${var.environment}-mongodb-${count.index}"
    Environment = var.environment
  }
}

resource "aws_docdb_cluster_parameter_group" "mongodb" {
  family = "docdb4.0"
  name   = "${var.environment}-mongodb-params"

  parameter {
    name  = "tls"
    value = "enabled"
  }

  tags = {
    Name        = "${var.environment}-mongodb-params"
    Environment = var.environment
  }
}

resource "aws_docdb_subnet_group" "mongodb" {
  name       = "${var.environment}-mongodb-subnet-group"
  subnet_ids = var.subnet_ids

  tags = {
    Name        = "${var.environment}-mongodb-subnet-group"
    Environment = var.environment
  }
}

resource "random_password" "mongodb_password" {
  length  = 16
  special = true
}

# Redis ElastiCache Cluster
resource "aws_elasticache_replication_group" "redis" {
  replication_group_id         = "${var.environment}-redis"
  description                  = "Redis cluster for ${var.environment}"
  
  node_type                    = var.redis_config.node_type
  port                         = var.redis_config.port
  parameter_group_name         = aws_elasticache_parameter_group.redis.name
  subnet_group_name            = aws_elasticache_subnet_group.redis.name
  security_group_ids           = [aws_security_group.redis.id]
  
  num_cache_clusters           = var.redis_config.num_cache_clusters
  automatic_failover_enabled   = true
  multi_az_enabled            = true
  
  snapshot_retention_limit     = 5
  snapshot_window             = "03:00-04:00"
  maintenance_window          = "sun:04:00-sun:06:00"
  
  at_rest_encryption_enabled   = true
  transit_encryption_enabled   = true
  auth_token                  = random_password.redis_auth_token.result
  
  tags = {
    Name        = "${var.environment}-redis"
    Environment = var.environment
  }
}

resource "aws_elasticache_parameter_group" "redis" {
  name   = "${var.environment}-redis-params"
  family = "redis7"

  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru"
  }

  tags = {
    Name        = "${var.environment}-redis-params"
    Environment = var.environment
  }
}

resource "aws_elasticache_subnet_group" "redis" {
  name       = "${var.environment}-redis-subnet-group"
  subnet_ids = var.subnet_ids

  tags = {
    Name        = "${var.environment}-redis-subnet-group"
    Environment = var.environment
  }
}

resource "random_password" "redis_auth_token" {
  length  = 32
  special = false
}

# Security Groups
resource "aws_security_group" "mongodb" {
  name_prefix = "${var.environment}-mongodb-"
  vpc_id      = var.vpc_id

  ingress {
    from_port   = 27017
    to_port     = 27017
    protocol    = "tcp"
    cidr_blocks = [data.aws_vpc.main.cidr_block]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.environment}-mongodb-sg"
    Environment = var.environment
  }
}

resource "aws_security_group" "redis" {
  name_prefix = "${var.environment}-redis-"
  vpc_id      = var.vpc_id

  ingress {
    from_port   = 6379
    to_port     = 6379
    protocol    = "tcp"
    cidr_blocks = [data.aws_vpc.main.cidr_block]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.environment}-redis-sg"
    Environment = var.environment
  }
}

# Data source for VPC
data "aws_vpc" "main" {
  id = var.vpc_id
}

# Secrets Manager for database credentials
resource "aws_secretsmanager_secret" "mongodb_credentials" {
  name = "${var.environment}/mongodb/credentials"
  
  tags = {
    Name        = "${var.environment}-mongodb-credentials"
    Environment = var.environment
  }
}

resource "aws_secretsmanager_secret_version" "mongodb_credentials" {
  secret_id = aws_secretsmanager_secret.mongodb_credentials.id
  secret_string = jsonencode({
    username = aws_docdb_cluster.mongodb.master_username
    password = aws_docdb_cluster.mongodb.master_password
    endpoint = aws_docdb_cluster.mongodb.endpoint
    port     = aws_docdb_cluster.mongodb.port
  })
}

resource "aws_secretsmanager_secret" "redis_credentials" {
  name = "${var.environment}/redis/credentials"
  
  tags = {
    Name        = "${var.environment}-redis-credentials"
    Environment = var.environment
  }
}

resource "aws_secretsmanager_secret_version" "redis_credentials" {
  secret_id = aws_secretsmanager_secret.redis_credentials.id
  secret_string = jsonencode({
    endpoint   = aws_elasticache_replication_group.redis.primary_endpoint_address
    port       = aws_elasticache_replication_group.redis.port
    auth_token = aws_elasticache_replication_group.redis.auth_token
  })
} 