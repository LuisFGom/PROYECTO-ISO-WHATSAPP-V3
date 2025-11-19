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
  last_message_iv: string | null;
  last_message_sender_id: number | null;
  last_message_at: Date | null;
  unread_count: number;
  is_online: boolean;
  has_contact: boolean;
}

export class ConversationRepository {
  constructor(private db: Pool) {}

  async createOrUpdate(
    user1Id: number,
    user2Id: number,
    lastMessageId: number
  ): Promise<void> {
    const [smallerId, largerId] = user1Id < user2Id 
      ? [user1Id, user2Id] 
      : [user2Id, user1Id];

    const [existing] = await this.db.execute<RowDataPacket[]>(
      `SELECT id FROM conversations 
       WHERE (user1_id = ? AND user2_id = ?) 
          OR (user1_id = ? AND user2_id = ?)`,
      [smallerId, largerId, largerId, smallerId]
    );

    if (existing.length > 0) {
      await this.db.execute(
        `UPDATE conversations 
         SET last_message_id = ?,
             last_message_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [lastMessageId, existing[0].id]
      );
    } else {
      await this.db.execute(
        `INSERT INTO conversations (user1_id, user2_id, last_message_id, last_message_at)
         VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
        [smallerId, largerId, lastMessageId]
      );
    }
  }

  async incrementUnreadCount(receiverId: number, senderId: number): Promise<void> {
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
   * 🔥 CORREGIDO: Obtener conversaciones con el ÚLTIMO MENSAJE VÁLIDO
   * - "Eliminar para TODOS" → Muestra "Este mensaje fue eliminado"
   * - "Eliminar para MÍ" → Muestra el anterior mensaje no eliminado
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
        
        -- 🔥 ÚLTIMO MENSAJE (incluye eliminados PARA TODOS, excluye eliminados PARA MÍ)
        (SELECT m2.id 
         FROM messages m2
         WHERE (
           (m2.sender_id = ? AND m2.receiver_id = u.id AND m2.deleted_by_sender = 0)
           OR 
           (m2.sender_id = u.id AND m2.receiver_id = ? AND m2.deleted_by_receiver = 0)
         )
         ORDER BY m2.timestamp DESC
         LIMIT 1
        ) as last_message_id,
        
        (SELECT m2.encrypted_content 
         FROM messages m2
         WHERE (
           (m2.sender_id = ? AND m2.receiver_id = u.id AND m2.deleted_by_sender = 0)
           OR 
           (m2.sender_id = u.id AND m2.receiver_id = ? AND m2.deleted_by_receiver = 0)
         )
         ORDER BY m2.timestamp DESC
         LIMIT 1
        ) as last_message_content,
        
        (SELECT m2.iv 
         FROM messages m2
         WHERE (
           (m2.sender_id = ? AND m2.receiver_id = u.id AND m2.deleted_by_sender = 0)
           OR 
           (m2.sender_id = u.id AND m2.receiver_id = ? AND m2.deleted_by_receiver = 0)
         )
         ORDER BY m2.timestamp DESC
         LIMIT 1
        ) as last_message_iv,
        
        (SELECT m2.sender_id 
         FROM messages m2
         WHERE (
           (m2.sender_id = ? AND m2.receiver_id = u.id AND m2.deleted_by_sender = 0)
           OR 
           (m2.sender_id = u.id AND m2.receiver_id = ? AND m2.deleted_by_receiver = 0)
         )
         ORDER BY m2.timestamp DESC
         LIMIT 1
        ) as last_message_sender_id,
        
        (SELECT m2.timestamp 
         FROM messages m2
         WHERE (
           (m2.sender_id = ? AND m2.receiver_id = u.id AND m2.deleted_by_sender = 0)
           OR 
           (m2.sender_id = u.id AND m2.receiver_id = ? AND m2.deleted_by_receiver = 0)
         )
         ORDER BY m2.timestamp DESC
         LIMIT 1
        ) as last_message_at,
        
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
      WHERE c.user1_id = ? OR c.user2_id = ?
      ORDER BY last_message_at DESC`,
      [
        // Subconsultas (10 veces userId)
        userId, userId, // last_message_id
        userId, userId, // last_message_content
        userId, userId, // last_message_iv
        userId, userId, // last_message_sender_id
        userId, userId, // last_message_at
        userId,         // unread_count
        userId, userId, // JOIN users
        userId, userId, userId, userId, // LEFT JOIN contacts
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
      last_message_sender_id: row.last_message_sender_id,
      last_message_at: row.last_message_at,
      unread_count: row.unread_count,
      is_online: row.is_online,
      has_contact: row.has_contact
    })) as ConversationWithContact[];
  }

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