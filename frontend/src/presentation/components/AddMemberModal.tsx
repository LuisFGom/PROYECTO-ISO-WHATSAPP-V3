// frontend/src/presentation/components/AddMemberModal.tsx
import { useState } from 'react';
import { useContacts } from '../hooks/useContacts';
import type { GroupMember } from '../hooks/useGroups';

interface AddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: number;
  currentMembers: GroupMember[];
  onAddMember: (groupId: number, userId: number) => Promise<any>;
  onMemberAdded: () => void;
}

export const AddMemberModal = ({
  isOpen,
  onClose,
  groupId,
  currentMembers,
  onAddMember,
  onMemberAdded
}: AddMemberModalProps) => {
  const { contacts } = useContacts();
  const [searchQuery, setSearchQuery] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  // Filtrar contactos que NO están en el grupo
  const currentMemberIds = currentMembers.map((m) => m.userId);
  const availableContacts = contacts.filter(
    (contact) => !currentMemberIds.includes(contact.user.id)
  );

  const filteredContacts = availableContacts.filter((contact) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      contact.nickname.toLowerCase().includes(query) ||
      contact.user.email.toLowerCase().includes(query) ||
      contact.user.username.toLowerCase().includes(query)
    );
  });

  const handleAddMember = async (userId: number) => {
    setError('');
    setIsAdding(true);

    try {
      const result = await onAddMember(groupId, userId);
      
      if (result.success) {
        onMemberAdded();
        // No cerramos el modal para poder agregar más miembros
      } else {
        setError(result.error || 'Error al agregar miembro');
      }
    } catch (err: any) {
      console.error('Error agregando miembro:', err);
      setError(err.message || 'Error al agregar miembro');
    } finally {
      setIsAdding(false);
    }
  };

  const handleClose = () => {
    setSearchQuery('');
    setError('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="bg-whatsapp-teal p-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Agregar Participantes</h2>
            <button
              onClick={handleClose}
              className="text-white hover:bg-whatsapp-teal-dark rounded-full p-1 transition"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Buscador */}
          <div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar contacto..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-whatsapp-green"
            />
          </div>

          {/* Lista de contactos disponibles */}
          {filteredContacts.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              {availableContacts.length === 0 ? (
                <>
                  <div className="text-4xl mb-2">✅</div>
                  <p>Todos tus contactos ya están en el grupo</p>
                </>
              ) : (
                <>
                  <div className="text-4xl mb-2">🔍</div>
                  <p>No se encontraron contactos</p>
                </>
              )}
            </div>
          ) : (
            <div className="border border-gray-300 rounded-lg divide-y divide-gray-200 max-h-96 overflow-y-auto">
              {filteredContacts.map((contact) => (
                <div
                  key={contact.id}
                  className="p-3 flex items-center gap-3 hover:bg-gray-50 transition"
                >
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 bg-whatsapp-green rounded-full flex items-center justify-center">
                      {contact.user.avatarUrl ? (
                        <img src={contact.user.avatarUrl} alt="" className="w-full h-full rounded-full" />
                      ) : (
                        <span className="text-white font-bold">
                          {contact.nickname[0].toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 truncate">{contact.nickname}</p>
                    <p className="text-sm text-gray-500 truncate">{contact.user.email}</p>
                  </div>
                  <button
                    onClick={() => handleAddMember(contact.user.id)}
                    disabled={isAdding}
                    className="flex-shrink-0 px-3 py-1 bg-whatsapp-green text-white text-sm rounded-lg hover:bg-whatsapp-green-dark transition disabled:opacity-50"
                  >
                    Agregar
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200">
          <button
            onClick={handleClose}
            className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};