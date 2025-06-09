/**
 * @fileoverview AeroFusionXR AI Concierge Service - Baggage Socket Handler
 * @version 1.0.0
 * @author AeroFusionXR AI Engineering Team
 * @created 2024-01-15
 * @updated 2024-01-15
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import winston from 'winston';
import { DatabaseManager } from '../core/DatabaseManager';

/**
 * Baggage Socket Handler Class
 * Handles real-time WebSocket connections for baggage tracking features
 */
export class BaggageSocketHandler {
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
   * Handle new baggage tracking connection
   */
  public handleConnection(socket: Socket): void {
    this.logger.info('Baggage socket connection established', { socketId: socket.id });
    this.activeConnections.add(socket.id);

    // Handle baggage-specific events
    socket.on('baggage:track', this.handleTrackBaggage.bind(this, socket));
    socket.on('baggage:subscribe', this.handleSubscribeToBaggage.bind(this, socket));
    socket.on('baggage:unsubscribe', this.handleUnsubscribeFromBaggage.bind(this, socket));

    // Handle disconnection
    socket.on('disconnect', () => {
      this.activeConnections.delete(socket.id);
      this.logger.info('Baggage socket disconnected', { socketId: socket.id });
    });
  }

  /**
   * Handle track baggage request
   */
  private handleTrackBaggage(socket: Socket, data: any): void {
    try {
      this.logger.info('Baggage tracking requested', { socketId: socket.id, data });
      
      // Send baggage tracking information
      socket.emit('baggage:tracking-info', {
        tagNumber: data.tagNumber,
        status: 'IN_TRANSIT',
        location: 'Terminal 1 - Baggage Handling',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.logger.error('Failed to track baggage', { socketId: socket.id, error });
      socket.emit('baggage:error', { message: 'Failed to track baggage' });
    }
  }

  /**
   * Handle subscribe to baggage updates
   */
  private handleSubscribeToBaggage(socket: Socket, data: any): void {
    try {
      this.logger.info('Subscribed to baggage updates', { socketId: socket.id, data });
      
      socket.join(`baggage:${data.tagNumber}`);
      socket.emit('baggage:subscribed', {
        tagNumber: data.tagNumber,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.logger.error('Failed to subscribe to baggage updates', { socketId: socket.id, error });
      socket.emit('baggage:error', { message: 'Failed to subscribe to baggage updates' });
    }
  }

  /**
   * Handle unsubscribe from baggage updates
   */
  private handleUnsubscribeFromBaggage(socket: Socket, data: any): void {
    try {
      this.logger.info('Unsubscribed from baggage updates', { socketId: socket.id, data });
      
      socket.leave(`baggage:${data.tagNumber}`);
      socket.emit('baggage:unsubscribed', {
        tagNumber: data.tagNumber,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.logger.error('Failed to unsubscribe from baggage updates', { socketId: socket.id, error });
      socket.emit('baggage:error', { message: 'Failed to unsubscribe from baggage updates' });
    }
  }

  /**
   * Get number of active connections
   */
  public getActiveConnections(): number {
    return this.activeConnections.size;
  }
} 