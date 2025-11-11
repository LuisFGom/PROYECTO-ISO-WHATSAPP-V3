// frontend/src/presentation/pages/HomePage.tsx
import { useState } from 'react';
import { UserMenu } from '../components/UserMenu';
import { AddContactModal } from '../components/AddContactModal';
import { ContactList } from '../components/ContactList';
import { ChatWindow } from '../components/ChatWindow'; // 🔥 NUEVO IMPORT
import { useSocketStatus } from '../hooks/useSocketStatus';
import { useContacts, type Contact } from '../hooks/useContacts';

export const HomePage = () => {
  const { isConnected } = useSocketStatus();

  // 🔧 Aseguramos valores por defecto para evitar undefined
  const {
    contacts = [],
    isLoading = false,
    refreshContacts,
    deleteContact,
    updateNickname,
    searchContacts,
  } = useContacts() || {};

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  
  // 🔥 NUEVO: Estado para controlar la vista
  const [view, setView] = useState<'chats' | 'contacts'>('chats');

  // 🔧 Verificamos que searchContacts sea una función antes de usarla
  const filteredContacts = typeof searchContacts === 'function'
    ? searchContacts(searchQuery) ?? []
    : [];

  const handleContactSelect = (contact: Contact) => {
    setSelectedContact(contact);
    setView('chats'); // Cambiar a vista de chats al seleccionar
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  };

  const handleBackToChats = () => {
    setSelectedContact(null);
    setIsSidebarOpen(true);
  };

  const handleEditContact = async (contactId: number, nickname: string) => {
    const result = await updateNickname(contactId, nickname);
    if (!result.success) alert(result.error);
  };

  const handleDeleteContact = async (contactId: number) => {
    const result = await deleteContact(contactId);
    if (!result.success) alert(result.error);
    if (selectedContact?.id === contactId) setSelectedContact(null);
  };

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

          {/* 🔥 NUEVO: Tabs de navegación */}
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setView('chats')}
              className={`flex-1 py-3 text-sm font-medium transition ${
                view === 'chats'
                  ? 'text-whatsapp-green border-b-2 border-whatsapp-green'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              💬 Chats
            </button>
            <button
              onClick={() => setView('contacts')}
              className={`flex-1 py-3 text-sm font-medium transition ${
                view === 'contacts'
                  ? 'text-whatsapp-green border-b-2 border-whatsapp-green'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              👥 Contactos
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

          {/* Lista de contactos / Loading */}
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
                <span className="text-gray-600">Cargando contactos...</span>
              </div>
            ) : view === 'chats' ? (
              // 🔥 NUEVO: Vista de chats (usa la misma lista de contactos)
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
            ) : (
              // Vista de contactos (tu lógica original)
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

        {/* 🔥 Área de chat - ACTUALIZADO */}
        <div
          className={`
            ${!isSidebarOpen || selectedContact ? 'flex' : 'hidden md:flex'}
            flex-1 flex-col w-full
          `}
        >
          {selectedContact ? (
            // 🔥 NUEVO: Mostrar ChatWindow cuando hay contacto seleccionado
            <ChatWindow
              contactId={selectedContact.user.id}
              contactName={selectedContact.nickname ?? selectedContact.user.username}
              contactAvatar={selectedContact.user.avatarUrl ?? undefined}
              onBack={handleBackToChats}
            />
          ) : (
            // Pantalla de bienvenida (tu diseño original)
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
                      Selecciona un chat para comenzar
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
        onContactAdded={refreshContacts}
      />
    </>
  );
};