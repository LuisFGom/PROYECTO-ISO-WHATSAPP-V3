// backend/src/infrastructure/socket/socket.ts
import { Server } from 'socket.io';
import type { Server as HTTPServer } from 'http';
import { config } from '../../config/environment';
import { MessageRepository } from '../../domain/repositories/message.repository';
import { ChatService } from '../../application/services/chat.service';
import { database } from '../database/mysql/connection';

export class SocketService {
  private io: Server;
  private connectedUsers: Map<number, string> = new Map(); // userId -> socketId
  private chatService: ChatService;

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

    // 🔥 Inicializar servicio de chat
    const messageRepository = new MessageRepository(database.getPool());
    this.chatService = new ChatService(messageRepository);

    this.initialize();
  }

  private initialize() {
    this.io.on('connection', (socket) => {
      console.log('✅ Usuario conectado:', socket.id);

      // 🔐 Autenticación del usuario
      socket.on('authenticate', (userId: number) => {
        console.log(`🔐 Usuario ${userId} autenticado con socket ${socket.id}`);
        this.connectedUsers.set(userId, socket.id);
        
        socket.emit('authenticated', { userId, socketId: socket.id });
        this.io.emit('user:online', { userId });
      });

      // ==================== EVENTOS EXISTENTES (NO MODIFICADOS) ====================
      
      // 📨 Enviar mensaje (tu evento actual - MANTENER)
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

      // ⌨️ Usuario escribiendo (tu evento actual - MANTENER)
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

      // ✅ Mensaje leído (tu evento actual - MANTENER)
      socket.on('message:read', (data: { messageId: number; userId: number }) => {
        const recipientSocketId = this.connectedUsers.get(data.userId);
        if (recipientSocketId) {
          this.io.to(recipientSocketId).emit('message:read', data);
        }
      });

      // ==================== NUEVOS EVENTOS DE CHAT ENCRIPTADO ====================

      // 💬 Enviar mensaje encriptado (NUEVO)
      socket.on('chat:send-message', async (data: {
        receiverId: number;
        content: string;
      }, callback) => {
        try {
          const userId = this.getUserIdBySocketId(socket.id);
          
          if (!userId) {
            return callback({ success: false, error: 'No autenticado' });
          }

          // Guardar mensaje encriptado en BD
          const message = await this.chatService.sendMessage({
            senderId: userId,
            receiverId: data.receiverId,
            content: data.content
          });

          // Confirmar al emisor
          callback({ success: true, message });

          // Emitir al receptor en tiempo real
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

      // 📜 Cargar historial de chat (NUEVO)
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

          const messages = await this.chatService.getChatHistory(
            userId,
            data.contactId,
            data.limit || 50,
            data.offset || 0
          );

          callback({ success: true, messages });
        } catch (error: any) {
          console.error('❌ Error al cargar historial:', error);
          callback({ success: false, error: error.message });
        }
      });

      // ✅ Marcar mensajes como leídos (NUEVO)
      socket.on('chat:mark-as-read', async (data: {
        senderId: number;
      }, callback) => {
        try {
          const userId = this.getUserIdBySocketId(socket.id);
          
          if (!userId) {
            return callback({ success: false, error: 'No autenticado' });
          }

          await this.chatService.markMessagesAsRead(userId, data.senderId);

          // Notificar al remitente que sus mensajes fueron leídos
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

      // 🗑️ Eliminar mensaje (NUEVO)
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

      // 📊 Obtener mensajes no leídos (NUEVO)
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

      // 🔌 Desconexión
      socket.on('disconnect', () => {
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
          this.io.emit('user:offline', { userId: disconnectedUserId });
        }
      });
    });
  }

  // 🔍 Obtener userId por socketId
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