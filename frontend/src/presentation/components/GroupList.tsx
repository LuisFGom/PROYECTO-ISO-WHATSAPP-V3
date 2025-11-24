// frontend/src/presentation/components/GroupList.tsx
import { useState, useEffect } from 'react';
import { socketService } from '../../infrastructure/socket/socketService';
import { useAuthStore } from '../store/authStore';
import type { GroupWithMembers } from '../hooks/useGroups';

interface GroupListProps {
  groups: GroupWithMembers[];
  onGroupClick: (group: GroupWithMembers) => void;
  selectedGroupId: number | null;
}

interface LastMessage {
  groupId: number;
  content: string;
  senderUsername: string;
  senderId: number;
  timestamp: Date;
}

export const GroupList = ({ groups, onGroupClick, selectedGroupId }: GroupListProps) => {
  const { user } = useAuthStore();
  const [lastMessages, setLastMessages] = useState<Map<number, LastMessage>>(new Map());

  useEffect(() => {
    // Cargar último mensaje de cada grupo
    const loadLastMessages = async () => {
      for (const group of groups) {
        try {
          const history = await socketService.loadGroupHistory(group.id, 1, 0);
          if (history.length > 0) {
            const lastMsg = history[history.length - 1];
            setLastMessages(prev => new Map(prev).set(group.id, {
              groupId: group.id,
              content: lastMsg.content,
              senderUsername: lastMsg.senderUsername,
              senderId: lastMsg.senderId,
              timestamp: new Date(lastMsg.timestamp)
            }));
          }
        } catch (error) {
          console.error(`Error cargando último mensaje del grupo ${group.id}:`, error);
        }
      }
    };

    if (groups.length > 0) {
      loadLastMessages();
    }
  }, [groups]);

  // Listener para nuevos mensajes
  useEffect(() => {
    const handleNewMessage = (message: any) => {
      setLastMessages(prev => new Map(prev).set(message.groupId, {
        groupId: message.groupId,
        content: message.content,
        senderUsername: message.senderUsername,
        senderId: message.senderId,
        timestamp: new Date(message.timestamp)
      }));
    };

    socketService.onGroupNewMessage(handleNewMessage);

    return () => {
      const socket = socketService.getSocket();
      if (socket) {
        socket.off('group:new-message', handleNewMessage);
      }
    };
  }, []);

  const formatLastMessageTime = (timestamp: Date) => {
    const now = new Date();
    const messageDate = new Date(timestamp);
    const diffInMs = now.getTime() - messageDate.getTime();
    const diffInHours = diffInMs / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return messageDate.toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit'
      });
    } else if (diffInHours < 48) {
      return 'Ayer';
    } else if (diffInHours < 168) {
      return messageDate.toLocaleDateString('es-ES', { weekday: 'short' });
    } else {
      return messageDate.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit'
      });
    }
  };

  const renderLastMessage = (group: GroupWithMembers) => {
    const lastMsg = lastMessages.get(group.id);
    
    if (!lastMsg) {
      return (
        <p className="text-sm text-gray-500">
          {group.memberCount} {group.memberCount === 1 ? 'miembro' : 'miembros'}
        </p>
      );
    }

    const isOwnMessage = user?.id === lastMsg.senderId;
    const messagePreview = lastMsg.content.length > 30 
      ? `${lastMsg.content.substring(0, 30)}...` 
      : lastMsg.content;

    return (
      <p className="text-sm text-gray-600 truncate">
        {isOwnMessage ? (
          <span className="text-gray-700">Tú: </span>
        ) : (
          <span className="text-gray-700">{lastMsg.senderUsername}: </span>
        )}
        {messagePreview}
      </p>
    );
  };

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <div className="text-6xl mb-4">👥</div>
        <p className="text-gray-600 mb-2">No tienes grupos</p>
        <p className="text-sm text-gray-500">Crea un grupo para chatear con varios contactos</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {groups.map((group) => {
        const lastMsg = lastMessages.get(group.id);
        
        return (
          <div
            key={group.id}
            onClick={() => onGroupClick(group)}
            className={`p-3 flex items-center gap-3 cursor-pointer hover:bg-gray-100 transition ${
              selectedGroupId === group.id ? 'bg-gray-200' : ''
            }`}
          >
            {/* Avatar del grupo */}
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-whatsapp-green rounded-full flex items-center justify-center">
                {group.avatarUrl ? (
                  <img src={group.avatarUrl} alt={group.name} className="w-full h-full rounded-full object-cover" />
                ) : (
                  <span className="text-white font-bold text-lg">
                    {group.name[0].toUpperCase()}
                  </span>
                )}
              </div>
            </div>

            {/* Info del grupo */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-gray-800 truncate">
                    {group.name}
                  </p>
                  {group.isAdmin && (
                    <span className="text-yellow-500 text-xs" title="Eres administrador">
                      👑
                    </span>
                  )}
                </div>
                
                {/* Hora del último mensaje */}
                {lastMsg && (
                  <span className="text-xs text-gray-500 ml-2">
                    {formatLastMessageTime(lastMsg.timestamp)}
                  </span>
                )}
              </div>
              
              {/* Último mensaje o miembros */}
              {renderLastMessage(group)}
            </div>
          </div>
        );
      })}
    </div>
  );
};