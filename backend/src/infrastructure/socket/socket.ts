// backend/src/infrastructure/socket/socket.ts
import { Server } from 'socket.io';
import type { Server as HTTPServer } from 'http';
import { config } from '../../config/environment';
import { MessageRepository } from '../../domain/repositories/message.repository';
import { ConversationRepository } from '../../domain/repositories/conversation.repository';
import { MySQLUserRepository } from '../database/repositories/MySQLUserRepository';
import { ChatService } from '../../application/services/chat.service';
import { database } from '../database/mysql/connection';
import { UserStatus } from '../../shared/types/user.types';

export class SocketService {
  private io: Server;
  private connectedUsers: Map<number, string> = new Map();
  private chatService: ChatService;
  private userRepository: MySQLUserRepository;

  constructor(httpServer: HTTPServer) {
    const allowedOrigins = [
      process.env.FRONTEND_URL || 'http://localhost:5173', 
      config.cors.origin,
      'http://10.79.11.214:5173', 
      'https://specifically-semihumanistic-maria.ngrok-free.dev',
    ];
    
    this.io = new Server(httpServer, {
      cors: {
        origin: allowedOrigins,
        methods: ['GET', 'POST'],
        credentials: true,
      },
    });

    const pool = database.getPool();
    const messageRepository = new MessageRepository(pool);
    const conversationRepository = new ConversationRepository(pool);
    this.userRepository = new MySQLUserRepository();
    this.chatService = new ChatService(messageRepository, conversationRepository);

    this.initialize();
  }

  private initialize() {
    this.io.on('connection', (socket) => {
      console.log('✅ Usuario conectado:', socket.id);

      socket.on('authenticate', async (userId: number) => {
        console.log(`🔐 Usuario ${userId} autenticado con socket ${socket.id}`);
        this.connectedUsers.set(userId, socket.id);
        
        try {
          await this.userRepository.updateStatus(userId, UserStatus.ONLINE);
          console.log(`✅ Usuario ${userId} marcado como ONLINE en BD`);
        } catch (error) {
          console.error(`❌ Error al actualizar estado de usuario ${userId}:`, error);
        }
        
        socket.emit('authenticated', { userId, socketId: socket.id });
        this.io.emit('user:online', { userId });
      });

      socket.on('message:send', (data: {
        from: number;
        to: number;
        content: string;
        timestamp: string;
      }) => {
        console.log('📨 Mensaje recibido:', data);
        
        const recipientSocketId = this.connectedUsers.get(data.to);
        
        if (recipientSocketId) {
          this.io.to(recipientSocketId).emit('message:receive', data);
          console.log(`✅ Mensaje enviado a usuario ${data.to}`);
        } else {
          console.log(`⚠️ Usuario ${data.to} no está conectado`);
        }
        
        socket.emit('message:sent', { success: true, data });
      });

      socket.on('typing:start', (data: { from: number; to: number }) => {
        const recipientSocketId = this.connectedUsers.get(data.to);
        if (recipientSocketId) {
          this.io.to(recipientSocketId).emit('typing:start', data);
        }
      });

      socket.on('typing:stop', (data: { from: number; to: number }) => {
        const recipientSocketId = this.connectedUsers.get(data.to);
        if (recipientSocketId) {
          this.io.to(recipientSocketId).emit('typing:stop', data);
        }
      });

      socket.on('message:read', (data: { messageId: number; userId: number }) => {
        const recipientSocketId = this.connectedUsers.get(data.userId);
        if (recipientSocketId) {
          this.io.to(recipientSocketId).emit('message:read', data);
        }
      });

      socket.on('chat:send-message', async (data: {
        receiverId: number;
        content: string;
      }, callback) => {
        try {
          const userId = this.getUserIdBySocketId(socket.id);
          
          if (!userId) {
            return callback({ success: false, error: 'No autenticado' });
          }

          const message = await this.chatService.sendMessage({
            senderId: userId,
            receiverId: data.receiverId,
            content: data.content
          });

          callback({ success: true, message });

          const recipientSocketId = this.connectedUsers.get(data.receiverId);
          if (recipientSocketId) {
            this.io.to(recipientSocketId).emit('chat:new-message', message);
          }

          console.log(`💬 Mensaje encriptado enviado: ${userId} -> ${data.receiverId}`);
        } catch (error: any) {
          console.error('❌ Error al enviar mensaje encriptado:', error);
          callback({ success: false, error: error.message });
        }
      });

      socket.on('chat:load-history', async (data: {
        contactId: number;
        limit?: number;
        offset?: number;
      }, callback) => {
        try {
          const userId = this.getUserIdBySocketId(socket.id);
          
          if (!userId) {
            return callback({ success: false, error: 'No autenticado' });
          }

          const contactId = parseInt(String(data.contactId), 10);
          const limit = data.limit ? parseInt(String(data.limit), 10) : 50;
          const offset = data.offset ? parseInt(String(data.offset), 10) : 0;

          if (isNaN(contactId) || isNaN(limit) || isNaN(offset)) {
            return callback({ 
              success: false, 
              error: 'Parámetros inválidos' 
            });
          }

          console.log(`📜 Cargando historial: userId=${userId}, contactId=${contactId}, limit=${limit}, offset=${offset}`);

          const messages = await this.chatService.getChatHistory(
            userId,
            contactId,
            limit,
            offset
          );

          console.log(`✅ Historial cargado: ${messages.length} mensajes`);
          callback({ success: true, messages });
        } catch (error: any) {
          console.error('❌ Error al cargar historial:', error);
          callback({ success: false, error: error.message });
        }
      });

      socket.on('chat:mark-as-read', async (data: {
        senderId: number;
      }, callback) => {
        try {
          const userId = this.getUserIdBySocketId(socket.id);
          
          if (!userId) {
            return callback({ success: false, error: 'No autenticado' });
          }

          await this.chatService.markMessagesAsRead(userId, data.senderId);

          const senderSocketId = this.connectedUsers.get(data.senderId);
          if (senderSocketId) {
            this.io.to(senderSocketId).emit('chat:messages-read', {
              readBy: userId
            });
          }

          callback({ success: true });
        } catch (error: any) {
          console.error('❌ Error al marcar como leído:', error);
          callback({ success: false, error: error.message });
        }
      });

      socket.on('chat:delete-message', async (data: {
        messageId: number;
      }, callback) => {
        try {
          const userId = this.getUserIdBySocketId(socket.id);
          
          if (!userId) {
            return callback({ success: false, error: 'No autenticado' });
          }

          await this.chatService.deleteMessage(data.messageId, userId);

          socket.emit('chat:message-deleted', { messageId: data.messageId });
          callback({ success: true });
        } catch (error: any) {
          console.error('❌ Error al eliminar mensaje:', error);
          callback({ success: false, error: error.message });
        }
      });

      socket.on('chat:get-unread-count', async (data: {
        senderId?: number;
      }, callback) => {
        try {
          const userId = this.getUserIdBySocketId(socket.id);
          
          if (!userId) {
            return callback({ success: false, error: 'No autenticado' });
          }

          const count = await this.chatService.getUnreadCount(userId, data.senderId);
          callback({ success: true, count });
        } catch (error: any) {
          console.error('❌ Error al obtener mensajes no leídos:', error);
          callback({ success: false, error: error.message });
        }
      });

      socket.on('disconnect', async () => {
        console.log('❌ Usuario desconectado:', socket.id);
        
        let disconnectedUserId: number | null = null;
        for (const [userId, socketId] of this.connectedUsers.entries()) {
          if (socketId === socket.id) {
            disconnectedUserId = userId;
            this.connectedUsers.delete(userId);
            break;
          }
        }
        
        if (disconnectedUserId) {
          try {
            await this.userRepository.updateStatus(disconnectedUserId, UserStatus.OFFLINE);
            await this.userRepository.updateLastSeen(disconnectedUserId);
            console.log(`✅ Usuario ${disconnectedUserId} marcado como OFFLINE en BD`);
          } catch (error) {
            console.error(`❌ Error al actualizar estado de usuario ${disconnectedUserId}:`, error);
          }
          
          this.io.emit('user:offline', { userId: disconnectedUserId });
        }
      });
    });
  }

  private getUserIdBySocketId(socketId: string): number | null {
    for (const [userId, sid] of this.connectedUsers.entries()) {
      if (sid === socketId) {
        return userId;
      }
    }
    return null;
  }

  public getIO(): Server {
    return this.io;
  }

  public getConnectedUsers(): number[] {
    return Array.from(this.connectedUsers.keys());
  }
}

export let socketService: SocketService;

export const initializeSocket = (httpServer: HTTPServer): SocketService => {
  socketService = new SocketService(httpServer);
  return socketService;
};