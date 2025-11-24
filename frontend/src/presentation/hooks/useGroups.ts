// frontend/src/presentation/hooks/useGroups.ts
import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../infrastructure/api/apiClient';

export interface GroupMember {
  id: number;
  groupId: number;
  userId: number;
  joinedAt: string;
  leftAt: string | null;
  addedByUserId: number | null;
  username: string;
  email: string;
  avatarUrl: string | null;
  status: 'online' | 'offline' | 'away';
  isActive: boolean;
}

export interface Group {
  id: number;
  name: string;
  description: string | null;
  avatarUrl: string | null;
  adminUserId: number;
  createdAt: string;
  updatedAt: string;
}

export interface GroupWithMembers extends Group {
  members: GroupMember[];
  memberCount: number;
  isAdmin: boolean;
}

export const useGroups = () => {
  const [groups, setGroups] = useState<GroupWithMembers[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 📥 Cargar grupos del usuario
  const loadGroups = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiClient.get('/groups');
      setGroups(response.data.data);
    } catch (err: any) {
      console.error('Error cargando grupos:', err);
      setError(err.response?.data?.message || 'Error al cargar grupos');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 🔄 Recargar grupos
  const refreshGroups = () => {
    loadGroups();
  };

  // 🔄 Recargar grupos en segundo plano (sin loader)
  const silentRefreshGroups = useCallback(async () => {
    try {
      const response = await apiClient.get('/groups');
      setGroups(response.data.data);
    } catch (err: any) {
      console.error('Error recargando grupos silenciosamente:', err);
    }
  }, []);

  // ➕ Crear un grupo
  const createGroup = async (data: {
    name: string;
    description?: string;
    avatarUrl?: string;
  }) => {
    try {
      const response = await apiClient.post('/groups', data);
      // Recargar lista
      await loadGroups();
      return { success: true, data: response.data.data };
    } catch (err: any) {
      console.error('Error creando grupo:', err);
      return {
        success: false,
        error: err.response?.data?.message || 'Error al crear grupo'
      };
    }
  };

  // ✏️ Actualizar información del grupo (solo admin)
  const updateGroup = async (
    groupId: number,
    data: {
      name?: string;
      description?: string;
      avatarUrl?: string;
    }
  ) => {
    try {
      await apiClient.put(`/groups/${groupId}`, data);
      // Actualizar lista local
      setGroups((prev) =>
        prev.map((g) =>
          g.id === groupId ? { ...g, ...data } : g
        )
      );
      return { success: true };
    } catch (err: any) {
      console.error('Error actualizando grupo:', err);
      return {
        success: false,
        error: err.response?.data?.message || 'Error al actualizar grupo'
      };
    }
  };

  // ❌ Eliminar grupo (solo admin)
  const deleteGroup = async (groupId: number) => {
    try {
      await apiClient.delete(`/groups/${groupId}`);
      // Actualizar lista local
      setGroups((prev) => prev.filter((g) => g.id !== groupId));
      return { success: true };
    } catch (err: any) {
      console.error('Error eliminando grupo:', err);
      return {
        success: false,
        error: err.response?.data?.message || 'Error al eliminar grupo'
      };
    }
  };

  // 👥 Obtener miembros de un grupo
  const getGroupMembers = async (groupId: number): Promise<GroupMember[]> => {
    try {
      const response = await apiClient.get(`/groups/${groupId}/members`);
      return response.data.data;
    } catch (err: any) {
      console.error('Error obteniendo miembros:', err);
      return [];
    }
  };

  // ➕ Agregar miembro al grupo (solo admin)
  const addMember = async (groupId: number, userIdToAdd: number) => {
    try {
      await apiClient.post(`/groups/${groupId}/members`, { userIdToAdd });
      // Actualizar lista de grupos
      await loadGroups();
      return { success: true };
    } catch (err: any) {
      console.error('Error agregando miembro:', err);
      return {
        success: false,
        error: err.response?.data?.message || 'Error al agregar miembro'
      };
    }
  };

  // 🚫 Remover miembro del grupo (solo admin)
  const removeMember = async (groupId: number, userIdToRemove: number) => {
    try {
      await apiClient.delete(`/groups/${groupId}/members/${userIdToRemove}`);
      // Actualizar lista de grupos
      await loadGroups();
      return { success: true };
    } catch (err: any) {
      console.error('Error removiendo miembro:', err);
      return {
        success: false,
        error: err.response?.data?.message || 'Error al remover miembro'
      };
    }
  };

  // 🔍 Buscar grupos por nombre
  const searchGroups = (query: string): GroupWithMembers[] => {
    if (!query.trim()) return groups;

    const lowerQuery = query.toLowerCase();
    return groups.filter((group) =>
      group.name.toLowerCase().includes(lowerQuery) ||
      group.description?.toLowerCase().includes(lowerQuery)
    );
  };

  // 📊 Obtener mensajes no leídos de un grupo
  const getUnreadCount = async (groupId: number): Promise<number> => {
    try {
      const response = await apiClient.get(`/groups/${groupId}/unread-count`);
      return response.data.count;
    } catch (err: any) {
      console.error('Error obteniendo mensajes no leídos:', err);
      return 0;
    }
  };

  // Cargar al montar
  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  return {
    groups,
    isLoading,
    error,
    refreshGroups,
    silentRefreshGroups,
    createGroup,
    updateGroup,
    deleteGroup,
    getGroupMembers,
    addMember,
    removeMember,
    searchGroups,
    getUnreadCount
  };
};