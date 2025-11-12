// frontend/src/presentation/pages/HomePage.tsx
import { useState, useEffect, useRef } from 'react';
import { UserMenu } from '../components/UserMenu';
import { AddContactModal } from '../components/AddContactModal';
import { ContactList } from '../components/ContactList';
import { ChatList } from '../components/ChatList';
import { ChatWindow } from '../components/ChatWindow';
import { useSocketStatus } from '../hooks/useSocketStatus';
import { useContacts, type Contact } from '../hooks/useContacts';
import { useConversations, type Conversation } from '../hooks/useConversations';
import { socketService } from '../../infrastructure/socket/socketService';

export const HomePage = () => {
  const { isConnected } = useSocketStatus();

  // 🔧 Hooks de contactos y conversaciones
  const {
    contacts = [],
    isLoading: isLoadingContacts = false,
    refreshContacts,
    deleteContact,
    updateNickname,
    searchContacts,
  } = useContacts() || {};

  // 🔥 MODIFICADO: Incluir el nuevo método silentRefreshConversations
  const {
    conversations = [],
    isLoading: isLoadingConversations = false,
    refreshConversations,
    silentRefreshConversations, // 🔥 NUEVO: Actualización silenciosa
    updateContactInConversations,
    removeContactFromConversations
  } = useConversations();

  // 🔥 ACTUALIZADO: Ref para acceder a los métodos de conversaciones
  const conversationsRef = useRef({
    updateContactInConversations,
    removeContactFromConversations,
    silentRefreshConversations // 🔥 NUEVO
  });

  // Actualizar la ref cuando cambien los métodos
  useEffect(() => {
    conversationsRef.current = {
      updateContactInConversations,
      removeContactFromConversations,
      silentRefreshConversations
    };
  }, [updateContactInConversations, removeContactFromConversations, silentRefreshConversations]);

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  
  // 🔥 Estado para controlar la vista
  const [view, setView] = useState<'chats' | 'contacts'>('chats');

  // 🔥 CORRECCIÓN 1: Optimizar escucha de mensajes - solo recargar si es relevante
  useEffect(() => {
    const handleNewMessage = (message: any) => {
      // Solo recargar conversaciones si el mensaje es para el usuario actual
      // o si está relacionado con conversaciones visibles
      if (
        message.receiver_id === selectedContact?.user.id || 
        message.sender_id === selectedContact?.user.id
      ) {
        refreshConversations();
      }
    };

    socketService.onNewEncryptedMessage(handleNewMessage);

    return () => {
      // No remover el listener global completamente
      // Solo dejar de llamar refreshConversations
    };
  }, [refreshConversations, selectedContact]);

  // 🔧 Verificamos que searchContacts sea una función antes de usarla
  const filteredContacts = typeof searchContacts === 'function'
    ? searchContacts(searchQuery) ?? []
    : [];

  // 🔥 CORRECCIÓN 2: Mejorar búsqueda de conversaciones
  const filteredConversations = conversations.filter((conv: Conversation) => {
    if (!searchQuery.trim()) return true;
    
    const searchTerm = searchQuery.toLowerCase();
    const nickname = conv.contact.nickname?.toLowerCase() || '';
    const username = conv.contact.username?.toLowerCase() || '';
    const email = conv.contact.email?.toLowerCase() || '';
    
    return nickname.includes(searchTerm) || 
           username.includes(searchTerm) || 
           email.includes(searchTerm);
  });

  // 🔥 Handler para seleccionar conversación
  const handleConversationClick = (conversation: Conversation) => {
    // Convertir conversación a Contact para compatibilidad
    const contact: Contact = {
      id: conversation.contact.id,
      userId: conversation.contact.user_id,
      contactUserId: conversation.contact.user_id,
      nickname: conversation.contact.has_contact 
        ? conversation.contact.nickname 
        : conversation.contact.email,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      user: {
        id: conversation.contact.user_id,
        username: conversation.contact.username,
        email: conversation.contact.email,
        avatarUrl: conversation.contact.avatar_url,
        status: conversation.contact.is_online ? 'online' : 'offline',
      }
    };

    setSelectedContact(contact);
    if (window.innerWidth < 768) setIsSidebarOpen(false);
    
    // 🔥 CORRECCIÓN 3: Solo actualizar si hay mensajes no leídos
    if (conversation.unread_count > 0) {
      setTimeout(() => {
        refreshConversations();
      }, 1000);
    }
  };

  const handleContactSelect = (contact: Contact) => {
    setSelectedContact(contact);
    setView('chats');
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  };

  const handleBackToChats = () => {
    setSelectedContact(null);
    setIsSidebarOpen(true);
  };

  // 🔥 MODIFICADO: Handler para mensajes enviados - USAR ACTUALIZACIÓN SILENCIOSA
  const handleMessageSent = (isNewConversation: boolean) => {
    if (isNewConversation) {
      // Para conversaciones nuevas, recarga completa
      refreshConversations();
    } else {
      // 🔥 PARA CONVERSACIONES EXISTENTES: Actualización silenciosa
      silentRefreshConversations();
    }
  };

  // 🔥 NUEVO: Handler para actualizar contactos en conversaciones
  const handleContactUpdated = (contactUserId: number, nickname: string) => {
    // Actualizar localmente sin recargar
    if (conversationsRef.current.updateContactInConversations) {
      conversationsRef.current.updateContactInConversations(contactUserId, {
        nickname,
        has_contact: true
      });
    }
  };

  // 🔥 NUEVO: Handler para eliminar contacto de conversaciones
  const handleContactDeleted = (contactUserId: number) => {
    // Actualizar localmente sin recargar
    if (conversationsRef.current.removeContactFromConversations) {
      conversationsRef.current.removeContactFromConversations(contactUserId);
    }
  };

  // 🔥 MODIFICADO: Handler de edición de contacto
  const handleEditContact = async (contactId: number, nickname: string) => {
    const result = await updateNickname(contactId, nickname);
    if (result.success) {
      // 🔥 ACTUALIZAR LOCALMENTE en conversaciones también
      const contact = contacts.find(c => c.id === contactId);
      if (contact) {
        handleContactUpdated(contact.user.id, nickname);
      }
    } else {
      alert(result.error);
    }
  };

  // 🔥 MODIFICADO: Handler de eliminación de contacto
  const handleDeleteContact = async (contactId: number) => {
    const result = await deleteContact(contactId);
    if (result.success) {
      // 🔥 ACTUALIZAR LOCALMENTE en conversaciones también
      const contact = contacts.find(c => c.id === contactId);
      if (contact) {
        handleContactDeleted(contact.user.id);
      }
      if (selectedContact?.id === contactId) setSelectedContact(null);
    } else {
      alert(result.error);
    }
  };

  // 🔥 Determinar qué mostrar según la vista
  const isLoading = view === 'chats' ? isLoadingConversations : isLoadingContacts;

  return (
    <>
      <div className="flex h-screen bg-gray-100 overflow-hidden">
        {/* Sidebar */}
        <div
          className={`
            ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            md:translate-x-0 fixed md:relative
            w-full md:w-1/3 lg:w-1/4
            h-full bg-white border-r border-gray-300
            transition-transform duration-300 ease-in-out z-20
          `}
        >
          {/* Header */}
          <div className="h-16 bg-whatsapp-teal flex items-center justify-between px-4">
            <h1 className="text-white text-xl font-semibold">WhatsApp</h1>
            <div className="flex items-center gap-4">
              {isConnected ? (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  <span className="text-white text-xs">Online</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-red-400 rounded-full" />
                  <span className="text-white text-xs">Desconectado</span>
                </div>
              )}
              <UserMenu />
            </div>
          </div>

          {/* 🔥 Tabs de navegación */}
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setView('chats')}
              className={`flex-1 py-3 text-sm font-medium transition ${
                view === 'chats'
                  ? 'text-whatsapp-green border-b-2 border-whatsapp-green'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              💬 Chats {conversations.length > 0 && `(${conversations.length})`}
            </button>
            <button
              onClick={() => setView('contacts')}
              className={`flex-1 py-3 text-sm font-medium transition ${
                view === 'contacts'
                  ? 'text-whatsapp-green border-b-2 border-whatsapp-green'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              👥 Contactos {contacts.length > 0 && `(${contacts.length})`}
            </button>
          </div>

          {/* Buscador */}
          <div className="p-3 border-b border-gray-200">
            <input
              type="text"
              placeholder={view === 'chats' ? 'Buscar chat...' : 'Buscar contacto...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-whatsapp-green"
            />
          </div>

          {/* Lista de chats/contactos */}
          <div className="overflow-y-auto h-[calc(100vh-168px)] p-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <svg
                  className="animate-spin h-6 w-6 mr-2 text-gray-600"
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
                <span className="text-gray-600">
                  {view === 'chats' ? 'Cargando chats...' : 'Cargando contactos...'}
                </span>
              </div>
            ) : view === 'chats' ? (
              // 🔥 Vista de CHATS (usa ChatList)
              <ChatList
                conversations={filteredConversations}
                onConversationClick={handleConversationClick}
              />
            ) : (
              // 🔥 Vista de CONTACTOS (usa ContactList)
              <ContactList
                contacts={
                  Array.isArray(filteredContacts) && filteredContacts.length > 0
                    ? filteredContacts
                    : Array.isArray(contacts)
                    ? contacts
                    : []
                }
                onContactClick={handleContactSelect}
                onDeleteContact={handleDeleteContact}
                onEditContact={handleEditContact}
              />
            )}
          </div>

          {/* Botón agregar contacto - SOLO en vista de contactos */}
          {view === 'contacts' && (
            <div className="absolute bottom-6 right-6">
              <button
                onClick={() => setIsAddModalOpen(true)}
                disabled={isLoading}
                className={`p-4 rounded-full shadow-lg transition ${
                  isLoading
                    ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                    : 'bg-whatsapp-green text-white hover:bg-whatsapp-green-dark'
                }`}
              >
                +
              </button>
            </div>
          )}
        </div>

        {/* 🔥 Área de chat */}
        <div
          className={`
            ${!isSidebarOpen || selectedContact ? 'flex' : 'hidden md:flex'}
            flex-1 flex-col w-full
          `}
        >
          {selectedContact ? (
            <ChatWindow
              contactId={selectedContact.user.id}
              contactName={selectedContact.nickname ?? selectedContact.user.username}
              contactAvatar={selectedContact.user.avatarUrl ?? undefined}
              onBack={handleBackToChats}
              onMessageSent={handleMessageSent} // 🔥 CORRECCIÓN: Usar handler optimizado
            />
          ) : (
            // Pantalla de bienvenida
            <>
              <div className="h-16 bg-gray-200 border-b border-gray-300 flex items-center px-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-400 rounded-full" />
                  <div>
                    <h2 className="font-semibold text-gray-800">
                      Selecciona un chat
                    </h2>
                    <p className="text-xs text-gray-500">
                      {isConnected ? 'Conectado' : 'Esperando conexión...'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex-1 bg-[#e5ddd5] p-4 overflow-y-auto">
                <div className="flex items-center justify-center h-full text-center">
                  <div>
                    <div className="text-6xl mb-4">💬</div>
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">
                      WhatsApp Web
                    </h3>
                    <p className="text-gray-500">
                      {view === 'chats' 
                        ? 'Selecciona una conversación para comenzar'
                        : 'Selecciona un contacto para iniciar un chat'
                      }
                    </p>
                  </div>
                </div>
              </div>

              <div className="h-16 bg-gray-200 border-t border-gray-300 flex items-center px-4 gap-3">
                <input
                  type="text"
                  placeholder={
                    isConnected
                      ? 'Selecciona un chat para comenzar...'
                      : 'Esperando conexión...'
                  }
                  disabled
                  className="flex-1 px-4 py-2 rounded-full border border-gray-300 bg-gray-100 cursor-not-allowed"
                />
                <button
                  disabled
                  className="bg-gray-300 text-white p-3 rounded-full cursor-not-allowed"
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
              </div>
            </>
          )}
        </div>
      </div>

      <AddContactModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onContactAdded={() => {
          refreshContacts();
          refreshConversations();
        }}
      />
    </>
  );
};