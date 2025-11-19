// frontend/src/presentation/components/ChatWindow.tsx
import React, { useState, useEffect, useRef } from 'react';
import { socketService, type EncryptedMessage } from '../../infrastructure/socket/socketService';
import { useAuthStore } from '../store/authStore';

interface ChatWindowProps {
  contactId: number;
  contactName: string;
  contactAvatar?: string;
  contactStatus?: 'online' | 'offline';
  contactLastSeen?: Date | null;
  onBack?: () => void;
  onMessageSent?: (isNewConversation: boolean) => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  contactId,
  contactName,
  contactAvatar,
  contactStatus = 'offline',
  contactLastSeen,
  onBack,
  onMessageSent
}) => {
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<EncryptedMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const [hasExistingMessages, setHasExistingMessages] = useState(false);
  const processedMessageIds = useRef<Set<number>>(new Set());

  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [editingContent, setEditingContent] = useState('');

  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [menuPosition, setMenuPosition] = useState<'top' | 'bottom'>('bottom');
  const menuRef = useRef<HTMLDivElement>(null);

  // 🔥 NUEVO: Estados para búsqueda
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
    loadChatHistory();
    
    const handleNewMessage = (message: EncryptedMessage) => {
      if (processedMessageIds.current.has(message.id)) {
        return;
      }

      if (
        (message.sender_id === contactId && message.receiver_id === user?.id) ||
        (message.sender_id === user?.id && message.receiver_id === contactId)
      ) {
        processedMessageIds.current.add(message.id);
        setMessages(prev => [...prev, message]);
        
        if (message.sender_id === contactId) {
          void socketService.markChatMessagesAsRead(contactId);
        }
      }
    };

    const handleMessageEdited = (editedMessage: EncryptedMessage) => {
      setMessages(prev => 
        prev.map(msg => msg.id === editedMessage.id ? editedMessage : msg)
      );
    };

    const handleMessageDeleted = (data: { messageId: number; deleteForAll: boolean }) => {
      if (data.deleteForAll) {
        setMessages(prev =>
          prev.map(msg =>
            msg.id === data.messageId
              ? { ...msg, content: 'Este mensaje fue eliminado', is_deleted_for_all: true }
              : msg
          )
        );
      } else {
        setMessages(prev => prev.filter(msg => msg.id !== data.messageId));
        processedMessageIds.current.delete(data.messageId);
      }
    };

    const handleMessagesRead = (data: { readBy: number }) => {
      if (data.readBy === contactId) {
        setMessages(prev =>
          prev.map(msg =>
            msg.sender_id === user?.id && msg.receiver_id === contactId
              ? { ...msg, is_read: true }
              : msg
          )
        );
      }
    };

    const handleTypingStart = (data: { from: number }) => {
      if (data.from === contactId) {
        setIsTyping(true);
      }
    };

    const handleTypingStop = (data: { from: number }) => {
      if (data.from === contactId) {
        setIsTyping(false);
      }
    };

    socketService.onNewEncryptedMessage(handleNewMessage);
    socketService.onMessageEdited(handleMessageEdited);
    socketService.onChatMessageDeleted(handleMessageDeleted);
    socketService.onChatMessagesRead(handleMessagesRead);
    socketService.onTypingStart(handleTypingStart);
    socketService.onTypingStop(handleTypingStop);

    return () => {
      const socket = socketService.getSocket();
      if (socket) {
        socket.off('chat:new-message', handleNewMessage);
        socket.off('chat:message-edited', handleMessageEdited);
        socket.off('chat:message-deleted', handleMessageDeleted);
        socket.off('chat:messages-read', handleMessagesRead);
        socket.off('typing:start', handleTypingStart);
        socket.off('typing:stop', handleTypingStop);
      }
      
      socketService.stopTyping(contactId);
      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
      }
      
      processedMessageIds.current.clear();
    };
  }, [contactId, user?.id]);

  useEffect(() => {
    if (!isLoading && messages.length > 0 && !isSearchOpen) {
      scrollToBottom('smooth');
    }
  }, [messages, isSearchOpen]);

  // 🔥 NUEVO: Buscar mensajes cuando cambia el query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setCurrentSearchIndex(0);
      return;
    }

    const query = searchQuery.toLowerCase();
    const results: number[] = [];

    messages.forEach((message) => {
      if (!message.is_deleted_for_all && message.content.toLowerCase().includes(query)) {
        results.push(message.id);
      }
    });

    setSearchResults(results);
    setCurrentSearchIndex(results.length > 0 ? 0 : -1);

    // Scroll al primer resultado
    if (results.length > 0) {
      scrollToMessage(results[0]);
    }
  }, [searchQuery, messages]);

  const scrollToBottom = (behavior: 'auto' | 'smooth' = 'auto') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  // 🔥 NUEVO: Scroll a un mensaje específico
  const scrollToMessage = (messageId: number) => {
    const element = messageRefs.current.get(messageId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // 🔥 NUEVO: Navegar al resultado anterior
  const handlePreviousResult = () => {
    if (searchResults.length === 0) return;
    const newIndex = currentSearchIndex > 0 ? currentSearchIndex - 1 : searchResults.length - 1;
    setCurrentSearchIndex(newIndex);
    scrollToMessage(searchResults[newIndex]);
  };

  // 🔥 NUEVO: Navegar al siguiente resultado
  const handleNextResult = () => {
    if (searchResults.length === 0) return;
    const newIndex = currentSearchIndex < searchResults.length - 1 ? currentSearchIndex + 1 : 0;
    setCurrentSearchIndex(newIndex);
    scrollToMessage(searchResults[newIndex]);
  };

  // 🔥 NUEVO: Cerrar búsqueda
  const handleCloseSearch = () => {
    setIsSearchOpen(false);
    setSearchQuery('');
    setSearchResults([]);
    setCurrentSearchIndex(0);
  };

  const loadChatHistory = async () => {
    try {
      setIsLoading(true);
      const history = await socketService.loadChatHistory(contactId);
      
      setMessages(history);
      setHasExistingMessages(history.length > 0);
      
      processedMessageIds.current.clear();
      history.forEach(msg => processedMessageIds.current.add(msg.id));
      
      await socketService.markChatMessagesAsRead(contactId);
    } catch (error) {
      console.error('Error al cargar historial:', error);
    } finally {
      setIsLoading(false);
      setTimeout(() => scrollToBottom('auto'), 100);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);

    if (e.target.value.length > 0) {
      socketService.startTyping(contactId);

      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = window.setTimeout(() => {
        socketService.stopTyping(contactId);
      }, 2000);
    } else {
      socketService.stopTyping(contactId);
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
    socketService.stopTyping(contactId);

    try {
      const sentMessage = await socketService.sendEncryptedMessage(contactId, messageText);
      
      processedMessageIds.current.add(sentMessage.id);
      setMessages(prev => [...prev, sentMessage]);
      
      if (onMessageSent) {
        const isNewConversation = !hasExistingMessages && messages.length === 0;
        onMessageSent(isNewConversation);
        
        if (isNewConversation) {
          setHasExistingMessages(true);
        }
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

  const handleStartEdit = (message: EncryptedMessage) => {
    setEditingMessageId(message.id);
    setEditingContent(message.content);
    setOpenMenuId(null);
  };

  const handleSaveEdit = async () => {
    if (!editingContent.trim() || !editingMessageId) return;

    try {
      const updatedMessage = await socketService.editMessage(editingMessageId, editingContent.trim());
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

  const handleDeleteForMe = async (messageId: number) => {
    try {
      await socketService.deleteChatMessage(messageId, false);
      setMessages(prev => prev.filter(msg => msg.id !== messageId));
      processedMessageIds.current.delete(messageId);
      setOpenMenuId(null);
    } catch (error) {
      console.error('Error al eliminar mensaje:', error);
      alert('Error al eliminar mensaje');
    }
  };

  const handleDeleteForAll = async (messageId: number) => {
    if (!confirm('¿Eliminar este mensaje para todos?')) return;

    try {
      await socketService.deleteChatMessage(messageId, true);
      setMessages(prev =>
        prev.map(msg =>
          msg.id === messageId
            ? { ...msg, content: 'Este mensaje fue eliminado', is_deleted_for_all: true }
            : msg
        )
      );
      setOpenMenuId(null);
    } catch (error) {
      console.error('Error al eliminar mensaje:', error);
      alert('Error al eliminar mensaje');
    }
  };

  // 🔥 NUEVO: Resaltar texto encontrado
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

  const formatLastSeen = (lastSeen: Date | null | undefined) => {
    if (!lastSeen) return 'Última vez hace mucho';
    
    const date = new Date(lastSeen);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Última vez hace un momento';
    if (minutes < 60) return `Última vez hace ${minutes} min`;
    if (hours < 24) return `Última vez hace ${hours}h`;
    if (days === 1) return 'Última vez ayer';
    return `Última vez ${date.toLocaleDateString('es-ES')}`;
  };

  if (!user) return null;

  return (
    <div className="flex flex-col h-full bg-gray-100">
      {/* 🔥 HEADER: Con búsqueda */}
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
            <div className="flex items-center gap-3 flex-1">
              <img 
                src={contactAvatar || '/default-avatar.png'} 
                alt={contactName}
                className="w-10 h-10 rounded-full bg-gray-400"
              />
              <div>
                <h2 className="font-semibold text-gray-800">{contactName}</h2>
                {isTyping ? (
                  <p className="text-xs text-whatsapp-green italic">escribiendo...</p>
                ) : contactStatus === 'online' ? (
                  <p className="text-xs text-whatsapp-green font-medium">Online</p>
                ) : contactLastSeen ? (
                  <p className="text-xs text-gray-500">{formatLastSeen(contactLastSeen)}</p>
                ) : (
                  <p className="text-xs text-gray-500">Offline</p>
                )}
              </div>
            </div>

            {/* 🔥 BOTÓN LUPA */}
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
            {/* 🔥 BARRA DE BÚSQUEDA */}
            <div className="flex items-center gap-2 flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar mensajes..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-whatsapp-green"
                autoFocus
              />

              {/* 🔥 CONTADOR Y NAVEGACIÓN */}
              {searchResults.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600 whitespace-nowrap">
                    {currentSearchIndex + 1} de {searchResults.length}
                  </span>
                  <button
                    onClick={handlePreviousResult}
                    className="p-1 hover:bg-gray-300 rounded transition"
                    title="Anterior"
                  >
                    <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  <button
                    onClick={handleNextResult}
                    className="p-1 hover:bg-gray-300 rounded transition"
                    title="Siguiente"
                  >
                    <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
              )}

              {/* 🔥 BOTÓN CERRAR */}
              <button
                onClick={handleCloseSearch}
                className="p-2 hover:bg-gray-300 rounded-full transition"
                title="Cerrar búsqueda"
              >
                <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </>
        )}
      </div>

      {/* 🔥 MENSAJES */}
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
              <div className="text-6xl mb-4">💬</div>
              <p>No hay mensajes. ¡Envía el primero! 👋</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {messages.map((message, index) => {
              const isOwnMessage = message.sender_id === user.id;
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
                    } ${message.is_deleted_for_all ? 'italic text-gray-500' : ''} ${
                      isCurrentResult ? 'ring-2 ring-yellow-400' : isHighlighted ? 'ring-1 ring-yellow-300' : ''
                    }`}
                  >
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
                            {message.edited_at && ' (editado)'}
                          </span>
                          {isOwnMessage && (
                            <span className={`text-xs ${message.is_read ? 'text-blue-600' : 'text-gray-500'}`}>
                              {message.is_read ? '✓✓' : '✓'}
                            </span>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  {!message.is_deleted_for_all && !isEditing && !isSearchOpen && (
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
                          style={{ boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)' }}
                        >
                          {isOwnMessage && (
                            <>
                              <button
                                onClick={() => handleStartEdit(message)}
                                className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm flex items-center gap-2 rounded-t-lg"
                              >
                                ✏️ Editar
                              </button>
                              <button
                                onClick={() => handleDeleteForAll(message.id)}
                                className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm flex items-center gap-2 text-red-600"
                              >
                                🗑️ Eliminar para todos
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => handleDeleteForMe(message.id)}
                            className={`w-full text-left px-4 py-2 hover:bg-gray-100 text-sm flex items-center gap-2 ${
                              isOwnMessage ? '' : 'rounded-t-lg'
                            } rounded-b-lg`}
                          >
                            🗑️ Eliminar para mí
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

      {/* 🔥 INPUT DE MENSAJE */}
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