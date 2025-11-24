// backend/src/domain/entities/GroupMessage.entity.ts

export interface GroupMessage {
  id: number;
  groupId: number;
  senderId: number;
  encryptedContent: string;
  iv: string;
  timestamp: Date;
  editedAt: Date | null;
  isDeletedForAll: boolean;
  deletedAt: Date | null;
  // Información del remitente
  senderUsername: string;
  senderEmail: string;
  senderAvatarUrl: string | null;
}

export interface CreateGroupMessageDTO {
  groupId: number;
  senderId: number;
  encryptedContent: string;
  iv: string;
}

export interface UpdateGroupMessageDTO {
  messageId: number;
  encryptedContent: string;
  iv: string;
  userId: number; // Para verificar que sea el autor
}

export interface DeleteGroupMessageDTO {
  messageId: number;
  userId: number; // Para verificar que sea el autor
  deleteForAll: boolean;
}

export interface GroupMessageWithReads extends GroupMessage {
  readBy: MessageRead[];
  readCount: number;
  totalMembers: number;
}

export interface MessageRead {
  userId: number;
  username: string;
  avatarUrl: string | null;
  readAt: Date;
}

export interface MarkGroupMessageAsReadDTO {
  groupMessageId: number;
  userId: number;
}

export interface SearchGroupMessagesDTO {
  groupId: number;
  userId: number; // Para verificar que sea miembro
  searchTerm: string;
  limit?: number;
  offset?: number;
}