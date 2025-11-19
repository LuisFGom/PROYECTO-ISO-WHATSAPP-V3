// backend/src/application/services/chat.service.ts
import { MessageRepository, CreateMessageDTO, Message } from '../../domain/repositories/message.repository';
import { ConversationRepository } from '../../domain/repositories/conversation.repository';
import { EncryptionService } from '../../infrastructure/services/encryption.service';

export interface SendMessageDTO {
  senderId: number;
  receiverId: number;
  content: string;
}

export interface DecryptedMessage extends Omit<Message, 'encrypted_content' | 'iv'> {
  content: string;
  edited_at: Date | null;
  is_deleted_for_all: boolean;
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
    if (!data.content || data.content.trim().length === 0) {
      throw new Error('El mensaje no puede estar vacío');
    }

    if (data.senderId === data.receiverId) {
      throw new Error('No puedes enviarte mensajes a ti mismo');
    }

    const { encryptedContent, iv } = this.encryptionService.encrypt(data.content);

    const messageData: CreateMessageDTO = {
      sender_id: data.senderId,
      receiver_id: data.receiverId,
      encrypted_content: encryptedContent,
      iv: iv
    };

    const message = await this.messageRepository.create(messageData);

    await this.conversationRepository.createOrUpdate(
      data.senderId,
      data.receiverId,
      message.id
    );

    await this.conversationRepository.incrementUnreadCount(
      data.receiverId,
      data.senderId
    );

    return this.decryptMessage(message);
  }

  /**
   * 🔥 NUEVO: Editar un mensaje
   */
  async editMessage(messageId: number, userId: number, newContent: string): Promise<DecryptedMessage> {
    if (!newContent || newContent.trim().length === 0) {
      throw new Error('El mensaje no puede estar vacío');
    }

    const { encryptedContent, iv } = this.encryptionService.encrypt(newContent);

    const updatedMessage = await this.messageRepository.updateMessage(
      messageId,
      userId,
      encryptedContent,
      iv
    );

    console.log(`✏️ Mensaje ${messageId} editado exitosamente`);
    return this.decryptMessage(updatedMessage);
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

    return messages.map(msg => this.decryptMessage(msg));
  }

  /**
   * Marcar mensajes como leídos y resetear contador
   */
  async markMessagesAsRead(receiverId: number, senderId: number): Promise<void> {
    await this.messageRepository.markAsRead(receiverId, senderId);
    await this.conversationRepository.resetUnreadCount(receiverId, senderId);
  }

  /**
   * Obtener conteo de mensajes no leídos
   */
  async getUnreadCount(userId: number, senderId?: number): Promise<number> {
    return await this.messageRepository.getUnreadCount(userId, senderId);
  }

  /**
   * 🔥 MEJORADO: Eliminar mensaje (soporta "para todos" o "para mí")
   */
  async deleteMessage(messageId: number, userId: number, deleteForAll: boolean = false): Promise<void> {
    await this.messageRepository.deleteMessage(messageId, userId, deleteForAll);
  }

  /**
   * Método privado para desencriptar un mensaje
   */
  private decryptMessage(message: Message): DecryptedMessage {
    try {
      if (message.is_deleted_for_all) {
        const { encrypted_content, iv, ...rest } = message;
        return {
          ...rest,
          content: 'Este mensaje fue eliminado',
          edited_at: message.edited_at,
          is_deleted_for_all: true
        };
      }

      const decryptedContent = this.encryptionService.decrypt(
        message.encrypted_content,
        message.iv
      );

      const { encrypted_content, iv, ...rest } = message;

      return {
        ...rest,
        content: decryptedContent,
        edited_at: message.edited_at,
        is_deleted_for_all: false
      };
    } catch (error) {
      console.error('❌ Error al desencriptar mensaje:', error);
      const { encrypted_content, iv, ...rest } = message;
      return {
        ...rest,
        content: '[Mensaje encriptado - error al desencriptar]',
        edited_at: message.edited_at,
        is_deleted_for_all: false
      };
    }
  }
}