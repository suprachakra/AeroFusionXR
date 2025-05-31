#!/bin/bash

# Exit on error
set -e

# Load environment variables
if [ -f .env ]; then
  source .env
fi

# Check Docker
if ! command -v docker &> /dev/null; then
  echo "Docker is not installed. Please install Docker first."
  exit 1
fi

# Check Docker Compose
if ! command -v docker-compose &> /dev/null; then
  echo "Docker Compose is not installed. Please install Docker Compose first."
  exit 1
fi

# Start infrastructure services
echo "Starting infrastructure services..."
docker-compose up -d mongodb redis

# Wait for MongoDB
echo "Waiting for MongoDB to be ready..."
until docker-compose exec -T mongodb mongosh --eval "db.adminCommand('ping')" &> /dev/null; do
  sleep 1
done

# Install dependencies
echo "Installing dependencies..."
cd services/commerce && npm install
cd ../flight-info && pip install -r requirements.txt
cd ../../clients/web && npm install

# Build services
echo "Building services..."
cd ../../services/commerce && npm run build
cd ../flight-info && python -m compileall .

# Start development servers
echo "Starting development servers..."
docker-compose up -d

echo "Development environment is ready!"
echo "Commerce service: http://localhost:3000"
echo "Flight info service: http://localhost:8000"
echo "Web client: http://localhost:3001" 