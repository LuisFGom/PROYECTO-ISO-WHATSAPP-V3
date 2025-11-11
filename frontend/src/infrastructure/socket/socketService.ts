// frontend/src/infrastructure/socket/socketService.ts
import { io, Socket } from 'socket.io-client';

// 📦 Interfaces para mensajes encriptados
export interface EncryptedMessage {
  id: number;
  sender_id: number;
  receiver_id: number;
  content: string; // Ya viene desencriptado desde el backend
  timestamp: Date;
  is_read: boolean;
}

// 🔧 CORRECCIÓN: Removido el genérico T no utilizado
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

  // 🔌 Conectar al servidor
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

    // Eventos de conexión
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

  // 🔌 Desconectar
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.userId = null;
      console.log('🔌 Socket desconectado manualmente');
    }
  }

  // ==================== MÉTODOS EXISTENTES (NO MODIFICADOS) ====================

  // 📨 Enviar mensaje (tu método actual - MANTENER)
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

  // 👂 Escuchar mensajes entrantes (tu método actual - MANTENER)
  onMessageReceive(callback: (data: any) => void) {
    this.socket?.on('message:receive', callback);
  }

  onMessageSent(callback: (data: any) => void) {
    this.socket?.on('message:sent', callback);
  }

  // ⌨️ Indicar que estás escribiendo (tu método actual - MANTENER)
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

  // 👂 Escuchar usuarios online/offline (tu método actual - MANTENER)
  onUserOnline(callback: (data: { userId: number }) => void) {
    this.socket?.on('user:online', callback);
  }

  onUserOffline(callback: (data: { userId: number }) => void) {
    this.socket?.on('user:offline', callback);
  }

  // ✅ Marcar mensaje como leído (tu método actual - MANTENER)
  markAsRead(messageId: number, userId: number) {
    this.socket?.emit('message:read', { messageId, userId });
  }

  onMessageRead(callback: (data: { messageId: number; userId: number }) => void) {
    this.socket?.on('message:read', callback);
  }

  // ==================== NUEVOS MÉTODOS DE CHAT ENCRIPTADO ====================

  /**
   * Enviar mensaje encriptado (NUEVO)
   */
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

  /**
   * Cargar historial de chat (NUEVO)
   */
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

  /**
   * Marcar mensajes como leídos (NUEVO)
   */
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

  /**
   * Eliminar mensaje (NUEVO)
   */
  deleteChatMessage(messageId: number): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        return reject(new Error('Socket no conectado'));
      }

      this.socket.emit('chat:delete-message',
        { messageId },
        (response: SocketResponse) => {
          if (response.success) {
            resolve();
          } else {
            reject(new Error(response.error || 'Error al eliminar mensaje'));
          }
        }
      );
    });
  }

  /**
   * Obtener conteo de mensajes no leídos (NUEVO)
   */
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

  /**
   * Escuchar nuevos mensajes encriptados (NUEVO)
   */
  onNewEncryptedMessage(callback: (message: EncryptedMessage) => void): void {
    this.socket?.on('chat:new-message', callback);
  }

  /**
   * Escuchar cuando mensajes son leídos (NUEVO)
   */
  onChatMessagesRead(callback: (data: { readBy: number }) => void): void {
    this.socket?.on('chat:messages-read', callback);
  }

  /**
   * Escuchar cuando un mensaje es eliminado (NUEVO)
   */
  onChatMessageDeleted(callback: (data: { messageId: number }) => void): void {
    this.socket?.on('chat:message-deleted', callback);
  }

  /**
   * Remover todos los listeners (ACTUALIZADO)
   */
  removeAllListeners(): void {
    this.socket?.removeAllListeners();
  }

  // 📊 Estado de la conexión
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