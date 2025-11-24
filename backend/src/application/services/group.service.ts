// backend/src/application/services/group.service.ts

import { GroupRepository } from '../../infrastructure/repositories/group.repository';
import { EncryptionService } from '../../infrastructure/services/encryption.service';
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
  SearchGroupMessagesDTO
} from '../../domain/entities/Group.entity';

export interface SendGroupMessageDTO {
  groupId: number;
  senderId: number;
  content: string;
}

export interface DecryptedGroupMessage extends Omit<GroupMessage, 'encryptedContent' | 'iv'> {
  content: string;
}

export class GroupService {
  private encryptionService: EncryptionService;

  constructor(private groupRepository: GroupRepository) {
    this.encryptionService = new EncryptionService();
  }

  // ========== GRUPOS ==========

  /**
   * Crear un nuevo grupo
   */
  async createGroup(data: CreateGroupDTO): Promise<Group> {
    if (!data.name || data.name.trim().length === 0) {
      throw new Error('El nombre del grupo no puede estar vacío');
    }

    if (data.name.length > 100) {
      throw new Error('El nombre del grupo no puede exceder 100 caracteres');
    }

    return await this.groupRepository.createGroup(data);
  }

  /**
   * Obtener un grupo por ID
   */
  async getGroupById(groupId: number, userId: number): Promise<Group | null> {
    const group = await this.groupRepository.getGroupById(groupId);
    
    if (!group) return null;

    // Verificar que el usuario sea miembro
    const isMember = await this.groupRepository.isActiveMember(groupId, userId);
    if (!isMember) {
      throw new Error('No eres miembro de este grupo');
    }

    return group;
  }

  /**
   * Obtener todos los grupos del usuario
   */
  async getUserGroups(userId: number): Promise<GroupWithMembers[]> {
    return await this.groupRepository.getUserGroups(userId);
  }

  /**
   * Actualizar información del grupo (solo admin)
   */
  async updateGroup(groupId: number, data: UpdateGroupDTO, adminUserId: number): Promise<Group> {
    const updatedGroup = await this.groupRepository.updateGroup(groupId, data, adminUserId);
    
    if (!updatedGroup) {
      throw new Error('No tienes permisos para editar este grupo o el grupo no existe');
    }

    return updatedGroup;
  }

  /**
   * Eliminar un grupo (solo admin)
   */
  async deleteGroup(groupId: number, adminUserId: number): Promise<boolean> {
    const result = await this.groupRepository.deleteGroup(groupId, adminUserId);
    
    if (!result) {
      throw new Error('No tienes permisos para eliminar este grupo o el grupo no existe');
    }

    return result;
  }

  // ========== MIEMBROS ==========

  /**
   * Agregar un miembro al grupo (solo admin)
   */
  async addMember(data: AddMemberDTO): Promise<GroupMember> {
    // Verificar que quien agrega sea admin
    const isAdmin = await this.groupRepository.isGroupAdmin(data.groupId, data.addedByUserId);
    if (!isAdmin) {
      throw new Error('Solo el administrador puede agregar miembros');
    }

    // Verificar que el grupo exista
    const group = await this.groupRepository.getGroupById(data.groupId);
    if (!group) {
      throw new Error('El grupo no existe');
    }

    return await this.groupRepository.addMember(data);
  }

  /**
   * Remover un miembro del grupo (solo admin)
   */
  async removeMember(data: RemoveMemberDTO): Promise<boolean> {
    const result = await this.groupRepository.removeMember(data);
    
    if (!result) {
      throw new Error('No tienes permisos para remover miembros o el miembro no existe');
    }

    return result;
  }

  /**
   * Obtener miembros del grupo
   */
  async getGroupMembers(groupId: number, userId: number): Promise<GroupMember[]> {
    // Verificar que sea miembro
    const isMember = await this.groupRepository.isActiveMember(groupId, userId);
    if (!isMember) {
      throw new Error('No eres miembro de este grupo');
    }

    return await this.groupRepository.getGroupMembers(groupId);
  }

  /**
   * Verificar si un usuario es admin del grupo
   */
  async isGroupAdmin(groupId: number, userId: number): Promise<boolean> {
    return await this.groupRepository.isGroupAdmin(groupId, userId);
  }

  // ========== MENSAJES ==========

  /**
   * Enviar un mensaje en el grupo (encriptado)
   */
  async sendGroupMessage(data: SendGroupMessageDTO): Promise<DecryptedGroupMessage> {
    if (!data.content || data.content.trim().length === 0) {
      throw new Error('El mensaje no puede estar vacío');
    }

    // Verificar que sea miembro activo
    const isMember = await this.groupRepository.isActiveMember(data.groupId, data.senderId);
    if (!isMember) {
      throw new Error('No eres miembro activo de este grupo');
    }

    // Encriptar el mensaje
    const { encryptedContent, iv } = this.encryptionService.encrypt(data.content);

    const messageData: CreateGroupMessageDTO = {
      groupId: data.groupId,
      senderId: data.senderId,
      encryptedContent,
      iv
    };

    const message = await this.groupRepository.createGroupMessage(messageData);
    return this.decryptGroupMessage(message);
  }

  /**
   * Obtener mensajes del grupo (desencriptados)
   */
  async getGroupMessages(
    groupId: number,
    userId: number,
    limit: number = 50,
    offset: number = 0
  ): Promise<DecryptedGroupMessage[]> {
    const messages = await this.groupRepository.getGroupMessages(groupId, userId, limit, offset);
    return messages.map(msg => this.decryptGroupMessage(msg));
  }

  /**
   * Editar un mensaje del grupo
   */
  async editGroupMessage(messageId: number, userId: number, newContent: string): Promise<DecryptedGroupMessage> {
    if (!newContent || newContent.trim().length === 0) {
      throw new Error('El mensaje no puede estar vacío');
    }

    // Encriptar el nuevo contenido
    const { encryptedContent, iv } = this.encryptionService.encrypt(newContent);

    const data: UpdateGroupMessageDTO = {
      messageId,
      userId,
      encryptedContent,
      iv
    };

    const updatedMessage = await this.groupRepository.updateGroupMessage(data);
    
    if (!updatedMessage) {
      throw new Error('No tienes permisos para editar este mensaje o el mensaje no existe');
    }

    console.log(`✏️ Mensaje de grupo ${messageId} editado exitosamente`);
    return this.decryptGroupMessage(updatedMessage);
  }

  /**
   * Eliminar un mensaje del grupo
   */
  async deleteGroupMessage(messageId: number, userId: number, deleteForAll: boolean = true): Promise<boolean> {
    const result = await this.groupRepository.deleteGroupMessage({
      messageId,
      userId,
      deleteForAll
    });

    if (!result) {
      throw new Error('No tienes permisos para eliminar este mensaje o el mensaje no existe');
    }

    return result;
  }

  /**
   * Marcar mensaje como leído
   */
  async markGroupMessageAsRead(groupMessageId: number, userId: number): Promise<boolean> {
    return await this.groupRepository.markMessageAsRead({
      groupMessageId,
      userId
    });
  }

  /**
   * Buscar mensajes en el grupo
   */
  async searchGroupMessages(data: SearchGroupMessagesDTO): Promise<DecryptedGroupMessage[]> {
    const messages = await this.groupRepository.searchGroupMessages(data);
    return messages.map(msg => this.decryptGroupMessage(msg));
  }

  /**
   * Obtener mensajes no leídos de un grupo
   */
  async getUnreadCount(groupId: number, userId: number): Promise<number> {
    return await this.groupRepository.getUnreadCount(groupId, userId);
  }

  // ========== HELPERS ==========

  /**
   * Método privado para desencriptar un mensaje de grupo
   */
  private decryptGroupMessage(message: GroupMessage): DecryptedGroupMessage {
    try {
      if (message.isDeletedForAll) {
        const { encryptedContent, iv, ...rest } = message;
        return {
          ...rest,
          content: 'Este mensaje fue eliminado'
        };
      }

      const decryptedContent = this.encryptionService.decrypt(
        message.encryptedContent,
        message.iv
      );

      const { encryptedContent, iv, ...rest } = message;

      return {
        ...rest,
        content: decryptedContent
      };
    } catch (error) {
      console.error('❌ Error al desencriptar mensaje de grupo:', error);
      const { encryptedContent, iv, ...rest } = message;
      return {
        ...rest,
        content: '[Mensaje encriptado - error al desencriptar]'
      };
    }
  }
}