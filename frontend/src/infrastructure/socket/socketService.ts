// frontend/src/infrastructure/socket/socketService.ts
import { io, Socket } from 'socket.io-client';

export interface EncryptedMessage {
  id: number;
  sender_id: number;
  receiver_id: number;
  content: string;
  timestamp: Date;
  is_read: boolean;
  edited_at: Date | null; // 🔥 NUEVO
  is_deleted_for_all: boolean; // 🔥 NUEVO
}

export interface SocketResponse {
  success: boolean;
  error?: string;
  message?: EncryptedMessage;
  messages?: EncryptedMessage[];
  count?: number;
}

class SocketService {
  private socket: Socket | null = null;
  private userId: number | null = null;

  connect(token: string, userId: number) {
    if (this.socket?.connected) {
      console.log('⚠️ Ya existe una conexión activa');
      return;
    }

    let SOCKET_URL = 'https://specifically-semihumanistic-maria.ngrok-free.dev';
    
    if (import.meta.env.VITE_API_URL) {
      SOCKET_URL = import.meta.env.VITE_API_URL.replace('/api', '');
    }
    
    console.log('🔌 Conectando Socket.IO a:', SOCKET_URL);

    this.socket = io(SOCKET_URL, {
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
      transports: ['websocket', 'polling'],
    });

    this.userId = userId;

    this.socket.on('connect', () => {
      console.log('✅ Conectado al servidor Socket.IO');
      this.socket?.emit('authenticate', userId);
    });

    this.socket.on('authenticated', (data) => {
      console.log('🔐 Autenticado:', data);
    });

    this.socket.on('disconnect', () => {
      console.log('❌ Desconectado del servidor');
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ Error de conexión:', error);
    });

    this.socket.on('reconnect_attempt', (attempt) => {
      console.log(`🔄 Intento de reconexión #${attempt}`);
    });

    this.socket.on('reconnect', (attempt) => {
      console.log(`✅ Reconectado después de ${attempt} intentos`);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.userId = null;
      console.log('🔌 Socket desconectado manualmente');
    }
  }

  // ==================== MÉTODOS EXISTENTES ====================

  sendMessage(to: number, content: string) {
    if (!this.socket || !this.userId) {
      console.error('❌ Socket no conectado');
      return;
    }

    this.socket.emit('message:send', {
      from: this.userId,
      to,
      content,
      timestamp: new Date().toISOString(),
    });
  }

  onMessageReceive(callback: (data: any) => void) {
    this.socket?.on('message:receive', callback);
  }

  onMessageSent(callback: (data: any) => void) {
    this.socket?.on('message:sent', callback);
  }

  startTyping(to: number) {
    if (!this.userId) return;
    this.socket?.emit('typing:start', { from: this.userId, to });
  }

  stopTyping(to: number) {
    if (!this.userId) return;
    this.socket?.emit('typing:stop', { from: this.userId, to });
  }

  onTypingStart(callback: (data: { from: number; to: number }) => void) {
    this.socket?.on('typing:start', callback);
  }

  onTypingStop(callback: (data: { from: number; to: number }) => void) {
    this.socket?.on('typing:stop', callback);
  }

  onUserOnline(callback: (data: { userId: number }) => void) {
    this.socket?.on('user:online', callback);
  }

  onUserOffline(callback: (data: { userId: number }) => void) {
    this.socket?.on('user:offline', callback);
  }

  markAsRead(messageId: number, userId: number) {
    this.socket?.emit('message:read', { messageId, userId });
  }

  onMessageRead(callback: (data: { messageId: number; userId: number }) => void) {
    this.socket?.on('message:read', callback);
  }

  // ==================== MÉTODOS DE CHAT ENCRIPTADO ====================

  sendEncryptedMessage(receiverId: number, content: string): Promise<EncryptedMessage> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        return reject(new Error('Socket no conectado'));
      }

      this.socket.emit('chat:send-message', 
        { receiverId, content },
        (response: SocketResponse) => {
          if (response.success && response.message) {
            resolve(response.message);
          } else {
            reject(new Error(response.error || 'Error al enviar mensaje'));
          }
        }
      );
    });
  }

  // 🔥 NUEVO: Editar mensaje
  editMessage(messageId: number, newContent: string): Promise<EncryptedMessage> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        return reject(new Error('Socket no conectado'));
      }

      this.socket.emit('chat:edit-message',
        { messageId, newContent },
        (response: SocketResponse) => {
          if (response.success && response.message) {
            console.log(`✏️ Mensaje ${messageId} editado exitosamente`);
            resolve(response.message);
          } else {
            reject(new Error(response.error || 'Error al editar mensaje'));
          }
        }
      );
    });
  }

  // 🔥 NUEVO: Escuchar ediciones de mensajes
  onMessageEdited(callback: (message: EncryptedMessage) => void): void {
    this.socket?.on('chat:message-edited', callback);
  }

  loadChatHistory(
    contactId: number,
    limit: number = 50,
    offset: number = 0
  ): Promise<EncryptedMessage[]> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        return reject(new Error('Socket no conectado'));
      }

      this.socket.emit('chat:load-history',
        { contactId, limit, offset },
        (response: SocketResponse) => {
          if (response.success && response.messages) {
            resolve(response.messages);
          } else {
            reject(new Error(response.error || 'Error al cargar historial'));
          }
        }
      );
    });
  }

  markChatMessagesAsRead(senderId: number): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        return reject(new Error('Socket no conectado'));
      }

      this.socket.emit('chat:mark-as-read',
        { senderId },
        (response: SocketResponse) => {
          if (response.success) {
            resolve();
          } else {
            reject(new Error(response.error || 'Error al marcar como leído'));
          }
        }
      );
    });
  }

  // 🔥 MEJORADO: Eliminar mensaje con opción de "para todos"
  deleteChatMessage(messageId: number, deleteForAll: boolean = false): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        return reject(new Error('Socket no conectado'));
      }

      this.socket.emit('chat:delete-message',
        { messageId, deleteForAll },
        (response: SocketResponse) => {
          if (response.success) {
            console.log(`🗑️ Mensaje ${messageId} eliminado ${deleteForAll ? 'PARA TODOS' : 'PARA MÍ'}`);
            resolve();
          } else {
            reject(new Error(response.error || 'Error al eliminar mensaje'));
          }
        }
      );
    });
  }

  getUnreadCount(senderId?: number): Promise<number> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        return reject(new Error('Socket no conectado'));
      }

      this.socket.emit('chat:get-unread-count',
        { senderId },
        (response: SocketResponse) => {
          if (response.success && typeof response.count === 'number') {
            resolve(response.count);
          } else {
            reject(new Error(response.error || 'Error al obtener conteo'));
          }
        }
      );
    });
  }

  onNewEncryptedMessage(callback: (message: EncryptedMessage) => void): void {
    this.socket?.on('chat:new-message', callback);
  }

  onChatMessagesRead(callback: (data: { readBy: number }) => void): void {
    this.socket?.on('chat:messages-read', callback);
  }

  onChatMessageDeleted(callback: (data: { messageId: number; deleteForAll: boolean }) => void): void {
    this.socket?.on('chat:message-deleted', callback);
  }

  removeAllListeners(): void {
    this.socket?.removeAllListeners();
  }

  get isConnected(): boolean {
    return this.socket?.connected || false;
  }

  get connectionState(): 'connected' | 'disconnected' | 'connecting' {
    if (!this.socket) return 'disconnected';
    if (this.socket.connected) return 'connected';
    return 'connecting';
  }

  getSocket(): Socket | null {
    return this.socket;
  }
}

export const socketService = new SocketService();