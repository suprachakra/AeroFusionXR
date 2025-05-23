package infra.authz

default allow = false

# Only approved environments

allow {
input.environment == "dev"
} or {
input.environment == "staging"
} or {
input.environment == "prod"
}

# VPC CIDR must follow 10.x.0.0/16 pattern

allow {
startswith(input.vpc\_cidr\_block, "10.")
count(split(input.vpc\_cidr\_block, ".")) == 4
}
# Naming conventions: resource names must start with environment prefix

allow {
startswith(input.resource\_name, input.environment)
}
