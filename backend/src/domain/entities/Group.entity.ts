// backend/src/domain/entities/Group.entity.ts

// ========== GRUPO ==========
export interface Group {
  id: number;
  name: string;
  description: string | null;
  avatarUrl: string | null;
  adminUserId: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateGroupDTO {
  name: string;
  description?: string;
  avatarUrl?: string;
  adminUserId: number;
}

export interface UpdateGroupDTO {
  name?: string;
  description?: string;
  avatarUrl?: string;
}

export interface GroupWithMembers extends Group {
  members: GroupMember[];
  memberCount: number;
  isAdmin: boolean; // Si el usuario actual es admin
}

// ========== MIEMBROS ==========
export interface GroupMember {
  id: number;
  groupId: number;
  userId: number;
  joinedAt: Date;
  leftAt: Date | null;
  addedByUserId: number | null;
  // Información del usuario
  username: string;
  email: string;
  avatarUrl: string | null;
  status: 'online' | 'offline' | 'away';
  isActive: boolean; // Si left_at es NULL
}

export interface AddMemberDTO {
  groupId: number;
  userId: number;
  addedByUserId: number;
}

export interface RemoveMemberDTO {
  groupId: number;
  userId: number;
  removedByUserId: number; // Debe ser el admin
}

// ========== MENSAJES ==========
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