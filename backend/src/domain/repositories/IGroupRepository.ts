// backend/src/domain/repositories/IGroupRepository.ts

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
} from '../entities/Group.entity';

export interface IGroupRepository {
  // ========== GRUPOS ==========
  /**
   * Crear un nuevo grupo
   */
  createGroup(data: CreateGroupDTO): Promise<Group>;

  /**
   * Obtener un grupo por ID
   */
  getGroupById(groupId: number): Promise<Group | null>;

  /**
   * Obtener todos los grupos de un usuario (donde es miembro activo)
   */
  getUserGroups(userId: number): Promise<GroupWithMembers[]>;

  /**
   * Actualizar información del grupo (solo admin)
   */
  updateGroup(groupId: number, data: UpdateGroupDTO, adminUserId: number): Promise<Group | null>;

  /**
   * Eliminar un grupo (solo admin)
   */
  deleteGroup(groupId: number, adminUserId: number): Promise<boolean>;

  /**
   * Verificar si un usuario es admin del grupo
   */
  isGroupAdmin(groupId: number, userId: number): Promise<boolean>;

  // ========== MIEMBROS ==========
  /**
   * Agregar un miembro al grupo
   */
  addMember(data: AddMemberDTO): Promise<GroupMember>;

  /**
   * Remover un miembro del grupo (marcar left_at)
   */
  removeMember(data: RemoveMemberDTO): Promise<boolean>;

  /**
   * Obtener todos los miembros activos de un grupo
   */
  getGroupMembers(groupId: number): Promise<GroupMember[]>;

  /**
   * Verificar si un usuario es miembro activo del grupo
   */
  isActiveMember(groupId: number, userId: number): Promise<boolean>;

  /**
   * Obtener la fecha de entrada de un miembro al grupo
   */
  getMemberJoinedAt(groupId: number, userId: number): Promise<Date | null>;

  // ========== MENSAJES ==========
  /**
   * Crear un mensaje en el grupo
   */
  createGroupMessage(data: CreateGroupMessageDTO): Promise<GroupMessage>;

  /**
   * Obtener mensajes de un grupo (solo los posteriores a la fecha de entrada del usuario)
   */
  getGroupMessages(groupId: number, userId: number, limit?: number, offset?: number): Promise<GroupMessage[]>;

  /**
   * Editar un mensaje del grupo
   */
  updateGroupMessage(data: UpdateGroupMessageDTO): Promise<GroupMessage | null>;

  /**
   * Eliminar un mensaje del grupo
   */
  deleteGroupMessage(data: DeleteGroupMessageDTO): Promise<boolean>;

  /**
   * Marcar mensaje como leído
   */
  markMessageAsRead(data: MarkGroupMessageAsReadDTO): Promise<boolean>;

  /**
   * Obtener mensaje con información de lecturas
   */
  getGroupMessageWithReads(messageId: number): Promise<GroupMessageWithReads | null>;

  /**
   * Buscar mensajes en el grupo
   */
  searchGroupMessages(data: SearchGroupMessagesDTO): Promise<GroupMessage[]>;

  /**
   * Obtener el último mensaje del grupo
   */
  getLastGroupMessage(groupId: number): Promise<GroupMessage | null>;

  /**
   * Contar mensajes no leídos en un grupo para un usuario
   */
  getUnreadCount(groupId: number, userId: number): Promise<number>;
}