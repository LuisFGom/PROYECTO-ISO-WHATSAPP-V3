// backend/src/presentation/controllers/conversation.controller.ts
import { Request, Response } from 'express';
import { ConversationRepository } from '../../domain/repositories/conversation.repository';
import { database } from '../../infrastructure/database/mysql/connection';
import { EncryptionService } from '../../infrastructure/services/encryption.service';

export class ConversationController {
  private conversationRepository: ConversationRepository;
  private encryptionService: EncryptionService;

  constructor() {
    this.conversationRepository = new ConversationRepository(database.getPool());
    this.encryptionService = new EncryptionService();
  }

  /**
   * Obtener todas las conversaciones del usuario autenticado
   */
  async getUserConversations(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({ error: 'No autenticado' });
        return;
      }

      const conversations = await this.conversationRepository.getUserConversations(userId);

      // Desencriptar el último mensaje de cada conversación
      const conversationsWithDecryptedMessages = conversations.map(conv => {
        let lastMessagePreview = null;

        // 🔥 NUEVO: Verificar si el mensaje fue eliminado para todos
        if (conv.last_message_content === '[Este mensaje fue eliminado]' || 
            conv.last_message_content === 'Este mensaje fue eliminado') {
          lastMessagePreview = 'Este mensaje fue eliminado';
        } else if (conv.last_message_content && conv.last_message_iv) {
          try {
            // Desencriptar el último mensaje
            const decrypted = this.encryptionService.decrypt(
              conv.last_message_content,
              conv.last_message_iv
            );
            
            // Preview de 50 caracteres
            lastMessagePreview = decrypted.length > 50 
              ? decrypted.substring(0, 50) + '...' 
              : decrypted;
          } catch (error) {
            console.error('Error al desencriptar preview:', error);
            lastMessagePreview = 'Mensaje encriptado';
          }
        }

        return {
          conversation_id: conv.conversation_id,
          contact: {
            id: conv.contact_id,
            user_id: conv.contact_user_id,
            username: conv.contact_username,
            email: conv.contact_email,
            avatar_url: conv.contact_avatar_url,
            nickname: conv.contact_nickname,
            is_online: conv.is_online,
            has_contact: conv.has_contact
          },
          last_message: {
            id: conv.last_message_id,
            preview: lastMessagePreview,
            timestamp: conv.last_message_at
          },
          unread_count: conv.unread_count
        };
      });

      res.json({
        success: true,
        conversations: conversationsWithDecryptedMessages
      });
    } catch (error: any) {
      console.error('Error al obtener conversaciones:', error);
      res.status(500).json({ 
        error: 'Error al obtener conversaciones',
        message: error.message 
      });
    }
  }
}