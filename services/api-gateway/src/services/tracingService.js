import { NodeSDK } from '@opentelemetry/sdk-node';
export const initTracing = (service) => new NodeSDK({ serviceName: service }).start();
