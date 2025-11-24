// backend/src/infrastructure/repositories/group.repository.ts

import { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { IGroupRepository } from '../../domain/repositories/IGroupRepository';
import {
  Group,
  CreateGroupDTO,
  UpdateGroupDTO,
  GroupWithMembers,
  GroupMember,
  AddMemberDTO,
  RemoveMemberDTO,
  GroupMessage,
  CreateGroupMessageDTO,
  UpdateGroupMessageDTO,
  DeleteGroupMessageDTO,
  GroupMessageWithReads,
  MarkGroupMessageAsReadDTO,
  SearchGroupMessagesDTO
} from '../../domain/entities/Group.entity';

export class GroupRepository implements IGroupRepository {
  constructor(private db: Pool) {}

  // ========== GRUPOS ==========

  async createGroup(data: CreateGroupDTO): Promise<Group> {
    const connection = await this.db.getConnection();
    try {
      await connection.beginTransaction();

      // 1. Crear el grupo
      // 🔥 CORREGIDO: Agregado backticks a `groups`
      const [result] = await connection.query<ResultSetHeader>(
        `INSERT INTO \`groups\` (name, description, avatar_url, admin_user_id)
         VALUES (?, ?, ?, ?)`,
        [data.name, data.description || null, data.avatarUrl || null, data.adminUserId]
      );

      const groupId = result.insertId;

      // 2. Agregar al admin como miembro
      await connection.query(
        `INSERT INTO group_members (group_id, user_id, added_by_user_id)
         VALUES (?, ?, ?)`,
        [groupId, data.adminUserId, data.adminUserId]
      );

      await connection.commit();

      // 3. Obtener el grupo creado
      const group = await this.getGroupById(groupId);
      return group!;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async getGroupById(groupId: number): Promise<Group | null> {
    // 🔥 CORREGIDO: Agregado backticks a `groups`
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT 
        id,
        name,
        description,
        avatar_url as avatarUrl,
        admin_user_id as adminUserId,
        created_at as createdAt,
        updated_at as updatedAt
       FROM \`groups\`
       WHERE id = ?`,
      [groupId]
    );

    if (rows.length === 0) return null;

    return {
      id: rows[0].id,
      name: rows[0].name,
      description: rows[0].description,
      avatarUrl: rows[0].avatarUrl,
      adminUserId: rows[0].adminUserId,
      createdAt: new Date(rows[0].createdAt),
      updatedAt: new Date(rows[0].updatedAt)
    };
  }

  async getUserGroups(userId: number): Promise<GroupWithMembers[]> {
    // 🔥 CORREGIDO: Agregado backticks a `groups`
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT 
        g.id,
        g.name,
        g.description,
        g.avatar_url as avatarUrl,
        g.admin_user_id as adminUserId,
        g.created_at as createdAt,
        g.updated_at as updatedAt,
        (SELECT COUNT(*) FROM group_members WHERE group_id = g.id AND left_at IS NULL) as memberCount
       FROM \`groups\` g
       INNER JOIN group_members gm ON g.id = gm.group_id
       WHERE gm.user_id = ? AND gm.left_at IS NULL
       ORDER BY g.updated_at DESC`,
      [userId]
    );

    const groups: GroupWithMembers[] = [];

    for (const row of rows) {
      const members = await this.getGroupMembers(row.id);
      groups.push({
        id: row.id,
        name: row.name,
        description: row.description,
        avatarUrl: row.avatarUrl,
        adminUserId: row.adminUserId,
        createdAt: new Date(row.createdAt),
        updatedAt: new Date(row.updatedAt),
        members,
        memberCount: row.memberCount,
        isAdmin: row.adminUserId === userId
      });
    }

    return groups;
  }

  async updateGroup(groupId: number, data: UpdateGroupDTO, adminUserId: number): Promise<Group | null> {
    // Verificar que sea admin
    const isAdmin = await this.isGroupAdmin(groupId, adminUserId);
    if (!isAdmin) return null;

    const updates: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }
    if (data.description !== undefined) {
      updates.push('description = ?');
      values.push(data.description);
    }
    if (data.avatarUrl !== undefined) {
      updates.push('avatar_url = ?');
      values.push(data.avatarUrl);
    }

    if (updates.length === 0) return this.getGroupById(groupId);

    values.push(groupId);

    // 🔥 CORREGIDO: Agregado backticks a `groups`
    await this.db.query(
      `UPDATE \`groups\` SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    return this.getGroupById(groupId);
  }

  async deleteGroup(groupId: number, adminUserId: number): Promise<boolean> {
    const isAdmin = await this.isGroupAdmin(groupId, adminUserId);
    if (!isAdmin) return false;

    // 🔥 CORREGIDO: Agregado backticks a `groups`
    const [result] = await this.db.query<ResultSetHeader>(
      `DELETE FROM \`groups\` WHERE id = ?`,
      [groupId]
    );

    return result.affectedRows > 0;
  }

  async isGroupAdmin(groupId: number, userId: number): Promise<boolean> {
    // 🔥 CORREGIDO: Agregado backticks a `groups`
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT 1 FROM \`groups\` WHERE id = ? AND admin_user_id = ?`,
      [groupId, userId]
    );

    return rows.length > 0;
  }

  // ========== MIEMBROS ==========

  async addMember(data: AddMemberDTO): Promise<GroupMember> {
    // Verificar si ya es miembro activo
    const isActive = await this.isActiveMember(data.groupId, data.userId);
    if (isActive) {
      throw new Error('El usuario ya es miembro activo del grupo');
    }

    // Insertar nuevo miembro
    await this.db.query(
      `INSERT INTO group_members (group_id, user_id, added_by_user_id)
       VALUES (?, ?, ?)`,
      [data.groupId, data.userId, data.addedByUserId]
    );

    // Obtener el miembro agregado
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT 
        gm.id,
        gm.group_id as groupId,
        gm.user_id as userId,
        gm.joined_at as joinedAt,
        gm.left_at as leftAt,
        gm.added_by_user_id as addedByUserId,
        u.username,
        u.email,
        u.avatar_url as avatarUrl,
        u.status
       FROM group_members gm
       INNER JOIN users u ON gm.user_id = u.id
       WHERE gm.group_id = ? AND gm.user_id = ? AND gm.left_at IS NULL
       ORDER BY gm.id DESC
       LIMIT 1`,
      [data.groupId, data.userId]
    );

    return {
      id: rows[0].id,
      groupId: rows[0].groupId,
      userId: rows[0].userId,
      joinedAt: new Date(rows[0].joinedAt),
      leftAt: rows[0].leftAt ? new Date(rows[0].leftAt) : null,
      addedByUserId: rows[0].addedByUserId,
      username: rows[0].username,
      email: rows[0].email,
      avatarUrl: rows[0].avatarUrl,
      status: rows[0].status,
      isActive: true
    };
  }

  async removeMember(data: RemoveMemberDTO): Promise<boolean> {
    // Verificar que el que remueve sea el admin
    const isAdmin = await this.isGroupAdmin(data.groupId, data.removedByUserId);
    if (!isAdmin) return false;

    // No puede remover al admin
    const group = await this.getGroupById(data.groupId);
    if (group?.adminUserId === data.userId) return false;

    // Marcar como removido (left_at = NOW())
    const [result] = await this.db.query<ResultSetHeader>(
      `UPDATE group_members 
       SET left_at = NOW()
       WHERE group_id = ? AND user_id = ? AND left_at IS NULL`,
      [data.groupId, data.userId]
    );

    return result.affectedRows > 0;
  }

  async getGroupMembers(groupId: number): Promise<GroupMember[]> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT 
        gm.id,
        gm.group_id as groupId,
        gm.user_id as userId,
        gm.joined_at as joinedAt,
        gm.left_at as leftAt,
        gm.added_by_user_id as addedByUserId,
        u.username,
        u.email,
        u.avatar_url as avatarUrl,
        u.status
       FROM group_members gm
       INNER JOIN users u ON gm.user_id = u.id
       WHERE gm.group_id = ? AND gm.left_at IS NULL
       ORDER BY gm.joined_at ASC`,
      [groupId]
    );

    return rows.map(row => ({
      id: row.id,
      groupId: row.groupId,
      userId: row.userId,
      joinedAt: new Date(row.joinedAt),
      leftAt: row.leftAt ? new Date(row.leftAt) : null,
      addedByUserId: row.addedByUserId,
      username: row.username,
      email: row.email,
      avatarUrl: row.avatarUrl,
      status: row.status,
      isActive: true
    }));
  }

  async isActiveMember(groupId: number, userId: number): Promise<boolean> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT 1 FROM group_members 
       WHERE group_id = ? AND user_id = ? AND left_at IS NULL`,
      [groupId, userId]
    );

    return rows.length > 0;
  }

  async getMemberJoinedAt(groupId: number, userId: number): Promise<Date | null> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT joined_at FROM group_members 
       WHERE group_id = ? AND user_id = ? AND left_at IS NULL
       ORDER BY joined_at DESC LIMIT 1`,
      [groupId, userId]
    );

    if (rows.length === 0) return null;
    return new Date(rows[0].joined_at);
  }

  // ========== MENSAJES ==========

  async createGroupMessage(data: CreateGroupMessageDTO): Promise<GroupMessage> {
    // Verificar que sea miembro activo
    const isActive = await this.isActiveMember(data.groupId, data.senderId);
    if (!isActive) {
      throw new Error('No eres miembro activo de este grupo');
    }

    const [result] = await this.db.query<ResultSetHeader>(
      `INSERT INTO group_messages (group_id, sender_id, encrypted_content, iv)
       VALUES (?, ?, ?, ?)`,
      [data.groupId, data.senderId, data.encryptedContent, data.iv]
    );

    // Obtener el mensaje creado
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT 
        gm.id,
        gm.group_id as groupId,
        gm.sender_id as senderId,
        gm.encrypted_content as encryptedContent,
        gm.iv,
        gm.timestamp,
        gm.edited_at as editedAt,
        gm.is_deleted_for_all as isDeletedForAll,
        gm.deleted_at as deletedAt,
        u.username as senderUsername,
        u.email as senderEmail,
        u.avatar_url as senderAvatarUrl
       FROM group_messages gm
       INNER JOIN users u ON gm.sender_id = u.id
       WHERE gm.id = ?`,
      [result.insertId]
    );

    return {
      id: rows[0].id,
      groupId: rows[0].groupId,
      senderId: rows[0].senderId,
      encryptedContent: rows[0].encryptedContent,
      iv: rows[0].iv,
      timestamp: new Date(rows[0].timestamp),
      editedAt: rows[0].editedAt ? new Date(rows[0].editedAt) : null,
      isDeletedForAll: Boolean(rows[0].isDeletedForAll),
      deletedAt: rows[0].deletedAt ? new Date(rows[0].deletedAt) : null,
      senderUsername: rows[0].senderUsername,
      senderEmail: rows[0].senderEmail,
      senderAvatarUrl: rows[0].senderAvatarUrl
    };
  }

  async getGroupMessages(
    groupId: number,
    userId: number,
    limit: number = 50,
    offset: number = 0
  ): Promise<GroupMessage[]> {
    // Obtener la fecha de entrada del usuario
    const joinedAt = await this.getMemberJoinedAt(groupId, userId);
    if (!joinedAt) {
      throw new Error('No eres miembro de este grupo');
    }

    // Solo traer mensajes DESPUÉS de su entrada
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT 
        gm.id,
        gm.group_id as groupId,
        gm.sender_id as senderId,
        gm.encrypted_content as encryptedContent,
        gm.iv,
        gm.timestamp,
        gm.edited_at as editedAt,
        gm.is_deleted_for_all as isDeletedForAll,
        gm.deleted_at as deletedAt,
        u.username as senderUsername,
        u.email as senderEmail,
        u.avatar_url as senderAvatarUrl
       FROM group_messages gm
       INNER JOIN users u ON gm.sender_id = u.id
       WHERE gm.group_id = ? 
         AND gm.timestamp >= ?
         AND gm.is_deleted_for_all = 0
       ORDER BY gm.timestamp DESC
       LIMIT ? OFFSET ?`,
      [groupId, joinedAt, limit, offset]
    );

    return rows.map(row => ({
      id: row.id,
      groupId: row.groupId,
      senderId: row.senderId,
      encryptedContent: row.encryptedContent,
      iv: row.iv,
      timestamp: new Date(row.timestamp),
      editedAt: row.editedAt ? new Date(row.editedAt) : null,
      isDeletedForAll: Boolean(row.isDeletedForAll),
      deletedAt: row.deletedAt ? new Date(row.deletedAt) : null,
      senderUsername: row.senderUsername,
      senderEmail: row.senderEmail,
      senderAvatarUrl: row.senderAvatarUrl
    }));
  }

  async updateGroupMessage(data: UpdateGroupMessageDTO): Promise<GroupMessage | null> {
    // Verificar que sea el autor
    const [checkRows] = await this.db.query<RowDataPacket[]>(
      `SELECT sender_id FROM group_messages WHERE id = ?`,
      [data.messageId]
    );

    if (checkRows.length === 0 || checkRows[0].sender_id !== data.userId) {
      return null;
    }

    // Actualizar mensaje
    await this.db.query(
      `UPDATE group_messages 
       SET encrypted_content = ?, iv = ?, edited_at = NOW()
       WHERE id = ?`,
      [data.encryptedContent, data.iv, data.messageId]
    );

    // Obtener mensaje actualizado
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT 
        gm.id,
        gm.group_id as groupId,
        gm.sender_id as senderId,
        gm.encrypted_content as encryptedContent,
        gm.iv,
        gm.timestamp,
        gm.edited_at as editedAt,
        gm.is_deleted_for_all as isDeletedForAll,
        gm.deleted_at as deletedAt,
        u.username as senderUsername,
        u.email as senderEmail,
        u.avatar_url as senderAvatarUrl
       FROM group_messages gm
       INNER JOIN users u ON gm.sender_id = u.id
       WHERE gm.id = ?`,
      [data.messageId]
    );

    return {
      id: rows[0].id,
      groupId: rows[0].groupId,
      senderId: rows[0].senderId,
      encryptedContent: rows[0].encryptedContent,
      iv: rows[0].iv,
      timestamp: new Date(rows[0].timestamp),
      editedAt: rows[0].editedAt ? new Date(rows[0].editedAt) : null,
      isDeletedForAll: Boolean(rows[0].isDeletedForAll),
      deletedAt: rows[0].deletedAt ? new Date(rows[0].deletedAt) : null,
      senderUsername: rows[0].senderUsername,
      senderEmail: rows[0].senderEmail,
      senderAvatarUrl: rows[0].senderAvatarUrl
    };
  }

  async deleteGroupMessage(data: DeleteGroupMessageDTO): Promise<boolean> {
    // Verificar que sea el autor
    const [checkRows] = await this.db.query<RowDataPacket[]>(
      `SELECT sender_id FROM group_messages WHERE id = ?`,
      [data.messageId]
    );

    if (checkRows.length === 0 || checkRows[0].sender_id !== data.userId) {
      return false;
    }

    if (data.deleteForAll) {
      // Eliminar para todos
      const [result] = await this.db.query<ResultSetHeader>(
        `UPDATE group_messages 
         SET is_deleted_for_all = 1, deleted_at = NOW()
         WHERE id = ?`,
        [data.messageId]
      );
      return result.affectedRows > 0;
    } else {
      // Para grupos, por ahora solo soportamos eliminar para todos
      return false;
    }
  }

  async markMessageAsRead(data: MarkGroupMessageAsReadDTO): Promise<boolean> {
    try {
      await this.db.query(
        `INSERT INTO group_message_reads (group_message_id, user_id)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE read_at = NOW()`,
        [data.groupMessageId, data.userId]
      );
      return true;
    } catch (error) {
      return false;
    }
  }

  async getGroupMessageWithReads(messageId: number): Promise<GroupMessageWithReads | null> {
    // Obtener el mensaje
    const [msgRows] = await this.db.query<RowDataPacket[]>(
      `SELECT 
        gm.id,
        gm.group_id as groupId,
        gm.sender_id as senderId,
        gm.encrypted_content as encryptedContent,
        gm.iv,
        gm.timestamp,
        gm.edited_at as editedAt,
        gm.is_deleted_for_all as isDeletedForAll,
        gm.deleted_at as deletedAt,
        u.username as senderUsername,
        u.email as senderEmail,
        u.avatar_url as senderAvatarUrl
       FROM group_messages gm
       INNER JOIN users u ON gm.sender_id = u.id
       WHERE gm.id = ?`,
      [messageId]
    );

    if (msgRows.length === 0) return null;

    // Obtener lecturas
    const [readRows] = await this.db.query<RowDataPacket[]>(
      `SELECT 
        gmr.user_id as userId,
        gmr.read_at as readAt,
        u.username,
        u.avatar_url as avatarUrl
       FROM group_message_reads gmr
       INNER JOIN users u ON gmr.user_id = u.id
       WHERE gmr.group_message_id = ?`,
      [messageId]
    );

    // Contar miembros totales
    const [countRows] = await this.db.query<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM group_members 
       WHERE group_id = ? AND left_at IS NULL`,
      [msgRows[0].groupId]
    );

    const readBy = readRows.map(row => ({
      userId: row.userId,
      username: row.username,
      avatarUrl: row.avatarUrl,
      readAt: new Date(row.readAt)
    }));

    return {
      id: msgRows[0].id,
      groupId: msgRows[0].groupId,
      senderId: msgRows[0].senderId,
      encryptedContent: msgRows[0].encryptedContent,
      iv: msgRows[0].iv,
      timestamp: new Date(msgRows[0].timestamp),
      editedAt: msgRows[0].editedAt ? new Date(msgRows[0].editedAt) : null,
      isDeletedForAll: Boolean(msgRows[0].isDeletedForAll),
      deletedAt: msgRows[0].deletedAt ? new Date(msgRows[0].deletedAt) : null,
      senderUsername: msgRows[0].senderUsername,
      senderEmail: msgRows[0].senderEmail,
      senderAvatarUrl: msgRows[0].senderAvatarUrl,
      readBy,
      readCount: readBy.length,
      totalMembers: countRows[0].total
    };
  }

  async searchGroupMessages(data: SearchGroupMessagesDTO): Promise<GroupMessage[]> {
    // Verificar que sea miembro activo
    const joinedAt = await this.getMemberJoinedAt(data.groupId, data.userId);
    if (!joinedAt) {
      throw new Error('No eres miembro de este grupo');
    }

    const searchPattern = `%${data.searchTerm}%`;
    const limit = data.limit || 50;
    const offset = data.offset || 0;

    // Buscar en mensajes (encriptados, pero podemos buscar por remitente)
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT 
        gm.id,
        gm.group_id as groupId,
        gm.sender_id as senderId,
        gm.encrypted_content as encryptedContent,
        gm.iv,
        gm.timestamp,
        gm.edited_at as editedAt,
        gm.is_deleted_for_all as isDeletedForAll,
        gm.deleted_at as deletedAt,
        u.username as senderUsername,
        u.email as senderEmail,
        u.avatar_url as senderAvatarUrl
       FROM group_messages gm
       INNER JOIN users u ON gm.sender_id = u.id
       WHERE gm.group_id = ? 
         AND gm.timestamp >= ?
         AND gm.is_deleted_for_all = 0
         AND (u.username LIKE ? OR u.email LIKE ?)
       ORDER BY gm.timestamp DESC
       LIMIT ? OFFSET ?`,
      [data.groupId, joinedAt, searchPattern, searchPattern, limit, offset]
    );

    return rows.map(row => ({
      id: row.id,
      groupId: row.groupId,
      senderId: row.senderId,
      encryptedContent: row.encryptedContent,
      iv: row.iv,
      timestamp: new Date(row.timestamp),
      editedAt: row.editedAt ? new Date(row.editedAt) : null,
      isDeletedForAll: Boolean(row.isDeletedForAll),
      deletedAt: row.deletedAt ? new Date(row.deletedAt) : null,
      senderUsername: row.senderUsername,
      senderEmail: row.senderEmail,
      senderAvatarUrl: row.senderAvatarUrl
    }));
  }

  async getLastGroupMessage(groupId: number): Promise<GroupMessage | null> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT 
        gm.id,
        gm.group_id as groupId,
        gm.sender_id as senderId,
        gm.encrypted_content as encryptedContent,
        gm.iv,
        gm.timestamp,
        gm.edited_at as editedAt,
        gm.is_deleted_for_all as isDeletedForAll,
        gm.deleted_at as deletedAt,
        u.username as senderUsername,
        u.email as senderEmail,
        u.avatar_url as senderAvatarUrl
       FROM group_messages gm
       INNER JOIN users u ON gm.sender_id = u.id
       WHERE gm.group_id = ? AND gm.is_deleted_for_all = 0
       ORDER BY gm.timestamp DESC
       LIMIT 1`,
      [groupId]
    );

    if (rows.length === 0) return null;

    return {
      id: rows[0].id,
      groupId: rows[0].groupId,
      senderId: rows[0].senderId,
      encryptedContent: rows[0].encryptedContent,
      iv: rows[0].iv,
      timestamp: new Date(rows[0].timestamp),
      editedAt: rows[0].editedAt ? new Date(rows[0].editedAt) : null,
      isDeletedForAll: Boolean(rows[0].isDeletedForAll),
      deletedAt: rows[0].deletedAt ? new Date(rows[0].deletedAt) : null,
      senderUsername: rows[0].senderUsername,
      senderEmail: rows[0].senderEmail,
      senderAvatarUrl: rows[0].senderAvatarUrl
    };
  }

  async getUnreadCount(groupId: number, userId: number): Promise<number> {
    const joinedAt = await this.getMemberJoinedAt(groupId, userId);
    if (!joinedAt) return 0;

    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT COUNT(*) as count
       FROM group_messages gm
       WHERE gm.group_id = ?
         AND gm.sender_id != ?
         AND gm.timestamp >= ?
         AND gm.is_deleted_for_all = 0
         AND NOT EXISTS (
           SELECT 1 FROM group_message_reads gmr
           WHERE gmr.group_message_id = gm.id AND gmr.user_id = ?
         )`,
      [groupId, userId, joinedAt, userId]
    );

    return rows[0].count;
  }
}