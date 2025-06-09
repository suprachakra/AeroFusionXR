import { createLogger, createPerformanceMonitor, PerformanceMonitor } from '@aerofusionxr/shared';

// SOP Management interfaces
export interface SOPMetadata {
  sopID: string;
  equipmentType: string;
  version: number;
  title: Record<string, string>; // localized titles
  description: Record<string, string>; // localized descriptions
  authorID: string;
  changeLog: string;
  createdAt: Date;
  updatedAt: Date;
  isPublished: boolean;
}

export interface SOPStep {
  stepID: string;
  sopID: string;
  stepNum: number;
  instructionText: Record<string, string>; // localized instructions
  mediaAssetIDs: string[];
  anchorCoordinate: AnchorCoordinate;
  createdAt: Date;
  updatedAt: Date;
}

export interface AnchorCoordinate {
  x: number;
  y: number;
  z: number;
}

export interface SOPMediaAsset {
  assetID: string;
  sopID: string;
  mediaType: 'model3D' | 'video' | 'image';
  lod: 'high' | 'med' | 'low' | 'preview';
  mediaURL: string;
  checksum: string;
  sizeBytes: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface EquipmentSOPMapping {
  equipmentType: string;
  sopID: string;
  isActive: boolean;
  effectiveDate: Date;
}

export interface MaintenanceTask {
  taskID: string;
  equipmentID: string;
  sopID: string;
  assigneeID: string;
  status: 'assigned' | 'in_progress' | 'completed' | 'overdue';
  priority: 'low' | 'medium' | 'high';
  createdAt: Date;
  dueDate: Date;
  completedAt?: Date;
  updatedAt: Date;
}

export interface MaintenanceLog {
  logID: string;
  taskID: string;
  equipmentID: string;
  assigneeID: string;
  action: 'start' | 'complete';
  timestamp: Date;
}

export interface SOPAudit {
  auditID: string;
  sopID: string;
  action: 'create' | 'update' | 'publish' | 'rollback';
  performedBy: string;
  details: Record<string, any>;
  timestamp: Date;
}

export interface CalibrationJob {
  jobID: string;
  runBy: string;
  anchors: AnchorCalibrationData[];
  rmse?: number;
  status: 'running' | 'completed' | 'failed';
  startedAt: Date;
  completedAt?: Date;
  errorMessage?: string;
}

export interface AnchorCalibrationData {
  anchorID: string;
  location: AnchorCoordinate;
}

export interface SOPCreateRequest {
  equipmentType: string;
  title: Record<string, string>;
  description: Record<string, string>;
  changeLog: string;
  authorID: string;
  steps: SOPStepData[];
}

export interface SOPStepData {
  stepNum: number;
  instructionText: Record<string, string>;
  anchorCoordinate: AnchorCoordinate;
  mediaFiles: MediaFileData[];
}

export interface MediaFileData {
  fileName: string;
  fileType: 'model3D' | 'video' | 'image';
  lod: 'high' | 'med' | 'low' | 'preview';
  fileData: ArrayBuffer;
}

export interface SOPSnapshot {
  sopID: string;
  equipmentID: string;
  version: number;
  title: Record<string, string>;
  description: Record<string, string>;
  steps: SOPStepResponse[];
  effectiveDate: Date;
  publishedAt: Date;
}

export interface SOPStepResponse {
  stepNum: number;
  instructionText: Record<string, string>;
  anchorCoordinate: AnchorCoordinate;
  media: SOPMediaResponse[];
}

export interface SOPMediaResponse {
  assetID: string;
  mediaType: 'model3D' | 'video' | 'image';
  lod: 'high' | 'med' | 'low' | 'preview';
  mediaURL: string;
  checksum: string;
}

export interface TaskAssignmentRequest {
  equipmentID: string;
  sopID: string;
  assigneeID: string;
  dueDate: Date;
  priority: 'low' | 'medium' | 'high';
}

export interface TaskAssignmentResponse {
  taskID: string;
  status: string;
  createdAt: Date;
}

export interface SOPRollbackRequest {
  targetVersion: number;
}

export interface SOPRollbackResponse {
  sopID: string;
  version: number;
  status: string;
}

/**
 * Maintenance SOP Feature Module
 * Consolidated from maintenance-sop service into baggage-tracker
 * 
 * Features:
 * - Standard Operating Procedure (SOP) management for baggage handling equipment
 * - AR-guided maintenance instructions with 3D models and videos
 * - Task assignment and tracking for maintenance personnel
 * - Multi-language support for international teams
 * - Version control and audit trails for SOPs
 * - Equipment calibration and spatial anchoring
 * - Performance monitoring and compliance tracking
 */
export class MaintenanceSOPFeature {
  private logger = createLogger('baggage-tracker.maintenance');
  private performanceMonitor = createPerformanceMonitor('maintenance-sop');
  private sopMetadataCache: Map<string, SOPMetadata> = new Map();
  private sopStepsCache: Map<string, SOPStep[]> = new Map();
  private tasksCache: Map<string, MaintenanceTask> = new Map();
  private equipmentSOPMappings: Map<string, EquipmentSOPMapping> = new Map();
  private calibrationJobs: Map<string, CalibrationJob> = new Map();

  constructor() {
    this.logger.info('Maintenance SOP Feature initialized');
  }

  /**
   * Create a new Standard Operating Procedure
   * @param request - SOP creation request with steps and media
   */
  async createSOP(request: SOPCreateRequest): Promise<{ sopID: string; version: number; status: string }> {
    const timer = this.performanceMonitor.startTimer('create_sop');
    
    try {
      this.logger.info('Creating new SOP', {
        equipmentType: request.equipmentType,
        authorID: request.authorID,
        stepCount: request.steps.length
      });

      // Validate request
      if (!request.equipmentType || !request.authorID || !request.steps.length) {
        throw new Error('Invalid SOP creation request: missing required fields');
      }

      // Generate SOP ID and version
      const sopID = `sop_${request.equipmentType}_${Date.now()}`;
      const version = await this.getNextVersion(request.equipmentType);

      // Create SOP metadata
      const metadata: SOPMetadata = {
        sopID,
        equipmentType: request.equipmentType,
        version,
        title: request.title,
        description: request.description,
        authorID: request.authorID,
        changeLog: request.changeLog,
        createdAt: new Date(),
        updatedAt: new Date(),
        isPublished: false
      };

      // Store metadata
      this.sopMetadataCache.set(sopID, metadata);

      // Process and store steps
      const steps: SOPStep[] = [];
      for (const stepData of request.steps) {
        const stepID = `${sopID}_step_${stepData.stepNum}`;
        
        // Upload media assets for this step
        const mediaAssetIDs: string[] = [];
        for (const mediaFile of stepData.mediaFiles) {
          const assetID = await this.uploadMediaAsset(sopID, mediaFile);
          mediaAssetIDs.push(assetID);
        }

        const step: SOPStep = {
          stepID,
          sopID,
          stepNum: stepData.stepNum,
          instructionText: stepData.instructionText,
          mediaAssetIDs,
          anchorCoordinate: stepData.anchorCoordinate,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        steps.push(step);
      }

      // Store steps
      this.sopStepsCache.set(sopID, steps);

      // Log audit entry
      await this.logAuditEntry(sopID, 'create', request.authorID, {
        version,
        stepCount: steps.length,
        equipmentType: request.equipmentType
      });

      this.performanceMonitor.recordMetric('sop_created', 1, {
        equipmentType: request.equipmentType,
        stepCount: steps.length,
        version
      });

      this.logger.info('SOP created successfully', {
        sopID,
        version,
        stepCount: steps.length
      });

      timer.end(true);
      return { sopID, version, status: 'created' };

    } catch (error) {
      timer.end(false);
      this.logger.error('Failed to create SOP', {
        equipmentType: request.equipmentType,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Publish an SOP to make it available for use
   * @param sopID - SOP identifier
   * @param publishedBy - User ID who is publishing the SOP
   */
  async publishSOP(sopID: string, publishedBy: string): Promise<{ sopID: string; version: number; status: string; publishedAt: Date }> {
    const timer = this.performanceMonitor.startTimer('publish_sop');
    
    try {
      this.logger.info('Publishing SOP', { sopID, publishedBy });

      const metadata = this.sopMetadataCache.get(sopID);
      if (!metadata) {
        throw new Error(`SOP not found: ${sopID}`);
      }

      if (metadata.isPublished) {
        throw new Error(`SOP already published: ${sopID}`);
      }

      // Validate SOP has steps
      const steps = this.sopStepsCache.get(sopID);
      if (!steps || steps.length === 0) {
        throw new Error(`Cannot publish SOP without steps: ${sopID}`);
      }

      // Update metadata
      metadata.isPublished = true;
      metadata.updatedAt = new Date();
      const publishedAt = new Date();

      // Create equipment mapping
      const mapping: EquipmentSOPMapping = {
        equipmentType: metadata.equipmentType,
        sopID,
        isActive: true,
        effectiveDate: publishedAt
      };

      this.equipmentSOPMappings.set(`${metadata.equipmentType}_${sopID}`, mapping);

      // Log audit entry
      await this.logAuditEntry(sopID, 'publish', publishedBy, {
        version: metadata.version,
        publishedAt
      });

      this.performanceMonitor.recordMetric('sop_published', 1, {
        equipmentType: metadata.equipmentType,
        version: metadata.version
      });

      this.logger.info('SOP published successfully', {
        sopID,
        version: metadata.version,
        equipmentType: metadata.equipmentType
      });

      timer.end(true);
      return {
        sopID,
        version: metadata.version,
        status: 'published',
        publishedAt
      };

    } catch (error) {
      timer.end(false);
      this.logger.error('Failed to publish SOP', {
        sopID,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get the latest SOP for specific equipment
   * @param equipmentID - Equipment identifier
   */
  async getLatestSOP(equipmentID: string): Promise<SOPSnapshot> {
    const timer = this.performanceMonitor.startTimer('get_latest_sop');
    
    try {
      this.logger.info('Getting latest SOP', { equipmentID });

      // Get equipment type
      const equipmentType = await this.getEquipmentType(equipmentID);

      // Find active SOP mapping for this equipment type
      let activeSOP: EquipmentSOPMapping | undefined;
      for (const [key, mapping] of this.equipmentSOPMappings.entries()) {
        if (mapping.equipmentType === equipmentType && mapping.isActive) {
          activeSOP = mapping;
          break;
        }
      }

      if (!activeSOP) {
        throw new Error(`No active SOP found for equipment type: ${equipmentType}`);
      }

      // Get SOP metadata
      const metadata = this.sopMetadataCache.get(activeSOP.sopID);
      if (!metadata) {
        throw new Error(`SOP metadata not found: ${activeSOP.sopID}`);
      }

      // Get SOP steps
      const steps = this.sopStepsCache.get(activeSOP.sopID);
      if (!steps) {
        throw new Error(`SOP steps not found: ${activeSOP.sopID}`);
      }

      // Build step responses with media
      const stepResponses: SOPStepResponse[] = [];
      for (const step of steps.sort((a, b) => a.stepNum - b.stepNum)) {
        const media: SOPMediaResponse[] = [];
        
        for (const assetID of step.mediaAssetIDs) {
          const asset = await this.getMediaAsset(assetID);
          if (asset) {
            media.push({
              assetID: asset.assetID,
              mediaType: asset.mediaType,
              lod: asset.lod,
              mediaURL: asset.mediaURL,
              checksum: asset.checksum
            });
          }
        }

        stepResponses.push({
          stepNum: step.stepNum,
          instructionText: step.instructionText,
          anchorCoordinate: step.anchorCoordinate,
          media
        });
      }

      const snapshot: SOPSnapshot = {
        sopID: metadata.sopID,
        equipmentID,
        version: metadata.version,
        title: metadata.title,
        description: metadata.description,
        steps: stepResponses,
        effectiveDate: activeSOP.effectiveDate,
        publishedAt: metadata.updatedAt
      };

      this.performanceMonitor.recordMetric('sop_retrieved', 1, {
        equipmentType,
        version: metadata.version,
        stepCount: stepResponses.length
      });

      timer.end(true);
      return snapshot;

    } catch (error) {
      timer.end(false);
      this.logger.error('Failed to get latest SOP', {
        equipmentID,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Create a maintenance task assignment
   * @param request - Task assignment request
   */
  async createTask(request: TaskAssignmentRequest): Promise<TaskAssignmentResponse> {
    const timer = this.performanceMonitor.startTimer('create_maintenance_task');
    
    try {
      this.logger.info('Creating maintenance task', {
        equipmentID: request.equipmentID,
        sopID: request.sopID,
        assigneeID: request.assigneeID
      });

      // Validate SOP exists and is published
      const metadata = this.sopMetadataCache.get(request.sopID);
      if (!metadata || !metadata.isPublished) {
        throw new Error(`SOP not found or not published: ${request.sopID}`);
      }

      // Generate task ID
      const taskID = `task_${request.equipmentID}_${Date.now()}`;

      // Create task
      const task: MaintenanceTask = {
        taskID,
        equipmentID: request.equipmentID,
        sopID: request.sopID,
        assigneeID: request.assigneeID,
        status: 'assigned',
        priority: request.priority,
        createdAt: new Date(),
        dueDate: request.dueDate,
        updatedAt: new Date()
      };

      // Store task
      this.tasksCache.set(taskID, task);

      // Log maintenance action
      await this.logMaintenanceAction(taskID, request.equipmentID, request.assigneeID, 'assigned');

      this.performanceMonitor.recordMetric('maintenance_task_created', 1, {
        equipmentID: request.equipmentID,
        priority: request.priority,
        sopVersion: metadata.version
      });

      this.logger.info('Maintenance task created successfully', {
        taskID,
        equipmentID: request.equipmentID,
        dueDate: request.dueDate
      });

      timer.end(true);
      return {
        taskID,
        status: 'assigned',
        createdAt: task.createdAt
      };

    } catch (error) {
      timer.end(false);
      this.logger.error('Failed to create maintenance task', {
        equipmentID: request.equipmentID,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Start a maintenance task
   * @param taskID - Task identifier
   * @param startedBy - User ID who started the task
   */
  async startTask(taskID: string, startedBy: string): Promise<{ taskID: string; status: string; updatedAt: Date }> {
    const timer = this.performanceMonitor.startTimer('start_maintenance_task');
    
    try {
      this.logger.info('Starting maintenance task', { taskID, startedBy });

      const task = this.tasksCache.get(taskID);
      if (!task) {
        throw new Error(`Task not found: ${taskID}`);
      }

      if (task.status !== 'assigned') {
        throw new Error(`Task cannot be started from status: ${task.status}`);
      }

      // Update task status
      task.status = 'in_progress';
      task.updatedAt = new Date();

      // Log maintenance action
      await this.logMaintenanceAction(taskID, task.equipmentID, startedBy, 'start');

      this.performanceMonitor.recordMetric('maintenance_task_started', 1, {
        equipmentID: task.equipmentID,
        priority: task.priority
      });

      this.logger.info('Maintenance task started successfully', {
        taskID,
        equipmentID: task.equipmentID
      });

      timer.end(true);
      return {
        taskID,
        status: task.status,
        updatedAt: task.updatedAt
      };

    } catch (error) {
      timer.end(false);
      this.logger.error('Failed to start maintenance task', {
        taskID,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Complete a maintenance task
   * @param taskID - Task identifier
   * @param completedBy - User ID who completed the task
   */
  async completeTask(taskID: string, completedBy: string): Promise<{ taskID: string; status: string; completedAt: Date }> {
    const timer = this.performanceMonitor.startTimer('complete_maintenance_task');
    
    try {
      this.logger.info('Completing maintenance task', { taskID, completedBy });

      const task = this.tasksCache.get(taskID);
      if (!task) {
        throw new Error(`Task not found: ${taskID}`);
      }

      if (task.status !== 'in_progress') {
        throw new Error(`Task cannot be completed from status: ${task.status}`);
      }

      // Update task status
      task.status = 'completed';
      task.completedAt = new Date();
      task.updatedAt = new Date();

      // Log maintenance action
      await this.logMaintenanceAction(taskID, task.equipmentID, completedBy, 'complete');

      // Send completion notification
      await this.sendTaskCompletionNotification(task, completedBy);

      this.performanceMonitor.recordMetric('maintenance_task_completed', 1, {
        equipmentID: task.equipmentID,
        priority: task.priority,
        duration: task.completedAt.getTime() - task.createdAt.getTime()
      });

      this.logger.info('Maintenance task completed successfully', {
        taskID,
        equipmentID: task.equipmentID,
        completedAt: task.completedAt
      });

      timer.end(true);
      return {
        taskID,
        status: task.status,
        completedAt: task.completedAt
      };

    } catch (error) {
      timer.end(false);
      this.logger.error('Failed to complete maintenance task', {
        taskID,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get maintenance task details
   * @param taskID - Task identifier
   */
  async getTask(taskID: string): Promise<MaintenanceTask> {
    const timer = this.performanceMonitor.startTimer('get_maintenance_task');
    
    try {
      const task = this.tasksCache.get(taskID);
      if (!task) {
        throw new Error(`Task not found: ${taskID}`);
      }

      timer.end(true);
      return task;

    } catch (error) {
      timer.end(false);
      this.logger.error('Failed to get maintenance task', {
        taskID,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  // Private helper methods

  private async getNextVersion(equipmentType: string): Promise<number> {
    // Find highest version for this equipment type
    let maxVersion = 0;
    for (const metadata of this.sopMetadataCache.values()) {
      if (metadata.equipmentType === equipmentType && metadata.version > maxVersion) {
        maxVersion = metadata.version;
      }
    }
    return maxVersion + 1;
  }

  private async uploadMediaAsset(sopID: string, mediaFile: MediaFileData): Promise<string> {
    const assetID = `${sopID}_${mediaFile.fileName}_${Date.now()}`;
    
    // Mock upload - in real implementation, this would upload to CDN/storage
    const mediaURL = `https://assets.aerofusionxr.com/sop/${sopID}/${assetID}.${this.getFileExtension(mediaFile.fileType)}`;
    
    const asset: SOPMediaAsset = {
      assetID,
      sopID,
      mediaType: mediaFile.fileType,
      lod: mediaFile.lod,
      mediaURL,
      checksum: this.computeChecksum(mediaFile.fileData),
      sizeBytes: mediaFile.fileData.byteLength,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Store asset metadata (in real implementation, this would be in database)
    // For now, we'll just return the asset ID
    
    this.logger.debug('Media asset uploaded', {
      assetID,
      mediaType: mediaFile.fileType,
      sizeBytes: asset.sizeBytes
    });

    return assetID;
  }

  private async getMediaAsset(assetID: string): Promise<SOPMediaAsset | null> {
    // Mock implementation - in real app, this would query database
    return {
      assetID,
      sopID: assetID.split('_')[0] + '_' + assetID.split('_')[1],
      mediaType: 'model3D',
      lod: 'high',
      mediaURL: `https://assets.aerofusionxr.com/sop/${assetID}`,
      checksum: 'mock_checksum',
      sizeBytes: 1024 * 1024, // 1MB
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  private async getEquipmentType(equipmentID: string): Promise<string> {
    // Mock implementation - in real app, this would query equipment database
    if (equipmentID.includes('conveyor')) return 'baggage_conveyor';
    if (equipmentID.includes('scanner')) return 'baggage_scanner';
    if (equipmentID.includes('sorter')) return 'baggage_sorter';
    return 'generic_equipment';
  }

  private getFileExtension(fileType: string): string {
    switch (fileType) {
      case 'model3D': return 'glb';
      case 'video': return 'mp4';
      case 'image': return 'jpg';
      default: return 'bin';
    }
  }

  private computeChecksum(data: ArrayBuffer): string {
    // Mock checksum - in real implementation, this would compute actual hash
    return `checksum_${data.byteLength}_${Date.now()}`;
  }

  private async logAuditEntry(sopID: string, action: string, performedBy: string, details: any): Promise<void> {
    const audit: SOPAudit = {
      auditID: `audit_${sopID}_${Date.now()}`,
      sopID,
      action: action as any,
      performedBy,
      details,
      timestamp: new Date()
    };

    this.logger.debug('SOP audit entry logged', {
      auditID: audit.auditID,
      action,
      performedBy
    });
  }

  private async logMaintenanceAction(taskID: string, equipmentID: string, performedBy: string, action: string): Promise<void> {
    const log: MaintenanceLog = {
      logID: `log_${taskID}_${Date.now()}`,
      taskID,
      equipmentID,
      assigneeID: performedBy,
      action: action as any,
      timestamp: new Date()
    };

    this.logger.debug('Maintenance action logged', {
      logID: log.logID,
      taskID,
      action
    });
  }

  private async sendTaskCompletionNotification(task: MaintenanceTask, completedBy: string): Promise<void> {
    this.logger.info('Sending task completion notification', {
      taskID: task.taskID,
      equipmentID: task.equipmentID,
      completedBy
    });
    
    // Implementation would send notification to supervisors, update dashboards, etc.
  }
} 