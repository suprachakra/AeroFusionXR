import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { createLogger } from '@aerofusionxr/shared';
import { metrics } from '../utils/metrics';
import { ARAsset } from '../models/Product';

export class ARService {
  private s3: S3Client;
  private logger: Logger;
  private readonly bucketName: string;

  // Metrics
  private readonly modelLoadLatencyHistogram = metrics.createHistogram({
    name: 'ar_model_load_latency_seconds',
    help: 'Time taken to load AR models',
    labelNames: ['model_type']
  });

  private readonly modelLoadErrorCounter = metrics.createCounter({
    name: 'ar_model_load_errors_total',
    help: 'Total number of AR model loading errors',
    labelNames: ['error_type']
  });

  constructor(
    region: string,
    bucketName: string
  ) {
    this.s3 = new S3Client({ region });
    this.bucketName = bucketName;
    this.logger = createLogger('commerce-ar');
  }

  /**
   * Load a 3D model with appropriate LOD based on device capabilities
   */
  public async loadModel(
    asset: ARAsset,
    deviceCapabilities: {
      maxTriangles: number;
      maxTextureSize: number;
      supportedFormats: string[];
    }
  ): Promise<{
    modelUrl: string;
    format: string;
    triangleCount: number;
  }> {
    const startTime = Date.now();
    try {
      // Select appropriate LOD based on device capabilities
      const selectedLod = this.selectLOD(asset.lods, deviceCapabilities.maxTriangles);
      
      // Select format (GLTF vs USDC)
      const format = deviceCapabilities.supportedFormats.includes('usdc') && asset.usdcUrl
        ? 'usdc'
        : 'gltf';
      
      const modelUrl = format === 'usdc' ? asset.usdcUrl! : selectedLod.url;

      // Generate signed URL for model access
      const signedUrl = await this.generateSignedUrl(modelUrl);

      const latency = (Date.now() - startTime) / 1000;
      this.modelLoadLatencyHistogram.observe({ model_type: format }, latency);

      return {
        modelUrl: signedUrl,
        format,
        triangleCount: selectedLod.triangleCount
      };
    } catch (error) {
      this.logger.error('Error loading AR model:', error);
      this.modelLoadErrorCounter.inc({ error_type: (error as Error).name });
      throw error;
    }
  }

  /**
   * Select the appropriate LOD based on device capabilities
   */
  private selectLOD(
    lods: ARAsset['lods'],
    maxTriangles: number
  ): ARAsset['lods'][0] {
    // Sort LODs by triangle count in ascending order
    const sortedLods = [...lods].sort((a, b) => a.triangleCount - b.triangleCount);
    
    // Find the highest quality LOD that fits within device constraints
    const selectedLod = sortedLods.reverse().find(lod => lod.triangleCount <= maxTriangles);
    
    // If no LOD fits, use the lowest quality one
    return selectedLod || sortedLods[sortedLods.length - 1];
  }

  /**
   * Generate a signed URL for accessing a model
   */
  private async generateSignedUrl(key: string): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key
      });

      // URL expires in 1 hour
      return await this.s3.getSignedUrl(command, { expiresIn: 3600 });
    } catch (error) {
      this.logger.error('Error generating signed URL:', error);
      throw error;
    }
  }

  /**
   * Upload a new AR model
   */
  public async uploadModel(
    file: Buffer,
    key: string,
    metadata: {
      format: string;
      triangleCount: number;
      textureSize: number;
    }
  ): Promise<string> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: file,
        ContentType: metadata.format === 'gltf' ? 'model/gltf+json' : 'model/vnd.usd',
        Metadata: {
          triangleCount: metadata.triangleCount.toString(),
          textureSize: metadata.textureSize.toString()
        }
      });

      await this.s3.send(command);
      return `https://${this.bucketName}.s3.amazonaws.com/${key}`;
    } catch (error) {
      this.logger.error('Error uploading AR model:', error);
      throw error;
    }
  }

  /**
   * Check device compatibility for AR features
   */
  public checkDeviceCompatibility(userAgent: string): {
    arSupported: boolean;
    maxTriangles: number;
    maxTextureSize: number;
    supportedFormats: string[];
  } {
    // Basic device detection (should be enhanced with proper device detection library)
    const isIOS = /iphone|ipad|ipod/i.test(userAgent);
    const isAndroid = /android/i.test(userAgent);
    const isHighEnd = /iphone 1[3-9]|ipad pro|samsung galaxy s2[1-3]|pixel [6-7]/i.test(userAgent);

    const supportedFormats = ['gltf'];
    if (isIOS) supportedFormats.push('usdc');

    return {
      arSupported: isIOS || isAndroid,
      maxTriangles: isHighEnd ? 100000 : 50000,
      maxTextureSize: isHighEnd ? 4096 : 2048,
      supportedFormats
    };
  }

  /**
   * Optimize model for target device
   */
  public async optimizeModel(
    modelId: string,
    optimizationLevel: 'low' | 'medium' | 'high' = 'medium',
    targetPlatform: 'mobile' | 'desktop' | 'vr' = 'mobile'
  ): Promise<{
    optimizedUrl: string;
    compressionRatio: number;
    triangleReduction: number;
    textureCompression: string;
    processingTime: number;
  }> {
    const startTime = Date.now();
    
    try {
      this.logger.info(`Starting model optimization for ${modelId}`, {
        optimizationLevel,
        targetPlatform
      });

      // Get the original model
      const originalAsset = await this.getOptimizedAsset(modelId, {});
      if (!originalAsset) {
        throw new Error(`Model ${modelId} not found`);
      }

      // Define optimization parameters based on level and platform
      const optimizationParams = this.getOptimizationParameters(optimizationLevel, targetPlatform);
      
      // Simulate model optimization process
      const optimizedAsset = await this.performModelOptimization(originalAsset, optimizationParams);
      
      // Upload optimized version to S3
      const optimizedKey = `${modelId}_optimized_${optimizationLevel}_${targetPlatform}.gltf`;
      await this.uploadOptimizedModel(optimizedKey, optimizedAsset);
      
      const processingTime = Date.now() - startTime;
      
      this.logger.info(`Model optimization completed for ${modelId}`, {
        processingTime: `${processingTime}ms`,
        compressionRatio: optimizedAsset.compressionRatio,
        triangleReduction: optimizedAsset.triangleReduction
      });

      // Update metrics
      this.modelOptimizationCounter.inc({
        optimization_level: optimizationLevel,
        target_platform: targetPlatform
      });

      return {
        optimizedUrl: `https://${this.bucketName}.s3.amazonaws.com/${optimizedKey}`,
        compressionRatio: optimizedAsset.compressionRatio,
        triangleReduction: optimizedAsset.triangleReduction,
        textureCompression: optimizedAsset.textureCompression,
        processingTime
      };

    } catch (error) {
      this.logger.error('Model optimization failed:', error);
      
      this.modelLoadErrorCounter.inc({
        error_type: 'optimization_failed'
      });
      
      throw error;
    }
  }

  private getOptimizationParameters(
    level: 'low' | 'medium' | 'high',
    platform: 'mobile' | 'desktop' | 'vr'
  ): {
    triangleReduction: number;
    textureSize: number;
    textureFormat: string;
    compressionLevel: number;
  } {
    const baseParams = {
      mobile: {
        low: { triangleReduction: 0.3, textureSize: 512, textureFormat: 'ETC2', compressionLevel: 0.7 },
        medium: { triangleReduction: 0.5, textureSize: 256, textureFormat: 'ETC2', compressionLevel: 0.8 },
        high: { triangleReduction: 0.7, textureSize: 128, textureFormat: 'ETC2', compressionLevel: 0.9 }
      },
      desktop: {
        low: { triangleReduction: 0.2, textureSize: 1024, textureFormat: 'BC7', compressionLevel: 0.6 },
        medium: { triangleReduction: 0.4, textureSize: 512, textureFormat: 'BC7', compressionLevel: 0.7 },
        high: { triangleReduction: 0.6, textureSize: 256, textureFormat: 'BC7', compressionLevel: 0.8 }
      },
      vr: {
        low: { triangleReduction: 0.25, textureSize: 1024, textureFormat: 'ASTC', compressionLevel: 0.65 },
        medium: { triangleReduction: 0.45, textureSize: 512, textureFormat: 'ASTC', compressionLevel: 0.75 },
        high: { triangleReduction: 0.65, textureSize: 256, textureFormat: 'ASTC', compressionLevel: 0.85 }
      }
    };

    return baseParams[platform][level];
  }

  private async performModelOptimization(
    originalAsset: any,
    params: any
  ): Promise<{
    data: Buffer;
    compressionRatio: number;
    triangleReduction: number;
    textureCompression: string;
  }> {
    // Simulate model optimization processing
    // In a real implementation, this would use tools like:
    // - Draco compression for geometry
    // - Basis Universal for texture compression
    // - Custom LOD generation algorithms
    // - Mesh simplification algorithms

    const originalSize = originalAsset.data?.length || 1000000; // 1MB default
    
    // Simulate geometry optimization
    const triangleReduction = params.triangleReduction;
    const geometryCompressionRatio = 1 - (triangleReduction * 0.6); // Geometry size reduction
    
    // Simulate texture optimization
    const textureCompressionRatio = 1 - params.compressionLevel;
    
    // Combined compression ratio
    const totalCompressionRatio = geometryCompressionRatio * textureCompressionRatio;
    
    // Simulate processing delay (in real implementation, this would be actual optimization)
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
    
    // Generate optimized data (simulated)
    const optimizedSize = Math.floor(originalSize * totalCompressionRatio);
    const optimizedData = Buffer.alloc(optimizedSize, 0);
    
    return {
      data: optimizedData,
      compressionRatio: 1 - totalCompressionRatio,
      triangleReduction: triangleReduction,
      textureCompression: params.textureFormat
    };
  }

  private async uploadOptimizedModel(key: string, optimizedAsset: any): Promise<void> {
    try {
      await this.s3.send(new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: optimizedAsset.data,
        ContentType: 'model/gltf+json',
        Metadata: {
          'optimization-level': 'optimized',
          'compression-ratio': optimizedAsset.compressionRatio.toString(),
          'triangle-reduction': optimizedAsset.triangleReduction.toString(),
          'texture-compression': optimizedAsset.textureCompression,
          'created-at': new Date().toISOString()
        }
      }));

      this.logger.info(`Optimized model uploaded: ${key}`);

    } catch (error) {
      this.logger.error('Failed to upload optimized model:', error);
      throw error;
    }
  }
} 
