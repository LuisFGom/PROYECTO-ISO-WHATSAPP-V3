// backend/src/presentation/controllers/group.controller.ts

import { Request, Response } from 'express';
import { GroupService } from '../../application/services/group.service';
import { GroupRepository } from '../../infrastructure/repositories/group.repository';
import { database } from '../../infrastructure/database/mysql/connection';

export class GroupController {
  private groupService: GroupService;

  constructor() {
    const groupRepository = new GroupRepository(database.getPool());
    this.groupService = new GroupService(groupRepository);
    console.log('✅ GroupController inicializado');
  }

  // ========== GRUPOS ==========

  /**
   * Crear un nuevo grupo
   * POST /api/groups
   */
  async createGroup(req: Request, res: Response): Promise<void> {
    try {
      console.log('🔥 createGroup - Body:', req.body);
      console.log('🔥 createGroup - User:', (req as any).user);
      
      const userId = (req as any).user?.id || (req as any).userId;

      if (!userId) {
        console.error('❌ No autenticado - userId no encontrado');
        res.status(401).json({ error: 'No autenticado' });
        return;
      }

      const { name, description, avatarUrl, memberIds } = req.body;

      if (!name) {
        console.error('❌ Nombre del grupo faltante');
        res.status(400).json({ error: 'El nombre del grupo es obligatorio' });
        return;
      }

      console.log('✅ Creando grupo:', { name, description, adminUserId: userId });

      const group = await this.groupService.createGroup({
        name,
        description,
        avatarUrl,
        adminUserId: userId
      });

      console.log('✅ Grupo creado exitosamente:', group);

      // 🔥 NUEVO: Si hay memberIds, agregar miembros
      if (memberIds && Array.isArray(memberIds) && memberIds.length > 0) {
        console.log('👥 Agregando miembros:', memberIds);
        
        for (const memberId of memberIds) {
          try {
            await this.groupService.addMember({
              groupId: group.id,
              userId: memberId,
              addedByUserId: userId
            });
            console.log(`✅ Miembro ${memberId} agregado al grupo ${group.id}`);
          } catch (error: any) {
            console.error(`⚠️ Error al agregar miembro ${memberId}:`, error.message);
            // Continuar agregando otros miembros aunque uno falle
          }
        }
      }

      // Obtener el grupo con miembros actualizados
      const groupWithMembers = await this.groupService.getUserGroups(userId);
      const createdGroup = groupWithMembers.find(g => g.id === group.id);

      res.status(201).json({
        success: true,
        message: 'Grupo creado exitosamente',
        data: createdGroup || group
      });
    } catch (error: any) {
      console.error('❌ Error al crear grupo:', error);
      res.status(500).json({
        success: false,
        error: 'Error al crear grupo',
        message: error.message
      });
    }
  }

  /**
   * Obtener un grupo por ID
   * GET /api/groups/:id
   */
  async getGroupById(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id || (req as any).userId;
      const groupId = parseInt(req.params.id);

      if (!userId) {
        res.status(401).json({ error: 'No autenticado' });
        return;
      }

      const group = await this.groupService.getGroupById(groupId, userId);

      if (!group) {
        res.status(404).json({ error: 'Grupo no encontrado' });
        return;
      }

      res.json({
        success: true,
        data: group
      });
    } catch (error: any) {
      console.error('❌ Error al obtener grupo:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener grupo',
        message: error.message
      });
    }
  }

  /**
   * Obtener todos los grupos del usuario
   * GET /api/groups
   */
  async getUserGroups(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id || (req as any).userId;

      if (!userId) {
        res.status(401).json({ error: 'No autenticado' });
        return;
      }

      const groups = await this.groupService.getUserGroups(userId);

      res.json({
        success: true,
        count: groups.length,
        data: groups
      });
    } catch (error: any) {
      console.error('❌ Error al obtener grupos:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener grupos',
        message: error.message
      });
    }
  }

  /**
   * Actualizar información del grupo (solo admin)
   * PUT /api/groups/:id
   */
  async updateGroup(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id || (req as any).userId;
      const groupId = parseInt(req.params.id);

      if (!userId) {
        res.status(401).json({ error: 'No autenticado' });
        return;
      }

      const { name, description, avatarUrl } = req.body;

      const updatedGroup = await this.groupService.updateGroup(
        groupId,
        { name, description, avatarUrl },
        userId
      );

      res.json({
        success: true,
        message: 'Grupo actualizado exitosamente',
        data: updatedGroup
      });
    } catch (error: any) {
      console.error('❌ Error al actualizar grupo:', error);
      res.status(403).json({
        success: false,
        error: 'Error al actualizar grupo',
        message: error.message
      });
    }
  }

  /**
   * Eliminar un grupo (solo admin)
   * DELETE /api/groups/:id
   */
  async deleteGroup(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id || (req as any).userId;
      const groupId = parseInt(req.params.id);

      if (!userId) {
        res.status(401).json({ error: 'No autenticado' });
        return;
      }

      await this.groupService.deleteGroup(groupId, userId);

      res.json({
        success: true,
        message: 'Grupo eliminado exitosamente'
      });
    } catch (error: any) {
      console.error('❌ Error al eliminar grupo:', error);
      res.status(403).json({
        success: false,
        error: 'Error al eliminar grupo',
        message: error.message
      });
    }
  }

  // ========== MIEMBROS ==========

  /**
   * Obtener miembros del grupo
   * GET /api/groups/:id/members
   */
  async getGroupMembers(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id || (req as any).userId;
      const groupId = parseInt(req.params.id);

      if (!userId) {
        res.status(401).json({ error: 'No autenticado' });
        return;
      }

      const members = await this.groupService.getGroupMembers(groupId, userId);

      res.json({
        success: true,
        count: members.length,
        data: members
      });
    } catch (error: any) {
      console.error('❌ Error al obtener miembros:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener miembros',
        message: error.message
      });
    }
  }

  /**
   * Agregar un miembro al grupo (solo admin)
   * POST /api/groups/:id/members
   */
  async addMember(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id || (req as any).userId;
      const groupId = parseInt(req.params.id);

      if (!userId) {
        res.status(401).json({ error: 'No autenticado' });
        return;
      }

      const { userIdToAdd } = req.body;

      if (!userIdToAdd) {
        res.status(400).json({ error: 'El ID del usuario es obligatorio' });
        return;
      }

      const member = await this.groupService.addMember({
        groupId,
        userId: userIdToAdd,
        addedByUserId: userId
      });

      res.status(201).json({
        success: true,
        message: 'Miembro agregado exitosamente',
        data: member
      });
    } catch (error: any) {
      console.error('❌ Error al agregar miembro:', error);
      res.status(403).json({
        success: false,
        error: 'Error al agregar miembro',
        message: error.message
      });
    }
  }

  /**
   * Remover un miembro del grupo (solo admin)
   * DELETE /api/groups/:id/members/:userId
   */
  async removeMember(req: Request, res: Response): Promise<void> {
    try {
      const adminUserId = (req as any).user?.id || (req as any).userId;
      const groupId = parseInt(req.params.id);
      const userIdToRemove = parseInt(req.params.userId);

      if (!adminUserId) {
        res.status(401).json({ error: 'No autenticado' });
        return;
      }

      await this.groupService.removeMember({
        groupId,
        userId: userIdToRemove,
        removedByUserId: adminUserId
      });

      res.json({
        success: true,
        message: 'Miembro removido exitosamente'
      });
    } catch (error: any) {
      console.error('❌ Error al remover miembro:', error);
      res.status(403).json({
        success: false,
        error: 'Error al remover miembro',
        message: error.message
      });
    }
  }

  // ========== MENSAJES ==========

  /**
   * Obtener mensajes del grupo
   * GET /api/groups/:id/messages
   */
  async getGroupMessages(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id || (req as any).userId;
      const groupId = parseInt(req.params.id);
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      if (!userId) {
        res.status(401).json({ error: 'No autenticado' });
        return;
      }

      const messages = await this.groupService.getGroupMessages(groupId, userId, limit, offset);

      res.json({
        success: true,
        count: messages.length,
        data: messages
      });
    } catch (error: any) {
      console.error('❌ Error al obtener mensajes del grupo:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener mensajes del grupo',
        message: error.message
      });
    }
  }

  /**
   * Buscar mensajes en el grupo
   * POST /api/groups/:id/messages/search
   */
  async searchGroupMessages(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id || (req as any).userId;
      const groupId = parseInt(req.params.id);
      const { searchTerm, limit, offset } = req.body;

      if (!userId) {
        res.status(401).json({ error: 'No autenticado' });
        return;
      }

      if (!searchTerm) {
        res.status(400).json({ error: 'El término de búsqueda es obligatorio' });
        return;
      }

      const messages = await this.groupService.searchGroupMessages({
        groupId,
        userId,
        searchTerm,
        limit,
        offset
      });

      res.json({
        success: true,
        count: messages.length,
        data: messages
      });
    } catch (error: any) {
      console.error('❌ Error al buscar mensajes:', error);
      res.status(500).json({
        success: false,
        error: 'Error al buscar mensajes',
        message: error.message
      });
    }
  }

  /**
   * Obtener mensajes no leídos de un grupo
   * GET /api/groups/:id/unread-count
   */
  async getUnreadCount(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id || (req as any).userId;
      const groupId = parseInt(req.params.id);

      if (!userId) {
        res.status(401).json({ error: 'No autenticado' });
        return;
      }

      const count = await this.groupService.getUnreadCount(groupId, userId);

      res.json({
        success: true,
        count
      });
    } catch (error: any) {
      console.error('❌ Error al obtener mensajes no leídos:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener mensajes no leídos',
        message: error.message
      });
    }
  }
}

export const groupController = new GroupController();