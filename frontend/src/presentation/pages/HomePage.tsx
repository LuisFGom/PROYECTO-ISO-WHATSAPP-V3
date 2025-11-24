// frontend/src/presentation/pages/HomePage.tsx
import { useState, useEffect, useRef } from 'react';
import { UserMenu } from '../components/UserMenu';
import { AddContactModal } from '../components/AddContactModal';
import { CreateGroupModal } from '../components/CreateGroupModal';
import { GroupInfoPanel } from '../components/GroupInfoPanel'; // 🔥 NUEVO
import { ContactList } from '../components/ContactList';
import { ChatList } from '../components/ChatList';
import { GroupList } from '../components/GroupList';
import { ChatWindow } from '../components/ChatWindow';
import { GroupChatWindow } from '../components/GroupChatWindow';
import { useSocketStatus } from '../hooks/useSocketStatus';
import { useContacts, type Contact } from '../hooks/useContacts';
import { useConversations, type Conversation } from '../hooks/useConversations';
import { useGroups, type GroupWithMembers } from '../hooks/useGroups';
import { socketService } from '../../infrastructure/socket/socketService';
import { useAuthStore } from '../store/authStore'; // 🔥 NUEVO (para user)

export const HomePage = () => {
  const { isConnected } = useSocketStatus();
  const { user } = useAuthStore(); // 🔥 NUEVO

  const {
    contacts = [],
    isLoading: isLoadingContacts = false,
    refreshContacts,
    deleteContact,
    updateNickname,
    searchContacts,
  } = useContacts() || {};

  const {
    conversations = [],
    isLoading: isLoadingConversations = false,
    refreshConversations,
    silentRefreshConversations,
    updateContactInConversations,
    removeContactFromConversations
  } = useConversations();

  // 🔥 NUEVO: Hook de grupos CON FUNCIONES ADICIONALES
  const {
    groups = [],
    isLoading: isLoadingGroups = false,
    refreshGroups,
    silentRefreshGroups,
    createGroup,
    updateGroup,  // 🔥 NUEVO
    deleteGroup,  // 🔥 NUEVO
    addMember,    // 🔥 NUEVO
    removeMember, // 🔥 NUEVO
    searchGroups
  } = useGroups();

  const conversationsRef = useRef({
    updateContactInConversations,
    removeContactFromConversations,
    silentRefreshConversations
  });

  useEffect(() => {
    conversationsRef.current = {
      updateContactInConversations,
      removeContactFromConversations,
      silentRefreshConversations
    };
  }, [updateContactInConversations, removeContactFromConversations, silentRefreshConversations]);

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [selectedContactId, setSelectedContactId] = useState<number | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<GroupWithMembers | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = useState(false);
  const [isGroupInfoOpen, setIsGroupInfoOpen] = useState(false); // 🔥 NUEVO
  const [view, setView] = useState<'chats' | 'groups' | 'contacts'>('chats');

  const [selectedContactStatus, setSelectedContactStatus] = useState<'online' | 'offline'>('offline');
  const [selectedContactLastSeen, setSelectedContactLastSeen] = useState<Date | null>(null);

  useEffect(() => {
    if (selectedContact) {
      setSelectedContactStatus(selectedContact.user.status);
      const conversation = conversations.find(c => c.contact.user_id === selectedContact.user.id);
      if (conversation?.contact.last_seen) {
        setSelectedContactLastSeen(new Date(conversation.contact.last_seen));
      }
    }
  }, [selectedContact, conversations]);

  useEffect(() => {
    const handleUserOnline = (data: { userId: number }) => {
      console.log(`🟢 Usuario ${data.userId} ahora está ONLINE`);

      if (selectedContactId === data.userId) {
        console.log(`🎯 Actualizando contacto seleccionado ${data.userId} a ONLINE`);
        setSelectedContactStatus('online');
        setSelectedContact(prev => prev ? ({
          ...prev,
          user: { ...prev.user, status: 'online' }
        }) : null);
      }

      silentRefreshConversations();
      refreshContacts();
    };

    const handleUserOffline = (data: { userId: number }) => {
      console.log(`⚪ Usuario ${data.userId} ahora está OFFLINE`);

      if (selectedContactId === data.userId) {
        console.log(`🎯 Actualizando contacto seleccionado ${data.userId} a OFFLINE`);
        setSelectedContactStatus('offline');
        setSelectedContactLastSeen(new Date());
        setSelectedContact(prev => prev ? ({
          ...prev,
          user: { ...prev.user, status: 'offline' }
        }) : null);
      }

      silentRefreshConversations();
      refreshContacts();
    };

    socketService.onUserOnline(handleUserOnline);
    socketService.onUserOffline(handleUserOffline);

    return () => {
      const socket = socketService.getSocket();
      if (socket) {
        socket.off('user:online', handleUserOnline);
        socket.off('user:offline', handleUserOffline);
      }
    };
  }, [silentRefreshConversations, refreshContacts, selectedContactId]);

  // Listener para nuevos mensajes (chats 1-a-1)
  useEffect(() => {
    const handleNewMessageForList = () => {
      console.log('📬 Nuevo mensaje detectado en HomePage, actualizando lista...');
      silentRefreshConversations();
    };

    socketService.onNewEncryptedMessage(handleNewMessageForList);

    return () => {
      const socket = socketService.getSocket();
      if (socket) {
        socket.off('chat:new-message', handleNewMessageForList);
      }
    };
  }, [silentRefreshConversations]);

  // Listener para mensajes editados
  useEffect(() => {
    const handleMessageEditedForList = () => {
      console.log('✏️ Mensaje editado detectado en HomePage, actualizando lista en segundo plano...');
      setTimeout(() => {
        silentRefreshConversations();
      }, 500);
    };

    socketService.onMessageEdited(handleMessageEditedForList);

    return () => {
      const socket = socketService.getSocket();
      if (socket) {
        socket.off('chat:message-edited', handleMessageEditedForList);
      }
    };
  }, [silentRefreshConversations]);

  // Listener para mensajes eliminados
  useEffect(() => {
    const handleMessageDeletedForList = () => {
      console.log('🗑️ Mensaje eliminado detectado en HomePage, actualizando lista en segundo plano...');
      setTimeout(() => {
        silentRefreshConversations();
      }, 500);
    };

    socketService.onChatMessageDeleted(handleMessageDeletedForList);

    return () => {
      const socket = socketService.getSocket();
      if (socket) {
        socket.off('chat:message-deleted', handleMessageDeletedForList);
      }
    };
  }, [silentRefreshConversations]);

  // Listeners para grupos
  useEffect(() => {
    const handleGroupNewMessage = () => {
      console.log('📬 Nuevo mensaje de grupo detectado en HomePage');
      silentRefreshGroups();
    };

    const handleGroupMessageEdited = () => {
      console.log('✏️ Mensaje de grupo editado');
      setTimeout(() => {
        silentRefreshGroups();
      }, 500);
    };

    const handleGroupMessageDeleted = () => {
      console.log('🗑️ Mensaje de grupo eliminado');
      setTimeout(() => {
        silentRefreshGroups();
      }, 500);
    };

    const handleGroupMemberAdded = () => {
      console.log('👤 Miembro agregado al grupo');
      refreshGroups();
    };

    const handleGroupMemberRemoved = () => {
      console.log('🚫 Miembro removido del grupo');
      refreshGroups();
    };

    socketService.onGroupNewMessage(handleGroupNewMessage);
    socketService.onGroupMessageEdited(handleGroupMessageEdited);
    socketService.onGroupMessageDeleted(handleGroupMessageDeleted);
    socketService.onGroupMemberAdded(handleGroupMemberAdded);
    socketService.onGroupMemberRemoved(handleGroupMemberRemoved);

    return () => {
      const socket = socketService.getSocket();
      if (socket) {
        socket.off('group:new-message', handleGroupNewMessage);
        socket.off('group:message-edited', handleGroupMessageEdited);
        socket.off('group:message-deleted', handleGroupMessageDeleted);
        socket.off('group:member-added', handleGroupMemberAdded);
        socket.off('group:member-removed', handleGroupMemberRemoved);
      }
    };
  }, [silentRefreshGroups, refreshGroups]);

  const filteredContacts = typeof searchContacts === 'function'
    ? searchContacts(searchQuery) ?? []
    : [];

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

  const filteredGroups = typeof searchGroups === 'function'
    ? searchGroups(searchQuery)
    : groups;

  const handleConversationClick = (conversation: Conversation) => {
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
    setSelectedContactId(conversation.contact.user_id);
    setSelectedGroup(null);

    setSelectedContactStatus(conversation.contact.is_online ? 'online' : 'offline');
    setSelectedContactLastSeen(
      conversation.contact.last_seen ? new Date(conversation.contact.last_seen) : null
    );

    if (window.innerWidth < 768) setIsSidebarOpen(false);

    if (conversation.unread_count > 0) {
      setTimeout(() => {
        silentRefreshConversations();
      }, 1000);
    }
  };

  const handleContactSelect = (contact: Contact) => {
    setSelectedContact(contact);
    setSelectedContactId(contact.user.id);
    setSelectedGroup(null);

    setSelectedContactStatus(contact.user.status);

    setView('chats');
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  };

  const handleGroupClick = (group: GroupWithMembers) => {
    setSelectedGroup(group);
    setSelectedContact(null);
    setSelectedContactId(null);

    if (window.innerWidth < 768) setIsSidebarOpen(false);
  };

  const handleBackToChats = () => {
    setSelectedContact(null);
    setSelectedContactId(null);
    setSelectedGroup(null);
    setSelectedContactStatus('offline');
    setSelectedContactLastSeen(null);
    setIsSidebarOpen(true);
  };

  const handleMessageSent = (isNewConversation: boolean) => {
    if (isNewConversation) {
      refreshConversations();
    } else {
      silentRefreshConversations();
    }
  };

  const handleGroupMessageSent = () => {
    silentRefreshGroups();
  };

  const handleCreateGroup = async (data: { name: string; description?: string; memberIds: number[] }) => {
    return await createGroup(data);
  };

  const handleContactUpdated = (contactUserId: number, nickname: string) => {
    if (conversationsRef.current.updateContactInConversations) {
      conversationsRef.current.updateContactInConversations(contactUserId, {
        nickname,
        has_contact: true
      });
    }
  };

  const handleContactDeleted = (contactUserId: number) => {
    if (conversationsRef.current.removeContactFromConversations) {
      conversationsRef.current.removeContactFromConversations(contactUserId);
    }
  };

  const handleEditContact = async (contactId: number, nickname: string) => {
    const result = await updateNickname(contactId, nickname);
    if (result.success) {
      const contact = contacts.find(c => c.id === contactId);
      if (contact) {
        handleContactUpdated(contact.user.id, nickname);
      }
      if (selectedContact?.id === contactId) {
        setSelectedContact(prev => prev ? ({
          ...prev,
          nickname
        }) : null);
      }
    } else {
      console.error(result.error);
    }
  };

  const handleDeleteContact = async (contactId: number) => {
    const result = await deleteContact(contactId);
    if (result.success) {
      const contact = contacts.find(c => c.id === contactId);
      if (contact) {
        handleContactDeleted(contact.user.id);
      }
      if (selectedContact?.id === contactId) {
        setSelectedContact(null);
        setSelectedContactId(null);
      }
    } else {
      console.error(result.error);
    }
  };

  const isLoading = view === 'chats' ? isLoadingConversations : view === 'groups' ? isLoadingGroups : isLoadingContacts;

  return (
    <>
      <div className="flex h-screen bg-gray-100 overflow-hidden">
        <div
          className={`
            ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            md:translate-x-0 fixed md:relative
            w-full md:w-1/3 lg:w-1/4
            h-full bg-white border-r border-gray-300
            transition-transform duration-300 ease-in-out z-20
          `}
        >
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

          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setView('chats')}
              className={`flex-1 py-3 text-sm font-medium transition ${view === 'chats'
                  ? 'text-whatsapp-green border-b-2 border-whatsapp-green'
                  : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              💬 Chats {conversations.length > 0 && `(${conversations.length})`}
            </button>
            <button
              onClick={() => setView('groups')}
              className={`flex-1 py-3 text-sm font-medium transition ${view === 'groups'
                  ? 'text-whatsapp-green border-b-2 border-whatsapp-green'
                  : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              👥 Grupos {groups.length > 0 && `(${groups.length})`}
            </button>
            <button
              onClick={() => setView('contacts')}
              className={`flex-1 py-3 text-sm font-medium transition ${view === 'contacts'
                  ? 'text-whatsapp-green border-b-2 border-whatsapp-green'
                  : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              📞 Contactos {contacts.length > 0 && `(${contacts.length})`}
            </button>
          </div>

          <div className="p-3 border-b border-gray-200">
            <input
              type="text"
              placeholder={
                view === 'chats' ? 'Buscar chat...' :
                  view === 'groups' ? 'Buscar grupo...' :
                    'Buscar contacto...'
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-whatsapp-green"
            />
          </div>

          <div className="overflow-y-auto h-[calc(100vh-168px)] p-2">
            {view === 'chats' ? (
              <ChatList
                conversations={filteredConversations}
                onConversationClick={handleConversationClick}
                selectedConversationId={selectedContactId}
              />
            ) : view === 'groups' ? (
              isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <svg className="animate-spin h-6 w-6 mr-2 text-gray-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  <span className="text-gray-600">Cargando grupos...</span>
                </div>
              ) : (
                <GroupList
                  groups={filteredGroups}
                  onGroupClick={handleGroupClick}
                  selectedGroupId={selectedGroup?.id ?? null}
                />
              )
            ) : isLoading ? (
              <div className="flex items-center justify-center py-8">
                <svg className="animate-spin h-6 w-6 mr-2 text-gray-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                <span className="text-gray-600">Cargando contactos...</span>
              </div>
            ) : (
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

          {view === 'contacts' && (
            <div className="absolute bottom-6 right-6">
              <button
                onClick={() => setIsAddModalOpen(true)}
                disabled={isLoading}
                className={`p-4 rounded-full shadow-lg transition ${isLoading
                    ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                    : 'bg-whatsapp-green text-white hover:bg-whatsapp-green-dark'
                  }`}
              >
                +
              </button>
            </div>
          )}

          {view === 'groups' && (
            <div className="absolute bottom-6 right-6">
              <button
                onClick={() => setIsCreateGroupModalOpen(true)}
                disabled={isLoading}
                className={`p-4 rounded-full shadow-lg transition ${isLoading
                    ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                    : 'bg-whatsapp-green text-white hover:bg-whatsapp-green-dark'
                  }`}
              >
                +
              </button>
            </div>
          )}
        </div>

        <div
          className={`
            ${!isSidebarOpen || selectedContact || selectedGroup ? 'flex' : 'hidden md:flex'}
            flex-1 flex-col w-full
          `}
        >
          {selectedContact ? (
            <ChatWindow
              contactId={selectedContact.user.id}
              contactName={selectedContact.nickname ?? selectedContact.user.username}
              contactAvatar={selectedContact.user.avatarUrl ?? undefined}
              contactStatus={selectedContactStatus}
              contactLastSeen={selectedContactLastSeen}
              onBack={handleBackToChats}
              onMessageSent={handleMessageSent}
            />
          ) : selectedGroup ? (
            <GroupChatWindow
              group={selectedGroup}
              onBack={handleBackToChats}
              onMessageSent={handleGroupMessageSent}
              onOpenInfo={() => setIsGroupInfoOpen(true)} // 🔥 CAMBIO AQUÍ
            />
          ) : (
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
                    <div className="text-6xl mb-4">
                      {view === 'groups' ? '👥' : '💬'}
                    </div>
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">
                      WhatsApp Web
                    </h3>
                    <p className="text-gray-500">
                      {view === 'chats'
                        ? 'Selecciona una conversación para comenzar'
                        : view === 'groups'
                          ? 'Selecciona un grupo para comenzar'
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

      <CreateGroupModal
        isOpen={isCreateGroupModalOpen}
        onClose={() => setIsCreateGroupModalOpen(false)}
        onGroupCreated={() => {
          refreshGroups();
        }}
        onCreate={handleCreateGroup}
        contacts={contacts}
        isLoadingContacts={isLoadingContacts}
      />

      {/* 🔥 NUEVO: Panel de información del grupo */}
      {selectedGroup && (
        <GroupInfoPanel
          isOpen={isGroupInfoOpen}
          onClose={() => setIsGroupInfoOpen(false)}
          group={selectedGroup}
          contacts={contacts}
          onUpdateGroup={async (groupId, data) => {
            const result = await updateGroup(groupId, data);
            if (result.success) {
              refreshGroups();
            }
            return result;
          }}
          onAddMember={async (groupId, userId) => {
            const result = await addMember(groupId, userId);
            if (result.success) {
              refreshGroups();
            }
            return result;
          }}
          onRemoveMember={async (groupId, userId) => {
            const result = await removeMember(groupId, userId);
            if (result.success) {
              refreshGroups();
            }
            return result;
          }}
          onLeaveGroup={async (groupId) => {
            const result = await removeMember(groupId, user!.id);
            if (result.success) {
              setSelectedGroup(null);
              refreshGroups();
            }
            return result;
          }}
          onDeleteGroup={async (groupId) => {
            const result = await deleteGroup(groupId);
            if (result.success) {
              setSelectedGroup(null);
              refreshGroups();
            }
            return result;
          }}
        />
      )}
    </>
  );
};