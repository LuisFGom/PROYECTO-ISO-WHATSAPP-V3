// backend/src/application/services/chat.service.ts
import { MessageRepository, CreateMessageDTO, Message } from '../../domain/repositories/message.repository';
import { ConversationRepository } from '../../domain/repositories/conversation.repository';
import { EncryptionService } from '../../infrastructure/services/encryption.service';

export interface SendMessageDTO {
  senderId: number;
  receiverId: number;
  content: string; // Texto plano
}

export interface DecryptedMessage extends Omit<Message, 'encrypted_content' | 'iv'> {
  content: string; // Texto desencriptado
}

export class ChatService {
  private encryptionService: EncryptionService;

  constructor(
    private messageRepository: MessageRepository,
    private conversationRepository: ConversationRepository
  ) {
    this.encryptionService = new EncryptionService();
  }

  /**
   * Enviar un mensaje (lo encripta antes de guardar y actualiza conversación)
   */
  async sendMessage(data: SendMessageDTO): Promise<DecryptedMessage> {
    // Validaciones
    if (!data.content || data.content.trim().length === 0) {
      throw new Error('El mensaje no puede estar vacío');
    }

    if (data.senderId === data.receiverId) {
      throw new Error('No puedes enviarte mensajes a ti mismo');
    }

    // Encriptar el contenido
    const { encryptedContent, iv } = this.encryptionService.encrypt(data.content);

    // Crear mensaje en BD
    const messageData: CreateMessageDTO = {
      sender_id: data.senderId,
      receiver_id: data.receiverId,
      encrypted_content: encryptedContent,
      iv: iv
    };

    const message = await this.messageRepository.create(messageData);

    // 🔥 NUEVO: Crear/Actualizar conversación
    await this.conversationRepository.createOrUpdate(
      data.senderId,
      data.receiverId,
      message.id
    );

    // 🔥 NUEVO: Incrementar contador de no leídos para el receptor
    await this.conversationRepository.incrementUnreadCount(
      data.receiverId,
      data.senderId
    );

    // Retornar mensaje desencriptado para el cliente
    return this.decryptMessage(message);
  }

  /**
   * Obtener historial de chat (desencripta los mensajes)
   */
  async getChatHistory(
    userId: number,
    contactId: number,
    limit: number = 50,
    offset: number = 0
  ): Promise<DecryptedMessage[]> {
    const messages = await this.messageRepository.getConversationHistory(
      userId,
      contactId,
      limit,
      offset
    );

    // Desencriptar todos los mensajes
    return messages.map(msg => this.decryptMessage(msg));
  }

  /**
   * Marcar mensajes como leídos y resetear contador
   */
  async markMessagesAsRead(receiverId: number, senderId: number): Promise<void> {
    await this.messageRepository.markAsRead(receiverId, senderId);
    
    // 🔥 NUEVO: Resetear contador de no leídos
    await this.conversationRepository.resetUnreadCount(receiverId, senderId);
  }

  /**
   * Obtener conteo de mensajes no leídos
   */
  async getUnreadCount(userId: number, senderId?: number): Promise<number> {
    return await this.messageRepository.getUnreadCount(userId, senderId);
  }

  /**
   * Eliminar mensaje
   */
  async deleteMessage(messageId: number, userId: number): Promise<void> {
    await this.messageRepository.deleteMessage(messageId, userId);
  }

  /**
   * Método privado para desencriptar un mensaje
   */
  private decryptMessage(message: Message): DecryptedMessage {
    try {
      const decryptedContent = this.encryptionService.decrypt(
        message.encrypted_content,
        message.iv
      );

      const { encrypted_content, iv, ...rest } = message;

      return {
        ...rest,
        content: decryptedContent
      };
    } catch (error) {
      console.error('❌ Error al desencriptar mensaje:', error);
      const { encrypted_content, iv, ...rest } = message;
      return {
        ...rest,
        content: '[Mensaje encriptado - error al desencriptar]'
      };
    }
  }
}