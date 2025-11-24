// frontend/src/presentation/components/GroupInfoPanel.tsx
import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import type { GroupWithMembers } from '../hooks/useGroups'; // 🔥 QUITADO GroupMember
import type { Contact } from '../hooks/useContacts';

interface GroupInfoPanelProps {
  isOpen: boolean;
  onClose: () => void;
  group: GroupWithMembers;
  contacts: Contact[];
  onUpdateGroup: (groupId: number, data: { name?: string; description?: string }) => Promise<any>;
  onAddMember: (groupId: number, userId: number) => Promise<any>;
  onRemoveMember: (groupId: number, userId: number) => Promise<any>;
  onLeaveGroup: (groupId: number) => Promise<any>;
  onDeleteGroup: (groupId: number) => Promise<any>;
}

export const GroupInfoPanel = ({
  isOpen,
  onClose,
  group,
  contacts,
  onUpdateGroup,
  onAddMember,
  onRemoveMember,
  onLeaveGroup,
  onDeleteGroup
}: GroupInfoPanelProps) => {
  const { user } = useAuthStore();
  const [activeSection, setActiveSection] = useState<'info' | 'members' | 'add'>('info');
  
  // Estados para editar
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(group.name);
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [editedDesc, setEditedDesc] = useState(group.description || '');
  
  // Estados para agregar miembros
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContacts, setSelectedContacts] = useState<number[]>([]);

  useEffect(() => {
    setEditedName(group.name);
    setEditedDesc(group.description || '');
  }, [group]);

  if (!isOpen) return null;

  const isAdmin = group.isAdmin;
  const memberIds = new Set(group.members.map(m => m.userId));
  const availableContacts = contacts.filter(c => !memberIds.has(c.user.id));

  const filteredAvailableContacts = availableContacts.filter(contact => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      contact.nickname.toLowerCase().includes(query) ||
      contact.user.email.toLowerCase().includes(query) ||
      contact.user.username.toLowerCase().includes(query)
    );
  });

  const handleSaveName = async () => {
    if (!editedName.trim() || editedName === group.name) {
      setIsEditingName(false);
      return;
    }

    const result = await onUpdateGroup(group.id, { name: editedName.trim() });
    if (result.success) {
      setIsEditingName(false);
    }
  };

  const handleSaveDesc = async () => {
    if (editedDesc === (group.description || '')) {
      setIsEditingDesc(false);
      return;
    }

    const result = await onUpdateGroup(group.id, { description: editedDesc.trim() });
    if (result.success) {
      setIsEditingDesc(false);
    }
  };

  const handleAddMembers = async () => {
    for (const userId of selectedContacts) {
      await onAddMember(group.id, userId);
    }
    setSelectedContacts([]);
    setSearchQuery('');
    setActiveSection('members');
  };

  const handleRemoveMember = async (userId: number) => {
    if (!confirm('¿Remover este miembro del grupo?')) return;
    await onRemoveMember(group.id, userId);
  };

  const handleLeaveGroup = async () => {
    if (!confirm('¿Salir de este grupo?')) return;
    const result = await onLeaveGroup(group.id);
    if (result.success) {
      onClose();
    }
  };

  const handleDeleteGroup = async () => {
    if (!confirm('⚠️ ¿Eliminar este grupo permanentemente? Esta acción no se puede deshacer.')) return;
    const result = await onDeleteGroup(group.id);
    if (result.success) {
      onClose();
    }
  };

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`fixed right-0 top-0 h-full w-full md:w-96 bg-white shadow-2xl z-50 transform transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="bg-whatsapp-teal p-4 flex items-center justify-between">
          <h2 className="text-white text-lg font-semibold">Información del grupo</h2>
          <button
            onClick={onClose}
            className="text-white hover:bg-whatsapp-teal-dark rounded-full p-2 transition"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveSection('info')}
            className={`flex-1 py-3 text-sm font-medium transition ${
              activeSection === 'info'
                ? 'text-whatsapp-green border-b-2 border-whatsapp-green'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            ℹ️ Info
          </button>
          <button
            onClick={() => setActiveSection('members')}
            className={`flex-1 py-3 text-sm font-medium transition ${
              activeSection === 'members'
                ? 'text-whatsapp-green border-b-2 border-whatsapp-green'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            👥 Miembros ({group.memberCount})
          </button>
          {isAdmin && (
            <button
              onClick={() => setActiveSection('add')}
              className={`flex-1 py-3 text-sm font-medium transition ${
                activeSection === 'add'
                  ? 'text-whatsapp-green border-b-2 border-whatsapp-green'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              ➕ Agregar
            </button>
          )}
        </div>

        {/* Content */}
        <div className="overflow-y-auto h-[calc(100vh-180px)] p-4">
          {/* SECCIÓN: INFO */}
          {activeSection === 'info' && (
            <div className="space-y-6">
              {/* Avatar */}
              <div className="flex justify-center">
                <div className="w-32 h-32 bg-whatsapp-green rounded-full flex items-center justify-center">
                  {group.avatarUrl ? (
                    <img src={group.avatarUrl} alt={group.name} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <span className="text-white font-bold text-4xl">{group.name[0].toUpperCase()}</span>
                  )}
                </div>
              </div>

              {/* Nombre del grupo */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">Nombre del grupo</label>
                  {isAdmin && !isEditingName && (
                    <button
                      onClick={() => setIsEditingName(true)}
                      className="text-whatsapp-green hover:text-whatsapp-green-dark text-sm"
                    >
                      ✏️ Editar
                    </button>
                  )}
                </div>
                {isEditingName ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editedName}
                      onChange={(e) => setEditedName(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-whatsapp-green"
                      maxLength={100}
                      autoFocus
                    />
                    <button
                      onClick={handleSaveName}
                      className="px-3 py-2 bg-whatsapp-green text-white rounded-lg hover:bg-whatsapp-green-dark"
                    >
                      ✓
                    </button>
                    <button
                      onClick={() => {
                        setIsEditingName(false);
                        setEditedName(group.name);
                      }}
                      className="px-3 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <p className="px-3 py-2 bg-gray-50 rounded-lg text-gray-800">{group.name}</p>
                )}
              </div>

              {/* Descripción */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">Descripción</label>
                  {isAdmin && !isEditingDesc && (
                    <button
                      onClick={() => setIsEditingDesc(true)}
                      className="text-whatsapp-green hover:text-whatsapp-green-dark text-sm"
                    >
                      ✏️ Editar
                    </button>
                  )}
                </div>
                {isEditingDesc ? (
                  <div className="space-y-2">
                    <textarea
                      value={editedDesc}
                      onChange={(e) => setEditedDesc(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-whatsapp-green resize-none"
                      rows={3}
                      maxLength={255}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveDesc}
                        className="px-3 py-2 bg-whatsapp-green text-white rounded-lg hover:bg-whatsapp-green-dark"
                      >
                        ✓ Guardar
                      </button>
                      <button
                        onClick={() => {
                          setIsEditingDesc(false);
                          setEditedDesc(group.description || '');
                        }}
                        className="px-3 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                      >
                        ✕ Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="px-3 py-2 bg-gray-50 rounded-lg text-gray-600">
                    {group.description || 'Sin descripción'}
                  </p>
                )}
              </div>

              {/* Creado el */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Creado el</label>
                <p className="px-3 py-2 bg-gray-50 rounded-lg text-gray-600">
                  {new Date(group.createdAt).toLocaleDateString('es-ES', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric'
                  })}
                </p>
              </div>

              {/* Admin */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Administrador</label>
                <div className="px-3 py-2 bg-gray-50 rounded-lg">
                  {group.members
                    .filter(m => m.userId === group.adminUserId)
                    .map(admin => (
                      <div key={admin.userId} className="flex items-center gap-2">
                        <span className="text-yellow-500">👑</span>
                        <span className="text-gray-800">{admin.username}</span>
                        {admin.userId === user?.id && (
                          <span className="text-xs text-gray-500">(Tú)</span>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}

          {/* SECCIÓN: MIEMBROS */}
          {activeSection === 'members' && (
            <div className="space-y-2">
              {group.members.map((member) => (
                <div
                  key={member.userId}
                  className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition"
                >
                  <div className="w-10 h-10 bg-whatsapp-green rounded-full flex items-center justify-center">
                    {member.avatarUrl ? (
                      <img src={member.avatarUrl} alt={member.username} className="w-full h-full rounded-full" />
                    ) : (
                      <span className="text-white font-bold">{member.username[0].toUpperCase()}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 truncate">
                      {member.username}
                      {member.userId === user?.id && <span className="text-gray-500 ml-1">(Tú)</span>}
                    </p>
                    <p className="text-sm text-gray-500 truncate">{member.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {member.userId === group.adminUserId && (
                      <span className="text-yellow-500" title="Administrador">👑</span>
                    )}
                    {isAdmin && member.userId !== group.adminUserId && (
                      <button
                        onClick={() => handleRemoveMember(member.userId)}
                        className="text-red-500 hover:text-red-700 p-1"
                        title="Remover"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* SECCIÓN: AGREGAR MIEMBROS */}
          {activeSection === 'add' && isAdmin && (
            <div className="space-y-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar contacto..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-whatsapp-green"
              />

              {selectedContacts.length > 0 && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-600 mb-2">Seleccionados: {selectedContacts.length}</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedContacts.map(userId => {
                      const contact = contacts.find(c => c.user.id === userId);
                      if (!contact) return null;
                      return (
                        <div
                          key={userId}
                          className="flex items-center gap-2 bg-whatsapp-green text-white px-3 py-1 rounded-full text-sm"
                        >
                          <span>{contact.nickname}</span>
                          <button
                            onClick={() => setSelectedContacts(prev => prev.filter(id => id !== userId))}
                            className="hover:bg-whatsapp-green-dark rounded-full"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  <button
                    onClick={handleAddMembers}
                    className="w-full mt-3 px-4 py-2 bg-whatsapp-green text-white rounded-lg hover:bg-whatsapp-green-dark"
                  >
                    Agregar ({selectedContacts.length})
                  </button>
                </div>
              )}

              <div className="space-y-1 max-h-96 overflow-y-auto">
                {filteredAvailableContacts.length === 0 ? (
                  <p className="text-center text-gray-500 py-4">
                    {searchQuery ? 'No se encontraron contactos' : 'Todos tus contactos ya están en el grupo'}
                  </p>
                ) : (
                  filteredAvailableContacts.map(contact => {
                    const isSelected = selectedContacts.includes(contact.user.id);
                    return (
                      <div
                        key={contact.id}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedContacts(prev => prev.filter(id => id !== contact.user.id));
                          } else {
                            setSelectedContacts(prev => [...prev, contact.user.id]);
                          }
                        }}
                        className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 rounded-lg transition ${
                          isSelected ? 'bg-green-50' : ''
                        }`}
                      >
                        <div className="w-10 h-10 bg-whatsapp-green rounded-full flex items-center justify-center">
                          {contact.user.avatarUrl ? (
                            <img src={contact.user.avatarUrl} alt={contact.nickname} className="w-full h-full rounded-full" />
                          ) : (
                            <span className="text-white font-bold">{contact.nickname[0].toUpperCase()}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-800 truncate">{contact.nickname}</p>
                          <p className="text-sm text-gray-500 truncate">{contact.user.email}</p>
                        </div>
                        {isSelected && (
                          <svg className="w-6 h-6 text-whatsapp-green" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer - Acciones */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 bg-white space-y-2">
          {!isAdmin && (
            <button
              onClick={handleLeaveGroup}
              className="w-full px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
            >
              🚪 Salir del grupo
            </button>
          )}
          {isAdmin && (
            <button
              onClick={handleDeleteGroup}
              className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
            >
              🗑️ Eliminar grupo
            </button>
          )}
        </div>
      </div>
    </>
  );
};