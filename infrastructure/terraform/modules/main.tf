# SageMaker Model Registry
resource "aws_sagemaker_model_package_group" "model_registry" {
  model_package_group_name = "${var.environment}-model-registry"
  
  tags = {
    Name        = "${var.environment}-model-registry"
    Environment = var.environment
  }
}

# Feature Store (using S3 for simplicity)
resource "aws_s3_bucket" "feature_store" {
  bucket = "${var.environment}-aerofusion-feature-store"

  tags = {
    Name        = "${var.environment}-feature-store"
    Environment = var.environment
  }
}

resource "aws_s3_bucket_versioning" "feature_store" {
  bucket = aws_s3_bucket.feature_store.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "feature_store" {
  bucket = aws_s3_bucket.feature_store.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# IAM Role for SageMaker
resource "aws_iam_role" "sagemaker_role" {
  name = "${var.environment}-sagemaker-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "sagemaker.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "${var.environment}-sagemaker-role"
    Environment = var.environment
  }
}

resource "aws_iam_role_policy_attachment" "sagemaker_execution_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonSageMakerFullAccess"
  role       = aws_iam_role.sagemaker_role.name
}

# Bedrock Access (if available in region)
resource "aws_iam_role_policy" "bedrock_access" {
  name = "${var.environment}-bedrock-access"
  role = aws_iam_role.sagemaker_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream"
        ]
        Resource = "*"
      }
    ]
  })
} 