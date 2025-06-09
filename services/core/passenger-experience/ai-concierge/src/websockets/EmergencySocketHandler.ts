/**
 * @fileoverview AeroFusionXR AI Concierge Service - Emergency Socket Handler
 * @version 1.0.0
 * @author AeroFusionXR AI Engineering Team
 * @created 2024-01-15
 * @updated 2024-01-15
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import winston from 'winston';
import { DatabaseManager } from '../core/DatabaseManager';

/**
 * Emergency Socket Handler Class
 * Handles real-time WebSocket connections for emergency management features
 */
export class EmergencySocketHandler {
  private io: SocketIOServer;
  private database: DatabaseManager;
  private logger: winston.Logger;
  private activeConnections: Set<string> = new Set();

  constructor(io: SocketIOServer, database: DatabaseManager, logger: winston.Logger) {
    this.io = io;
    this.database = database;
    this.logger = logger;
  }

  /**
   * Handle new emergency connection
   */
  public handleConnection(socket: Socket): void {
    this.logger.info('Emergency socket connection established', { socketId: socket.id });
    this.activeConnections.add(socket.id);

    // Handle emergency-specific events
    socket.on('emergency:report', this.handleEmergencyReport.bind(this, socket));
    socket.on('emergency:subscribe', this.handleSubscribeToAlerts.bind(this, socket));
    socket.on('emergency:unsubscribe', this.handleUnsubscribeFromAlerts.bind(this, socket));

    // Handle disconnection
    socket.on('disconnect', () => {
      this.activeConnections.delete(socket.id);
      this.logger.info('Emergency socket disconnected', { socketId: socket.id });
    });
  }

  /**
   * Handle emergency report
   */
  private handleEmergencyReport(socket: Socket, data: any): void {
    try {
      this.logger.warn('Emergency reported', { socketId: socket.id, data });
      
      // Broadcast emergency to all connected clients
      this.io.emit('emergency:alert', {
        type: data.type,
        location: data.location,
        severity: data.severity,
        timestamp: new Date().toISOString()
      });

      socket.emit('emergency:reported', {
        incidentId: 'placeholder-incident-id',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.logger.error('Failed to handle emergency report', { socketId: socket.id, error });
      socket.emit('emergency:error', { message: 'Failed to report emergency' });
    }
  }

  /**
   * Handle subscribe to emergency alerts
   */
  private handleSubscribeToAlerts(socket: Socket, data: any): void {
    try {
      this.logger.info('Subscribed to emergency alerts', { socketId: socket.id, data });
      
      socket.join('emergency:alerts');
      socket.emit('emergency:subscribed', {
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.logger.error('Failed to subscribe to emergency alerts', { socketId: socket.id, error });
      socket.emit('emergency:error', { message: 'Failed to subscribe to emergency alerts' });
    }
  }

  /**
   * Handle unsubscribe from emergency alerts
   */
  private handleUnsubscribeFromAlerts(socket: Socket, data: any): void {
    try {
      this.logger.info('Unsubscribed from emergency alerts', { socketId: socket.id, data });
      
      socket.leave('emergency:alerts');
      socket.emit('emergency:unsubscribed', {
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.logger.error('Failed to unsubscribe from emergency alerts', { socketId: socket.id, error });
      socket.emit('emergency:error', { message: 'Failed to unsubscribe from emergency alerts' });
    }
  }

  /**
   * Get number of active connections
   */
  public getActiveConnections(): number {
    return this.activeConnections.size;
  }
} 