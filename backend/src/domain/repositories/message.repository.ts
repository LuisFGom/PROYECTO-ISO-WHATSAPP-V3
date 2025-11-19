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
  edited_at: Date | null; // 🔥 NUEVO
  is_deleted_for_all: boolean; // 🔥 NUEVO
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
    const userIdNum = Number(userId);
    const contactIdNum = Number(contactId);
    const limitNum = Number(limit);
    const offsetNum = Number(offset);

    console.log('📊 Query params:', {
      userId: userIdNum,
      contactId: contactIdNum,
      limit: limitNum,
      offset: offsetNum
    });

    if (
      !Number.isInteger(userIdNum) || 
      !Number.isInteger(contactIdNum) || 
      !Number.isInteger(limitNum) || 
      !Number.isInteger(offsetNum) ||
      userIdNum <= 0 ||
      contactIdNum <= 0 ||
      limitNum <= 0 ||
      offsetNum < 0
    ) {
      console.error('❌ Parámetros inválidos');
      throw new Error('Parámetros inválidos para getConversationHistory');
    }

    try {
      const query = `
        SELECT * FROM messages 
        WHERE (
          (sender_id = ? AND receiver_id = ? AND deleted_by_sender = 0 AND is_deleted_for_all = 0)
          OR 
          (sender_id = ? AND receiver_id = ? AND deleted_by_receiver = 0 AND is_deleted_for_all = 0)
        )
        ORDER BY timestamp ASC
        LIMIT ${limitNum} OFFSET ${offsetNum}
      `;

      const params = [
        userIdNum,
        contactIdNum,
        contactIdNum,
        userIdNum
      ];

      console.log('📝 Ejecutando query con params:', params);

      const [messages] = await this.db.execute<RowDataPacket[]>(query, params);

      console.log(`✅ Mensajes obtenidos: ${messages.length}`);
      return messages as Message[];
    } catch (error: any) {
      console.error('❌ Error en getConversationHistory:', {
        error: error.message,
        code: error.code,
        errno: error.errno,
        sqlMessage: error.sqlMessage
      });
      throw error;
    }
  }

  /**
   * 🔥 NUEVO: Editar mensaje (actualiza contenido encriptado)
   */
  async updateMessage(messageId: number, userId: number, encryptedContent: string, iv: string): Promise<Message> {
    const messageIdNum = Number(messageId);
    const userIdNum = Number(userId);

    // Verificar que el usuario es el emisor
    const [message] = await this.db.execute<RowDataPacket[]>(
      'SELECT sender_id FROM messages WHERE id = ?',
      [messageIdNum]
    );

    if (message.length === 0) {
      throw new Error('Mensaje no encontrado');
    }

    if (message[0].sender_id !== userIdNum) {
      throw new Error('No tienes permiso para editar este mensaje');
    }

    // Actualizar mensaje
    await this.db.execute(
      `UPDATE messages 
       SET encrypted_content = ?, iv = ?, edited_at = NOW() 
       WHERE id = ?`,
      [encryptedContent, iv, messageIdNum]
    );

    // Retornar mensaje actualizado
    const [updated] = await this.db.execute<RowDataPacket[]>(
      'SELECT * FROM messages WHERE id = ?',
      [messageIdNum]
    );

    console.log(`✏️ Mensaje ${messageIdNum} editado por usuario ${userIdNum}`);
    return updated[0] as Message;
  }

  /**
   * Marcar mensajes como leídos
   */
  async markAsRead(receiverId: number, senderId: number): Promise<void> {
    const receiverIdNum = Number(receiverId);
    const senderIdNum = Number(senderId);

    console.log(`✅ Marcando como leídos: receiver=${receiverIdNum}, sender=${senderIdNum}`);

    await this.db.execute(
      `UPDATE messages 
       SET is_read = 1 
       WHERE receiver_id = ? AND sender_id = ? AND is_read = 0`,
      [receiverIdNum, senderIdNum]
    );
  }

  /**
   * Obtener mensajes no leídos de un usuario
   */
  async getUnreadCount(userId: number, senderId?: number): Promise<number> {
    const userIdNum = Number(userId);
    
    let query = `SELECT COUNT(*) as count FROM messages 
                 WHERE receiver_id = ? AND is_read = 0 AND deleted_by_receiver = 0 AND is_deleted_for_all = 0`;
    const params: number[] = [userIdNum];

    if (senderId) {
      const senderIdNum = Number(senderId);
      query += ' AND sender_id = ?';
      params.push(senderIdNum);
    }

    const [result] = await this.db.execute<RowDataPacket[]>(query, params);
    return result[0].count;
  }

  /**
   * 🔥 MEJORADO: Eliminar mensaje con soporte para "eliminar para todos"
   */
  async deleteMessage(messageId: number, userId: number, deleteForAll: boolean = false): Promise<void> {
    const messageIdNum = Number(messageId);
    const userIdNum = Number(userId);

    const [message] = await this.db.execute<RowDataPacket[]>(
      'SELECT sender_id, receiver_id FROM messages WHERE id = ?',
      [messageIdNum]
    );

    if (message.length === 0) {
      throw new Error('Mensaje no encontrado');
    }

    const msg = message[0];

    // 🔥 ELIMINAR PARA TODOS (solo si eres el emisor)
    if (deleteForAll) {
      if (msg.sender_id !== userIdNum) {
        throw new Error('Solo el emisor puede eliminar para todos');
      }

      await this.db.execute(
        'UPDATE messages SET is_deleted_for_all = 1, encrypted_content = ?, iv = ? WHERE id = ?',
        ['[Este mensaje fue eliminado]', '', messageIdNum]
      );

      console.log(`🗑️ Mensaje ${messageIdNum} eliminado PARA TODOS por usuario ${userIdNum}`);
      return;
    }

    // 🔥 ELIMINAR SOLO PARA MÍ
    if (msg.sender_id === userIdNum) {
      await this.db.execute(
        'UPDATE messages SET deleted_by_sender = 1 WHERE id = ?',
        [messageIdNum]
      );
      console.log(`🗑️ Mensaje ${messageIdNum} eliminado para emisor ${userIdNum}`);
    } else if (msg.receiver_id === userIdNum) {
      await this.db.execute(
        'UPDATE messages SET deleted_by_receiver = 1 WHERE id = ?',
        [messageIdNum]
      );
      console.log(`🗑️ Mensaje ${messageIdNum} eliminado para receptor ${userIdNum}`);
    }

    // Si ambos eliminaron, borrar físicamente
    const [updated] = await this.db.execute<RowDataPacket[]>(
      'SELECT deleted_by_sender, deleted_by_receiver FROM messages WHERE id = ?',
      [messageIdNum]
    );

    if (updated[0].deleted_by_sender && updated[0].deleted_by_receiver) {
      await this.db.execute('DELETE FROM messages WHERE id = ?', [messageIdNum]);
      console.log(`🗑️ Mensaje ${messageIdNum} eliminado FÍSICAMENTE de la BD`);
    }
  }
}