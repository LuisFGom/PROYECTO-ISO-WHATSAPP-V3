// backend/src/domain/repositories/message.repository.ts
import { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

export interface Message {
  id: number;
  sender_id: number;
  receiver_id: number;
  encrypted_content: string;
  iv: string;
  timestamp: Date;
  is_read: boolean;
  deleted_by_sender: boolean;
  deleted_by_receiver: boolean;
}

export interface CreateMessageDTO {
  sender_id: number;
  receiver_id: number;
  encrypted_content: string;
  iv: string;
}

export class MessageRepository {
  constructor(private db: Pool) {}

  /**
   * Crear un nuevo mensaje encriptado
   */
  async create(data: CreateMessageDTO): Promise<Message> {
    const [result] = await this.db.execute<ResultSetHeader>(
      `INSERT INTO messages (sender_id, receiver_id, encrypted_content, iv)
       VALUES (?, ?, ?, ?)`,
      [data.sender_id, data.receiver_id, data.encrypted_content, data.iv]
    );

    const [message] = await this.db.execute<RowDataPacket[]>(
      'SELECT * FROM messages WHERE id = ?',
      [result.insertId]
    );

    return message[0] as Message;
  }

  /**
   * Obtener historial de mensajes entre dos usuarios
   */
  async getConversationHistory(
    userId: number,
    contactId: number,
    limit: number = 50,
    offset: number = 0
  ): Promise<Message[]> {
    const [messages] = await this.db.execute<RowDataPacket[]>(
      `SELECT * FROM messages 
       WHERE ((sender_id = ? AND receiver_id = ? AND deleted_by_sender = FALSE)
          OR (sender_id = ? AND receiver_id = ? AND deleted_by_receiver = FALSE))
       ORDER BY timestamp DESC
       LIMIT ? OFFSET ?`,
      [userId, contactId, contactId, userId, limit, offset]
    );

    return messages as Message[];
  }

  /**
   * Marcar mensajes como leídos
   */
  async markAsRead(receiverId: number, senderId: number): Promise<void> {
    await this.db.execute(
      `UPDATE messages 
       SET is_read = TRUE 
       WHERE receiver_id = ? AND sender_id = ? AND is_read = FALSE`,
      [receiverId, senderId]
    );
  }

  /**
   * Obtener mensajes no leídos de un usuario
   */
  async getUnreadCount(userId: number, senderId?: number): Promise<number> {
    let query = `SELECT COUNT(*) as count FROM messages 
                 WHERE receiver_id = ? AND is_read = FALSE`;
    const params: any[] = [userId];

    if (senderId) {
      query += ' AND sender_id = ?';
      params.push(senderId);
    }

    const [result] = await this.db.execute<RowDataPacket[]>(query, params);
    return result[0].count;
  }

  /**
   * Eliminar mensaje (soft delete)
   */
  async deleteMessage(messageId: number, userId: number): Promise<void> {
    const [message] = await this.db.execute<RowDataPacket[]>(
      'SELECT sender_id, receiver_id FROM messages WHERE id = ?',
      [messageId]
    );

    if (message.length === 0) {
      throw new Error('Mensaje no encontrado');
    }

    const msg = message[0];

    if (msg.sender_id === userId) {
      await this.db.execute(
        'UPDATE messages SET deleted_by_sender = TRUE WHERE id = ?',
        [messageId]
      );
    } else if (msg.receiver_id === userId) {
      await this.db.execute(
        'UPDATE messages SET deleted_by_receiver = TRUE WHERE id = ?',
        [messageId]
      );
    }

    // Si ambos eliminaron, borrar físicamente
    const [updated] = await this.db.execute<RowDataPacket[]>(
      'SELECT deleted_by_sender, deleted_by_receiver FROM messages WHERE id = ?',
      [messageId]
    );

    if (updated[0].deleted_by_sender && updated[0].deleted_by_receiver) {
      await this.db.execute('DELETE FROM messages WHERE id = ?', [messageId]);
    }
  }
}