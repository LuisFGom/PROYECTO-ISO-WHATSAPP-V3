// frontend/src/presentation/components/ChatWindow.tsx
import React, { useState, useEffect, useRef } from 'react';
import { socketService, type EncryptedMessage } from '../../infrastructure/socket/socketService';
import { useAuthStore } from '../store/authStore';

interface ChatWindowProps {
  contactId: number;
  contactName: string;
  contactAvatar?: string;
  contactStatus?: 'online' | 'offline'; // 🔥 NUEVO: Estado del contacto
  contactLastSeen?: Date | null; // 🔥 NUEVO: Última vez visto
  onBack?: () => void;
  onMessageSent?: (isNewConversation: boolean) => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  contactId,
  contactName,
  contactAvatar,
  contactStatus = 'offline', // 🔥 NUEVO: Default offline
  contactLastSeen, // 🔥 NUEVO
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

  useEffect(() => {
    loadChatHistory();
    
    const handleNewMessage = (message: EncryptedMessage) => {
      if (processedMessageIds.current.has(message.id)) {
        console.log(`⚠️ Mensaje ${message.id} ya procesado, ignorando duplicado`);
        return;
      }

      if (
        (message.sender_id === contactId && message.receiver_id === user?.id) ||
        (message.sender_id === user?.id && message.receiver_id === contactId)
      ) {
        console.log(`✅ Nuevo mensaje recibido: ${message.id}`);
        processedMessageIds.current.add(message.id);
        setMessages(prev => [...prev, message]);
        
        if (message.sender_id === contactId) {
          void socketService.markChatMessagesAsRead(contactId);
        }
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
    socketService.onChatMessagesRead(handleMessagesRead);
    socketService.onTypingStart(handleTypingStart);
    socketService.onTypingStop(handleTypingStop);

    return () => {
      const socket = socketService.getSocket();
      if (socket) {
        socket.off('chat:new-message', handleNewMessage);
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

  // 🔥 CORRECCIÓN: Scroll solo para nuevos mensajes (smooth)
  useEffect(() => {
    if (!isLoading && messages.length > 0) {
      scrollToBottom('smooth');
    }
  }, [messages]);

  // 🔥 NUEVO: Función de scroll mejorada
  const scrollToBottom = (behavior: 'auto' | 'smooth' = 'auto') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
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
      // 🔥 CORRECCIÓN: Scroll inmediato al cargar historial
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

  const formatMessageTime = (timestamp: Date) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 🔥 NUEVO: Función para formatear última vez visto
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
      <div className="h-16 bg-gray-200 border-b border-gray-300 flex items-center px-4">
        {onBack && (
          <button
            onClick={onBack}
            className="md:hidden mr-3 p-2 hover:bg-gray-300 rounded-full transition"
          >
            <svg
              className="w-6 h-6 text-gray-700"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
        )}
        <div className="flex items-center gap-3">
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
      </div>

      <div className="flex-1 bg-[#e5ddd5] p-4 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-500">
              <svg
                className="animate-spin h-8 w-8 mx-auto mb-2 text-gray-600"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8z"
                />
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

              return (
                <div
                  key={`${message.id}-${index}`}
                  className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs px-4 py-2 rounded-lg shadow ${
                      isOwnMessage
                        ? 'bg-[#dcf8c6]'
                        : 'bg-white'
                    }`}
                  >
                    <p className="text-sm text-gray-800 break-words">{message.content}</p>
                    <div className="flex items-center justify-end gap-1 mt-1">
                      <span className="text-xs text-gray-500">
                        {formatMessageTime(message.timestamp)}
                      </span>
                      {isOwnMessage && (
                        <span 
                          className={`text-xs ${message.is_read ? 'text-blue-600' : 'text-gray-500'}`}
                        >
                          {message.is_read ? '✓✓' : '✓'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

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
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="w-5 h-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
              />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
};