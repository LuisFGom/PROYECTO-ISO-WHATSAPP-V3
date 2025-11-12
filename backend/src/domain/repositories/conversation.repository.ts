// backend/src/domain/repositories/conversation.repository.ts
import { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

export interface Conversation {
  id: number;
  user1_id: number;
  user2_id: number;
  last_message_id: number | null;
  last_message_at: Date | null;
  unread_count_user1: number;
  unread_count_user2: number;
}

export interface ConversationWithContact {
  conversation_id: number;
  contact_id: number;
  contact_user_id: number;
  contact_username: string;
  contact_email: string;
  contact_avatar_url: string | null;
  contact_nickname: string;
  last_message_id: number | null;
  last_message_content: string | null;
  last_message_iv: string | null;  // ← ESTA LÍNEA DEBE EXISTIR
  last_message_at: Date | null;
  unread_count: number;
  is_online: boolean;
  has_contact: boolean;  // ← ESTA LÍNEA DEBE EXISTIR
}

export class ConversationRepository {
  constructor(private db: Pool) {}

  /**
   * Crear o actualizar una conversación
   */
  async createOrUpdate(
    user1Id: number,
    user2Id: number,
    lastMessageId: number
  ): Promise<void> {
    // Ordenar IDs para mantener consistencia (siempre user1_id < user2_id)
    const [smallerId, largerId] = user1Id < user2Id 
      ? [user1Id, user2Id] 
      : [user2Id, user1Id];

    // Verificar si ya existe la conversación
    const [existing] = await this.db.execute<RowDataPacket[]>(
      `SELECT id FROM conversations 
       WHERE (user1_id = ? AND user2_id = ?) 
          OR (user1_id = ? AND user2_id = ?)`,
      [smallerId, largerId, largerId, smallerId]
    );

    if (existing.length > 0) {
      // Actualizar conversación existente
      await this.db.execute(
        `UPDATE conversations 
         SET last_message_id = ?,
             last_message_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [lastMessageId, existing[0].id]
      );
    } else {
      // Crear nueva conversación
      await this.db.execute(
        `INSERT INTO conversations (user1_id, user2_id, last_message_id, last_message_at)
         VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
        [smallerId, largerId, lastMessageId]
      );
    }
  }

  /**
   * Incrementar contador de mensajes no leídos
   */
  async incrementUnreadCount(receiverId: number, senderId: number): Promise<void> {
    // Determinar qué columna actualizar según el orden de IDs
    const [smallerId, largerId] = receiverId < senderId 
      ? [receiverId, senderId] 
      : [senderId, receiverId];

    const columnToUpdate = receiverId === smallerId 
      ? 'unread_count_user1' 
      : 'unread_count_user2';

    await this.db.execute(
      `UPDATE conversations 
       SET ${columnToUpdate} = ${columnToUpdate} + 1
       WHERE (user1_id = ? AND user2_id = ?)
          OR (user1_id = ? AND user2_id = ?)`,
      [smallerId, largerId, largerId, smallerId]
    );
  }

  /**
   * Resetear contador de mensajes no leídos
   */
  async resetUnreadCount(userId: number, contactId: number): Promise<void> {
    const [smallerId, largerId] = userId < contactId 
      ? [userId, contactId] 
      : [contactId, userId];

    const columnToReset = userId === smallerId 
      ? 'unread_count_user1' 
      : 'unread_count_user2';

    await this.db.execute(
      `UPDATE conversations 
       SET ${columnToReset} = 0
       WHERE (user1_id = ? AND user2_id = ?)
          OR (user1_id = ? AND user2_id = ?)`,
      [smallerId, largerId, largerId, smallerId]
    );
  }

  /**
   * Obtener todas las conversaciones de un usuario con información del contacto
   */
  async getUserConversations(userId: number): Promise<ConversationWithContact[]> {
    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT 
        c.id as conversation_id,
        cnt.id as contact_id,
        u.id as contact_user_id,
        u.username as contact_username,
        u.email as contact_email,
        u.avatar_url as contact_avatar_url,
        COALESCE(cnt.nickname, u.email) as contact_nickname,
        c.last_message_id,
        m.encrypted_content as last_message_content,
        m.iv as last_message_iv,
        c.last_message_at,
        CASE 
          WHEN c.user1_id = ? THEN c.unread_count_user1
          ELSE c.unread_count_user2
        END as unread_count,
        CASE 
          WHEN u.status = 'online' THEN TRUE
          ELSE FALSE
        END as is_online,
        CASE 
          WHEN cnt.id IS NULL THEN FALSE
          ELSE TRUE
        END as has_contact
      FROM conversations c
      INNER JOIN users u ON (
        (c.user1_id = ? AND u.id = c.user2_id)
        OR (c.user2_id = ? AND u.id = c.user1_id)
      )
      LEFT JOIN contacts cnt ON (
        (c.user1_id = ? AND cnt.user_id = ? AND cnt.contact_user_id = c.user2_id)
        OR (c.user2_id = ? AND cnt.user_id = ? AND cnt.contact_user_id = c.user1_id)
      )
      LEFT JOIN messages m ON c.last_message_id = m.id
      WHERE c.user1_id = ? OR c.user2_id = ?
      ORDER BY c.last_message_at DESC`,
      [
        userId, // CASE WHEN
        userId, // JOIN users primer OR
        userId, // JOIN users segundo OR
        userId, userId, // LEFT JOIN contacts primer OR
        userId, userId, // LEFT JOIN contacts segundo OR
        userId, userId  // WHERE
      ]
    );

    return rows.map(row => ({
      conversation_id: row.conversation_id,
      contact_id: row.contact_id || 0,
      contact_user_id: row.contact_user_id,
      contact_username: row.contact_username,
      contact_email: row.contact_email,
      contact_avatar_url: row.contact_avatar_url,
      contact_nickname: row.contact_nickname,
      last_message_id: row.last_message_id,
      last_message_content: row.last_message_content,
      last_message_iv: row.last_message_iv,
      last_message_at: row.last_message_at,
      unread_count: row.unread_count,
      is_online: row.is_online,
      has_contact: row.has_contact
    })) as ConversationWithContact[];
  }

  /**
   * Verificar si existe una conversación entre dos usuarios
   */
  async conversationExists(user1Id: number, user2Id: number): Promise<boolean> {
    const [smallerId, largerId] = user1Id < user2Id 
      ? [user1Id, user2Id] 
      : [user2Id, user1Id];

    const [rows] = await this.db.execute<RowDataPacket[]>(
      `SELECT id FROM conversations 
       WHERE (user1_id = ? AND user2_id = ?)
          OR (user1_id = ? AND user2_id = ?)`,
      [smallerId, largerId, largerId, smallerId]
    );

    return rows.length > 0;
  }
}