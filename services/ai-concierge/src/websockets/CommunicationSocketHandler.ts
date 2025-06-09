/**
 * @fileoverview AeroFusionXR AI Concierge Service - Communication Socket Handler
 * @version 1.0.0
 * @author AeroFusionXR AI Engineering Team
 * @created 2024-01-15
 * @updated 2024-01-15
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import winston from 'winston';
import { DatabaseManager } from '../core/DatabaseManager';

/**
 * Communication Socket Handler Class
 * Handles real-time WebSocket connections for communication features
 */
export class CommunicationSocketHandler {
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
   * Handle new communication connection
   */
  public handleConnection(socket: Socket): void {
    this.logger.info('Communication socket connection established', { socketId: socket.id });
    this.activeConnections.add(socket.id);

    // Handle communication-specific events
    socket.on('communication:join', this.handleJoinRoom.bind(this, socket));
    socket.on('communication:message', this.handleMessage.bind(this, socket));
    socket.on('communication:leave', this.handleLeaveRoom.bind(this, socket));

    // Handle disconnection
    socket.on('disconnect', () => {
      this.activeConnections.delete(socket.id);
      this.logger.info('Communication socket disconnected', { socketId: socket.id });
    });
  }

  /**
   * Handle join room
   */
  private handleJoinRoom(socket: Socket, data: any): void {
    try {
      this.logger.info('User joined communication room', { socketId: socket.id, data });
      
      socket.join(data.roomId);
      socket.emit('communication:joined', {
        roomId: data.roomId,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.logger.error('Failed to join communication room', { socketId: socket.id, error });
      socket.emit('communication:error', { message: 'Failed to join room' });
    }
  }

  /**
   * Handle incoming message
   */
  private handleMessage(socket: Socket, data: any): void {
    try {
      this.logger.info('Communication message received', { socketId: socket.id, data });
      
      // Broadcast message to room
      socket.to(data.roomId).emit('communication:message', {
        message: data.message,
        sender: data.sender,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.logger.error('Failed to handle communication message', { socketId: socket.id, error });
      socket.emit('communication:error', { message: 'Failed to send message' });
    }
  }

  /**
   * Handle leave room
   */
  private handleLeaveRoom(socket: Socket, data: any): void {
    try {
      this.logger.info('User left communication room', { socketId: socket.id, data });
      
      socket.leave(data.roomId);
      socket.emit('communication:left', {
        roomId: data.roomId,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.logger.error('Failed to leave communication room', { socketId: socket.id, error });
      socket.emit('communication:error', { message: 'Failed to leave room' });
    }
  }

  /**
   * Get number of active connections
   */
  public getActiveConnections(): number {
    return this.activeConnections.size;
  }
} 