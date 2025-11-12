// frontend/src/presentation/hooks/useConversations.ts
import { useState, useEffect } from 'react';
import { apiClient } from '../../infrastructure/api/apiClient';

export interface ConversationContact {
  id: number;
  user_id: number;
  username: string;
  email: string;
  avatar_url: string | null;
  nickname: string;
  is_online: boolean;
  has_contact: boolean;
  last_seen: string | null; // 🔥 AGREGADO: Campo que faltaba
}

export interface Conversation {
  conversation_id: number;
  contact: ConversationContact;
  last_message: {
    id: number | null;
    preview: string | null;
    timestamp: Date | null;
    is_own_message?: boolean;
  };
  unread_count: number;
}

export const useConversations = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConversations = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await apiClient.get('/conversations');
      
      if (response.data.success) {
        const conversationsData = response.data.conversations || [];
        
        const processedConversations = conversationsData.map((conv: Conversation) => ({
          ...conv,
          last_message: {
            ...conv.last_message,
            is_own_message: conv.last_message.preview?.startsWith('Tú: ') || false
          }
        }));
        
        setConversations(processedConversations);
      } else {
        setError('Error al cargar conversaciones');
      }
    } catch (err: any) {
      console.error('Error al obtener conversaciones:', err);
      setError(err.response?.data?.message || 'Error al cargar conversaciones');
      setConversations([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, []);

  const silentRefreshConversations = async () => {
    try {
      const response = await apiClient.get('/conversations');
      
      if (response.data.success) {
        const conversationsData = response.data.conversations || [];
        
        const processedConversations = conversationsData.map((conv: Conversation) => ({
          ...conv,
          last_message: {
            ...conv.last_message,
            is_own_message: conv.last_message.preview?.startsWith('Tú: ') || false
          }
        }));
        
        setConversations(processedConversations);
      }
    } catch (err: any) {
      console.error('Error al actualizar conversaciones:', err);
    }
  };

  const updateConversationLastMessage = (contactId: number, lastMessage: Conversation['last_message']) => {
    setConversations(prev => 
      prev.map(conv => 
        conv.contact.user_id === contactId 
          ? { 
              ...conv, 
              last_message: {
                ...lastMessage,
                is_own_message: lastMessage.preview?.startsWith('Tú: ') || false
              }
            } 
          : conv
      )
    );
  };

  const updateContactInConversations = (contactUserId: number, updates: Partial<ConversationContact>) => {
    setConversations(prev => 
      prev.map(conv => 
        conv.contact.user_id === contactUserId 
          ? { 
              ...conv, 
              contact: { ...conv.contact, ...updates } 
            } 
          : conv
      )
    );
  };

  const removeContactFromConversations = (contactUserId: number) => {
    setConversations(prev => 
      prev.map(conv => 
        conv.contact.user_id === contactUserId 
          ? { 
              ...conv, 
              contact: { 
                ...conv.contact, 
                has_contact: false,
                nickname: conv.contact.email
              } 
            } 
          : conv
      )
    );
  };

  const refreshConversations = () => {
    fetchConversations();
  };

  return {
    conversations,
    isLoading,
    error,
    refreshConversations,
    silentRefreshConversations,
    updateConversationLastMessage,
    updateContactInConversations,
    removeContactFromConversations
  };
};