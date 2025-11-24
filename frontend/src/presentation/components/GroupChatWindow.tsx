// frontend/src/presentation/components/GroupChatWindow.tsx
import React, { useState, useEffect, useRef } from 'react';
import { socketService, type GroupMessage } from '../../infrastructure/socket/socketService';
import { useAuthStore } from '../store/authStore';
import type { GroupWithMembers, GroupMember } from '../hooks/useGroups';

interface GroupChatWindowProps {
  group: GroupWithMembers;
  onBack?: () => void;
  onMessageSent?: () => void;
  onOpenInfo: () => void;
}

export const GroupChatWindow: React.FC<GroupChatWindowProps> = ({
  group,
  onBack,
  onMessageSent,
  onOpenInfo
}) => {
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Set<number>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const processedMessageIds = useRef<Set<number>>(new Set());

  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [editingContent, setEditingContent] = useState('');

  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [menuPosition, setMenuPosition] = useState<'top' | 'bottom'>('bottom');
  const menuRef = useRef<HTMLDivElement>(null);

  // 🔥 Estados para búsqueda
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<number[]>([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
  const messageRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    loadGroupHistory();

    const handleNewMessage = (message: GroupMessage & { groupId: number }) => {
      if (message.groupId !== group.id) return;
      if (processedMessageIds.current.has(message.id)) return;

      processedMessageIds.current.add(message.id);
      setMessages(prev => [...prev, message]);
    };

    const handleMessageEdited = (editedMessage: GroupMessage) => {
      if (editedMessage.groupId !== group.id) return;
      setMessages(prev =>
        prev.map(msg => msg.id === editedMessage.id ? editedMessage : msg)
      );
    };

    const handleMessageDeleted = (data: { messageId: number; groupId: number }) => {
      if (data.groupId !== group.id) return;
      setMessages(prev =>
        prev.map(msg =>
          msg.id === data.messageId
            ? { ...msg, content: 'Este mensaje fue eliminado', isDeletedForAll: true }
            : msg
        )
      );
    };

    const handleTypingStart = (data: { groupId: number; userId: number }) => {
      if (data.groupId !== group.id || data.userId === user?.id) return;
      setTypingUsers(prev => new Set(prev).add(data.userId));
    };

    const handleTypingStop = (data: { groupId: number; userId: number }) => {
      if (data.groupId !== group.id) return;
      setTypingUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(data.userId);
        return newSet;
      });
    };

    socketService.onGroupNewMessage(handleNewMessage);
    socketService.onGroupMessageEdited(handleMessageEdited);
    socketService.onGroupMessageDeleted(handleMessageDeleted);
    socketService.onGroupTypingStart(handleTypingStart);
    socketService.onGroupTypingStop(handleTypingStop);

    return () => {
      const socket = socketService.getSocket();
      if (socket) {
        socket.off('group:new-message', handleNewMessage);
        socket.off('group:message-edited', handleMessageEdited);
        socket.off('group:message-deleted', handleMessageDeleted);
        socket.off('group:typing-start', handleTypingStart);
        socket.off('group:typing-stop', handleTypingStop);
      }

      socketService.stopGroupTyping(group.id);
      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
      }

      processedMessageIds.current.clear();
    };
  }, [group.id, user?.id]);

  useEffect(() => {
    if (!isLoading && messages.length > 0 && !isSearchOpen) {
      scrollToBottom('smooth');
    }
  }, [messages, isLoading, isSearchOpen]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setCurrentSearchIndex(0);
      return;
    }

    const query = searchQuery.toLowerCase();
    const results: number[] = [];

    messages.forEach((message) => {
      if (!message.isDeletedForAll && message.content.toLowerCase().includes(query)) {
        results.push(message.id);
      }
    });

    setSearchResults(results);
    setCurrentSearchIndex(results.length > 0 ? 0 : -1);

    if (results.length > 0) {
      scrollToMessage(results[0]);
    }
  }, [searchQuery, messages]);

  const scrollToBottom = (behavior: 'auto' | 'smooth' = 'auto') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  const scrollToMessage = (messageId: number) => {
    const element = messageRefs.current.get(messageId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handlePreviousResult = () => {
    if (searchResults.length === 0) return;
    const newIndex = currentSearchIndex > 0 ? currentSearchIndex - 1 : searchResults.length - 1;
    setCurrentSearchIndex(newIndex);
    scrollToMessage(searchResults[newIndex]);
  };

  const handleNextResult = () => {
    if (searchResults.length === 0) return;
    const newIndex = currentSearchIndex < searchResults.length - 1 ? currentSearchIndex + 1 : 0;
    setCurrentSearchIndex(newIndex);
    scrollToMessage(searchResults[newIndex]);
  };

  const handleCloseSearch = () => {
    setIsSearchOpen(false);
    setSearchQuery('');
    setSearchResults([]);
    setCurrentSearchIndex(0);
  };

  const loadGroupHistory = async () => {
    try {
      setIsLoading(true);
      const history = await socketService.loadGroupHistory(group.id);

      setMessages(history);

      processedMessageIds.current.clear();
      history.forEach(msg => processedMessageIds.current.add(msg.id));
    } catch (error) {
      console.error('Error al cargar historial del grupo:', error);
    } finally {
      setIsLoading(false);
      setTimeout(() => scrollToBottom('auto'), 100);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);

    if (e.target.value.length > 0) {
      socketService.startGroupTyping(group.id);

      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = window.setTimeout(() => {
        socketService.stopGroupTyping(group.id);
      }, 2000);
    } else {
      socketService.stopGroupTyping(group.id);
      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newMessage.trim() || isSending || !user) return;

    const messageText = newMessage.trim();
    setNewMessage('');
    setIsSending(true);
    socketService.stopGroupTyping(group.id);

    try {
      const sentMessage = await socketService.sendGroupMessage(group.id, messageText);

      processedMessageIds.current.add(sentMessage.id);
      setMessages(prev => [...prev, sentMessage]);

      if (onMessageSent) {
        onMessageSent();
      }
    } catch (error) {
      console.error('Error al enviar mensaje:', error);
      alert('Error al enviar mensaje');
    } finally {
      setIsSending(false);
    }
  };

  const handleOpenMenu = (messageId: number, messageIndex: number) => {
    const isLastMessage = messageIndex === messages.length - 1;
    setMenuPosition(isLastMessage ? 'top' : 'bottom');
    setOpenMenuId(openMenuId === messageId ? null : messageId);
  };

  const handleStartEdit = (message: GroupMessage) => {
    setEditingMessageId(message.id);
    setEditingContent(message.content);
    setOpenMenuId(null);
  };

  const handleSaveEdit = async () => {
    if (!editingContent.trim() || !editingMessageId) return;

    try {
      const updatedMessage = await socketService.editGroupMessage(editingMessageId, editingContent.trim());
      setMessages(prev =>
        prev.map(msg => msg.id === updatedMessage.id ? updatedMessage : msg)
      );
      setEditingMessageId(null);
      setEditingContent('');
    } catch (error) {
      console.error('Error al editar mensaje:', error);
      alert('Error al editar mensaje');
    }
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditingContent('');
  };

  const handleDeleteMessage = async (messageId: number) => {
    if (!confirm('¿Eliminar este mensaje para todos?')) return;

    try {
      await socketService.deleteGroupMessage(messageId);
      setMessages(prev =>
        prev.map(msg =>
          msg.id === messageId
            ? { ...msg, content: 'Este mensaje fue eliminado', isDeletedForAll: true }
            : msg
        )
      );
      setOpenMenuId(null);
    } catch (error) {
      console.error('Error al eliminar mensaje:', error);
      alert('Error al eliminar mensaje');
    }
  };

  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;

    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === query.toLowerCase() ? (
            <mark key={i} className="bg-yellow-300 font-semibold">{part}</mark>
          ) : (
            part
          )
        )}
      </>
    );
  };

  const formatMessageTime = (timestamp: Date) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTypingUsersText = () => {
    if (typingUsers.size === 0) return null;

    const typingMembers = Array.from(typingUsers)
      .map(userId => group.members.find(m => m.userId === userId))
      .filter(Boolean) as GroupMember[];

    if (typingMembers.length === 1) {
      return `${typingMembers[0].username} está escribiendo...`;
    } else if (typingMembers.length === 2) {
      return `${typingMembers[0].username} y ${typingMembers[1].username} están escribiendo...`;
    } else {
      return `${typingMembers.length} personas están escribiendo...`;
    }
  };

  // 🔥 NUEVO: Renderizar checks de estado
  const renderMessageChecks = (message: GroupMessage) => {
    // Solo para mensajes propios
    if (message.senderId !== user?.id) return null;

    return (
      <span className="ml-1 text-gray-500">
        {/* Siempre mostrar doble check para mensajes de grupo enviados */}
        <svg className="w-4 h-4 inline" fill="currentColor" viewBox="0 0 20 20">
          <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
          <path d="M13.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-1-1a1 1 0 011.414-1.414l.293.293 7.293-7.293a1 1 0 011.414 0z" />
        </svg>
      </span>
    );
  };

  if (!user) return null;

  return (
    <div className="flex flex-col h-full bg-gray-100">
      {/* HEADER */}
      <div className="h-16 bg-gray-200 border-b border-gray-300 flex items-center px-4">
        {onBack && (
          <button
            onClick={onBack}
            className="md:hidden mr-3 p-2 hover:bg-gray-300 rounded-full transition"
          >
            <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}

        {!isSearchOpen ? (
          <>
            <div
              onClick={onOpenInfo}
              className="flex items-center gap-3 flex-1 cursor-pointer hover:bg-gray-300 rounded-lg p-2 transition"
            >
              <div className="w-10 h-10 bg-whatsapp-green rounded-full flex items-center justify-center">
                {group.avatarUrl ? (
                  <img src={group.avatarUrl} alt={group.name} className="w-full h-full rounded-full object-cover" />
                ) : (
                  <span className="text-white font-bold">{group.name[0].toUpperCase()}</span>
                )}
              </div>
              <div>
                <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                  {group.name}
                  {group.isAdmin && <span className="text-yellow-500 text-sm">👑</span>}
                </h2>
                {typingUsers.size > 0 ? (
                  <p className="text-xs text-whatsapp-green italic">{getTypingUsersText()}</p>
                ) : (
                  <p className="text-xs text-gray-500">{group.memberCount} miembros</p>
                )}
              </div>
            </div>

            <button
              onClick={() => setIsSearchOpen(true)}
              className="p-2 hover:bg-gray-300 rounded-full transition"
              title="Buscar mensajes"
            >
              <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar mensajes..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-whatsapp-green"
                autoFocus
              />

              {searchResults.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600 whitespace-nowrap">
                    {currentSearchIndex + 1} de {searchResults.length}
                  </span>
                  <button onClick={handlePreviousResult} className="p-1 hover:bg-gray-300 rounded transition">
                    <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  <button onClick={handleNextResult} className="p-1 hover:bg-gray-300 rounded transition">
                    <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
              )}

              <button onClick={handleCloseSearch} className="p-2 hover:bg-gray-300 rounded-full transition">
                <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </>
        )}
      </div>

      {/* MENSAJES */}
      <div className="flex-1 bg-[#e5ddd5] p-4 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-500">
              <svg className="animate-spin h-8 w-8 mx-auto mb-2 text-gray-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              <p>Cargando mensajes...</p>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-center">
            <div className="text-gray-500">
              <div className="text-6xl mb-4">👥</div>
              <p>No hay mensajes. ¡Envía el primero! 👋</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {messages.map((message, index) => {
              const isOwnMessage = message.senderId === user.id;
              const isEditing = editingMessageId === message.id;
              const isHighlighted = searchResults.includes(message.id);
              const isCurrentResult = searchResults[currentSearchIndex] === message.id;

              return (
                <div
                  key={`${message.id}-${index}`}
                  ref={(el) => {
                    if (el) messageRefs.current.set(message.id, el);
                  }}
                  className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} group relative`}
                >
                  <div
                    className={`max-w-xs px-4 py-2 rounded-lg shadow transition-all ${
                      isOwnMessage ? 'bg-[#dcf8c6]' : 'bg-white'
                    } ${message.isDeletedForAll ? 'italic text-gray-500' : ''} ${
                      isCurrentResult ? 'ring-2 ring-yellow-400' : isHighlighted ? 'ring-1 ring-yellow-300' : ''
                    }`}
                  >
                    {!isOwnMessage && !message.isDeletedForAll && (
                      <p className="text-xs font-semibold text-whatsapp-green mb-1">
                        {message.senderUsername}
                      </p>
                    )}

                    {isEditing ? (
                      <div className="flex flex-col gap-2">
                        <input
                          type="text"
                          value={editingContent}
                          onChange={(e) => setEditingContent(e.target.value)}
                          className="px-2 py-1 border rounded text-sm"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEdit();
                            if (e.key === 'Escape') handleCancelEdit();
                          }}
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={handleSaveEdit}
                            className="px-3 py-1 bg-whatsapp-green text-white text-xs rounded hover:bg-whatsapp-green-dark"
                          >
                            ✓ Guardar
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="px-3 py-1 bg-gray-300 text-gray-700 text-xs rounded hover:bg-gray-400"
                          >
                            ✕ Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm text-gray-800 break-words">
                          {isSearchOpen && searchQuery ? highlightText(message.content, searchQuery) : message.content}
                        </p>
                        <div className="flex items-center justify-end gap-1 mt-1">
                          <span className="text-xs text-gray-500">
                            {formatMessageTime(message.timestamp)}
                            {message.editedAt && ' (editado)'}
                          </span>
                          {/* 🔥 CHECKS DE ESTADO */}
                          {renderMessageChecks(message)}
                        </div>
                      </>
                    )}
                  </div>

                  {!message.isDeletedForAll && !isEditing && !isSearchOpen && isOwnMessage && (
                    <div className="relative ml-2 flex items-start">
                      <button
                        onClick={() => handleOpenMenu(message.id, index)}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-300 rounded transition mt-1"
                      >
                        <svg className="w-4 h-4 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" />
                        </svg>
                      </button>

                      {openMenuId === message.id && (
                        <div
                          ref={menuRef}
                          className={`absolute ${isOwnMessage ? 'right-0' : 'left-0'} bg-white rounded-lg shadow-xl border border-gray-200 z-50 min-w-[180px] ${
                            menuPosition === 'top' ? 'bottom-8' : 'top-8'
                          }`}
                        >
                          <button
                            onClick={() => handleStartEdit(message)}
                            className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm flex items-center gap-2 rounded-t-lg"
                          >
                            ✏️ Editar
                          </button>
                          <button
                            onClick={() => handleDeleteMessage(message.id)}
                            className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm flex items-center gap-2 text-red-600 rounded-b-lg"
                          >
                            🗑️ Eliminar para todos
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* INPUT */}
      <div className="h-16 bg-gray-200 border-t border-gray-300 flex items-center px-4 gap-3">
        <form onSubmit={handleSendMessage} className="flex items-center gap-3 w-full">
          <input
            type="text"
            value={newMessage}
            onChange={handleInputChange}
            placeholder="Escribe un mensaje..."
            className="flex-1 px-4 py-2 rounded-full border border-gray-300 focus:outline-none focus:border-whatsapp-green"
            disabled={isSending}
          />
          <button
            type="submit"
            className="bg-whatsapp-green text-white p-3 rounded-full hover:bg-whatsapp-green-dark transition disabled:opacity-50"
            disabled={!newMessage.trim() || isSending}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
};