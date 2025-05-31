/**
 * AeroFusionXR Integration Testing Framework
 * =========================================
 * 
 * Enterprise-grade TestContainers configuration for comprehensive integration testing
 * with real databases, message queues, and external services.
 * 
 * Features:
 * - Containerized test environments
 * - Real database testing (PostgreSQL, MongoDB, Redis)
 * - Message queue testing (MQTT, Kafka)
 * - Service-to-service integration testing
 * - Performance benchmarking
 * - Data migration testing
 * - API integration testing
 * - Fault tolerance testing
 */

const { GenericContainer, Network, Wait } = require('testcontainers');
const path = require('path');

class AeroFusionXRTestEnvironment {
  constructor() {
    this.containers = new Map();
    this.network = null;
    this.isSetup = false;
  }

  async setup() {
    if (this.isSetup) {
      return;
    }

    console.log('🚀 Setting up AeroFusionXR integration test environment...');

    try {
      // Create a dedicated test network
      this.network = await new Network().start();
      console.log('✅ Test network created');

      // Setup PostgreSQL for transactional data
      await this.setupPostgreSQL();
      
      // Setup MongoDB for document storage
      await this.setupMongoDB();
      
      // Setup Redis for caching and pub/sub
      await this.setupRedis();
      
      // Setup MQTT broker for IoT communications
      await this.setupMQTT();
      
      // Setup Kafka for event streaming
      await this.setupKafka();
      
      // Setup MinIO for object storage
      await this.setupMinIO();
      
      // Setup Elasticsearch for search and analytics
      await this.setupElasticsearch();
      
      // Setup Prometheus for metrics testing
      await this.setupPrometheus();

      this.isSetup = true;
      console.log('🎯 Integration test environment ready!');
      
    } catch (error) {
      console.error('❌ Failed to setup test environment:', error);
      await this.teardown();
      throw error;
    }
  }

  async setupPostgreSQL() {
    console.log('🔄 Starting PostgreSQL container...');
    
    const postgres = await new GenericContainer('postgres:15-alpine')
      .withNetwork(this.network)
      .withNetworkAliases('postgres-test')
      .withEnvironment({
        POSTGRES_DB: 'aerofusionxr_test',
        POSTGRES_USER: 'test_user',
        POSTGRES_PASSWORD: 'test_password',
        POSTGRES_INITDB_ARGS: '--auth-host=scram-sha-256'
      })
      .withExposedPorts(5432)
      .withWaitStrategy(
        Wait.forLogMessage('database system is ready to accept connections', 2)
      )
      .withStartupTimeout(60000)
      .start();

    this.containers.set('postgresql', postgres);
    
    const config = {
      host: postgres.getHost(),
      port: postgres.getMappedPort(5432),
      database: 'aerofusionxr_test',
      username: 'test_user',
      password: 'test_password',
      connectionString: `postgresql://test_user:test_password@${postgres.getHost()}:${postgres.getMappedPort(5432)}/aerofusionxr_test`
    };

    // Initialize test schemas
    await this.initializePostgreSQLSchemas(config);
    
    console.log('✅ PostgreSQL container ready');
    return config;
  }

  async setupMongoDB() {
    console.log('🔄 Starting MongoDB container...');
    
    const mongo = await new GenericContainer('mongo:7.0')
      .withNetwork(this.network)
      .withNetworkAliases('mongo-test')
      .withEnvironment({
        MONGO_INITDB_ROOT_USERNAME: 'admin',
        MONGO_INITDB_ROOT_PASSWORD: 'admin123',
        MONGO_INITDB_DATABASE: 'aerofusionxr_test'
      })
      .withExposedPorts(27017)
      .withWaitStrategy(Wait.forLogMessage('Waiting for connections'))
      .withStartupTimeout(60000)
      .start();

    this.containers.set('mongodb', mongo);
    
    const config = {
      host: mongo.getHost(),
      port: mongo.getMappedPort(27017),
      database: 'aerofusionxr_test',
      username: 'admin',
      password: 'admin123',
      connectionString: `mongodb://admin:admin123@${mongo.getHost()}:${mongo.getMappedPort(27017)}/aerofusionxr_test?authSource=admin`
    };

    console.log('✅ MongoDB container ready');
    return config;
  }

  async setupRedis() {
    console.log('🔄 Starting Redis container...');
    
    const redis = await new GenericContainer('redis:7.2-alpine')
      .withNetwork(this.network)
      .withNetworkAliases('redis-test')
      .withCommand(['redis-server', '--appendonly', 'yes', '--maxmemory', '256mb', '--maxmemory-policy', 'allkeys-lru'])
      .withExposedPorts(6379)
      .withWaitStrategy(Wait.forLogMessage('Ready to accept connections'))
      .withStartupTimeout(30000)
      .start();

    this.containers.set('redis', redis);
    
    const config = {
      host: redis.getHost(),
      port: redis.getMappedPort(6379),
      connectionString: `redis://${redis.getHost()}:${redis.getMappedPort(6379)}`
    };

    console.log('✅ Redis container ready');
    return config;
  }

  async setupMQTT() {
    console.log('🔄 Starting MQTT broker container...');
    
    const mqtt = await new GenericContainer('eclipse-mosquitto:2.0')
      .withNetwork(this.network)
      .withNetworkAliases('mqtt-test')
      .withExposedPorts(1883, 9001)
      .withCopyContentToContainer([{
        content: `
listener 1883
allow_anonymous true
listener 9001
protocol websockets
allow_anonymous true
        `,
        target: '/mosquitto/config/mosquitto.conf'
      }])
      .withWaitStrategy(Wait.forLogMessage('mosquitto version'))
      .withStartupTimeout(30000)
      .start();

    this.containers.set('mqtt', mqtt);
    
    const config = {
      host: mqtt.getHost(),
      port: mqtt.getMappedPort(1883),
      wsPort: mqtt.getMappedPort(9001),
      connectionString: `mqtt://${mqtt.getHost()}:${mqtt.getMappedPort(1883)}`
    };

    console.log('✅ MQTT broker container ready');
    return config;
  }

  async setupKafka() {
    console.log('🔄 Starting Kafka container...');
    
    // Start Zookeeper first
    const zookeeper = await new GenericContainer('confluentinc/cp-zookeeper:7.4.0')
      .withNetwork(this.network)
      .withNetworkAliases('zookeeper-test')
      .withEnvironment({
        ZOOKEEPER_CLIENT_PORT: '2181',
        ZOOKEEPER_TICK_TIME: '2000'
      })
      .withExposedPorts(2181)
      .withWaitStrategy(Wait.forLogMessage('binding to port'))
      .withStartupTimeout(60000)
      .start();

    // Start Kafka
    const kafka = await new GenericContainer('confluentinc/cp-kafka:7.4.0')
      .withNetwork(this.network)
      .withNetworkAliases('kafka-test')
      .withEnvironment({
        KAFKA_BROKER_ID: '1',
        KAFKA_ZOOKEEPER_CONNECT: 'zookeeper-test:2181',
        KAFKA_ADVERTISED_LISTENERS: 'PLAINTEXT://localhost:9092',
        KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: '1',
        KAFKA_AUTO_CREATE_TOPICS_ENABLE: 'true'
      })
      .withExposedPorts(9092)
      .withWaitStrategy(Wait.forLogMessage('started (kafka.server.KafkaServer)'))
      .withStartupTimeout(120000)
      .start();

    this.containers.set('zookeeper', zookeeper);
    this.containers.set('kafka', kafka);
    
    const config = {
      brokers: [`${kafka.getHost()}:${kafka.getMappedPort(9092)}`],
      clientId: 'aerofusionxr-test'
    };

    console.log('✅ Kafka container ready');
    return config;
  }

  async setupMinIO() {
    console.log('🔄 Starting MinIO container...');
    
    const minio = await new GenericContainer('minio/minio:latest')
      .withNetwork(this.network)
      .withNetworkAliases('minio-test')
      .withEnvironment({
        MINIO_ROOT_USER: 'minioadmin',
        MINIO_ROOT_PASSWORD: 'minioadmin123'
      })
      .withCommand(['server', '/data', '--console-address', ':9001'])
      .withExposedPorts(9000, 9001)
      .withWaitStrategy(Wait.forLogMessage('MinIO Object Storage Server'))
      .withStartupTimeout(60000)
      .start();

    this.containers.set('minio', minio);
    
    const config = {
      endpoint: `http://${minio.getHost()}:${minio.getMappedPort(9000)}`,
      accessKey: 'minioadmin',
      secretKey: 'minioadmin123',
      console: `http://${minio.getHost()}:${minio.getMappedPort(9001)}`
    };

    console.log('✅ MinIO container ready');
    return config;
  }

  async setupElasticsearch() {
    console.log('🔄 Starting Elasticsearch container...');
    
    const elasticsearch = await new GenericContainer('elasticsearch:8.11.0')
      .withNetwork(this.network)
      .withNetworkAliases('elasticsearch-test')
      .withEnvironment({
        'discovery.type': 'single-node',
        'xpack.security.enabled': 'false',
        'ES_JAVA_OPTS': '-Xms512m -Xmx512m'
      })
      .withExposedPorts(9200, 9300)
      .withWaitStrategy(Wait.forLogMessage('started'))
      .withStartupTimeout(120000)
      .start();

    this.containers.set('elasticsearch', elasticsearch);
    
    const config = {
      node: `http://${elasticsearch.getHost()}:${elasticsearch.getMappedPort(9200)}`,
      apiVersion: '8.11'
    };

    console.log('✅ Elasticsearch container ready');
    return config;
  }

  async setupPrometheus() {
    console.log('🔄 Starting Prometheus container...');
    
    const prometheus = await new GenericContainer('prom/prometheus:v2.47.0')
      .withNetwork(this.network)
      .withNetworkAliases('prometheus-test')
      .withCopyContentToContainer([{
        content: `
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']
  
  - job_name: 'aerofusionxr-services'
    static_configs:
      - targets: ['host.docker.internal:8001', 'host.docker.internal:8002']
        `,
        target: '/etc/prometheus/prometheus.yml'
      }])
      .withExposedPorts(9090)
      .withWaitStrategy(Wait.forLogMessage('Server is ready to receive web requests'))
      .withStartupTimeout(60000)
      .start();

    this.containers.set('prometheus', prometheus);
    
    const config = {
      endpoint: `http://${prometheus.getHost()}:${prometheus.getMappedPort(9090)}`
    };

    console.log('✅ Prometheus container ready');
    return config;
  }

  async initializePostgreSQLSchemas(config) {
    const { Client } = require('pg');
    const client = new Client(config.connectionString);
    
    try {
      await client.connect();
      
      // Create test schemas for all services
      const schemas = [
        'api_gateway', 'flight_info', 'booking', 'baggage_tracker',
        'ai_concierge', 'commerce', 'wayfinding'
      ];
      
      for (const schema of schemas) {
        await client.query(`CREATE SCHEMA IF NOT EXISTS ${schema};`);
      }
      
      // Create basic tables for testing
      await client.query(`
        CREATE TABLE IF NOT EXISTS api_gateway.sessions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id VARCHAR(255) NOT NULL,
          token_hash VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          expires_at TIMESTAMP NOT NULL
        );
      `);
      
      await client.query(`
        CREATE TABLE IF NOT EXISTS flight_info.flights (
          id SERIAL PRIMARY KEY,
          flight_number VARCHAR(10) NOT NULL,
          airline VARCHAR(10) NOT NULL,
          origin_code VARCHAR(3) NOT NULL,
          destination_code VARCHAR(3) NOT NULL,
          scheduled_departure TIMESTAMP WITH TIME ZONE NOT NULL,
          scheduled_arrival TIMESTAMP WITH TIME ZONE NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'UNKNOWN',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      
      console.log('✅ PostgreSQL test schemas initialized');
      
    } finally {
      await client.end();
    }
  }

  getConnectionConfigs() {
    const configs = {};
    
    this.containers.forEach((container, name) => {
      switch (name) {
        case 'postgresql':
          configs.postgresql = {
            host: container.getHost(),
            port: container.getMappedPort(5432),
            database: 'aerofusionxr_test',
            username: 'test_user',
            password: 'test_password'
          };
          break;
        case 'mongodb':
          configs.mongodb = {
            host: container.getHost(),
            port: container.getMappedPort(27017),
            database: 'aerofusionxr_test',
            username: 'admin',
            password: 'admin123'
          };
          break;
        case 'redis':
          configs.redis = {
            host: container.getHost(),
            port: container.getMappedPort(6379)
          };
          break;
        case 'mqtt':
          configs.mqtt = {
            host: container.getHost(),
            port: container.getMappedPort(1883)
          };
          break;
        case 'kafka':
          configs.kafka = {
            brokers: [`${container.getHost()}:${container.getMappedPort(9092)}`]
          };
          break;
      }
    });
    
    return configs;
  }

  async teardown() {
    console.log('🛑 Tearing down test environment...');
    
    // Stop all containers
    for (const [name, container] of this.containers) {
      try {
        await container.stop();
        console.log(`✅ ${name} container stopped`);
      } catch (error) {
        console.error(`❌ Failed to stop ${name} container:`, error.message);
      }
    }
    
    // Remove network
    if (this.network) {
      try {
        await this.network.stop();
        console.log('✅ Test network removed');
      } catch (error) {
        console.error('❌ Failed to remove test network:', error.message);
      }
    }
    
    this.containers.clear();
    this.network = null;
    this.isSetup = false;
    
    console.log('✅ Test environment teardown completed');
  }
}

// Export singleton instance
module.exports = {
  testEnvironment: new AeroFusionXRTestEnvironment(),
  
  // Jest setup and teardown hooks
  async setupTestEnvironment() {
    const env = new AeroFusionXRTestEnvironment();
    await env.setup();
    global.__TEST_ENVIRONMENT__ = env;
    return env.getConnectionConfigs();
  },
  
  async teardownTestEnvironment() {
    if (global.__TEST_ENVIRONMENT__) {
      await global.__TEST_ENVIRONMENT__.teardown();
      delete global.__TEST_ENVIRONMENT__;
    }
  }
}; 