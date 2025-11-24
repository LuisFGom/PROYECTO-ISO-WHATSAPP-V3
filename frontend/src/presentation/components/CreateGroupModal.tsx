// frontend/src/presentation/components/CreateGroupModal.tsx
import { useState } from 'react';
import type { Contact } from '../hooks/useContacts';

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGroupCreated: () => void;
  onCreate: (data: { name: string; description?: string; memberIds: number[] }) => Promise<any>;
  contacts: Contact[]; // 🔥 RECIBIR CONTACTOS COMO PROP
  isLoadingContacts?: boolean; // 🔥 OPCIONAL: Estado de carga
}

export const CreateGroupModal = ({ 
  isOpen, 
  onClose, 
  onGroupCreated, 
  onCreate,
  contacts, // 🔥 USAR CONTACTOS DE PROPS
  isLoadingContacts = false 
}: CreateGroupModalProps) => {
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedContacts, setSelectedContacts] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  // 🔥 Filtrar contactos localmente
  const filteredContacts = contacts.filter((contact) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      contact.nickname.toLowerCase().includes(query) ||
      contact.user.email.toLowerCase().includes(query) ||
      contact.user.username.toLowerCase().includes(query)
    );
  });

  const toggleContact = (contactUserId: number) => {
    setSelectedContacts((prev) =>
      prev.includes(contactUserId)
        ? prev.filter((id) => id !== contactUserId)
        : [...prev, contactUserId]
    );
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      setError('El nombre del grupo es obligatorio');
      return;
    }

    if (selectedContacts.length === 0) {
      setError('Debes seleccionar al menos un contacto');
      return;
    }

    setError('');
    setIsCreating(true);

    try {
      const result = await onCreate({
        name: groupName.trim(),
        description: description.trim() || undefined,
        memberIds: selectedContacts
      });

      if (result.success) {
        // Resetear y cerrar
        setGroupName('');
        setDescription('');
        setSelectedContacts([]);
        setSearchQuery('');
        onGroupCreated();
        onClose();
      } else {
        setError(result.error || 'Error al crear grupo');
      }
    } catch (err: any) {
      console.error('Error creando grupo:', err);
      setError(err.message || 'Error al crear grupo');
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    setGroupName('');
    setDescription('');
    setSelectedContacts([]);
    setSearchQuery('');
    setError('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-whatsapp-teal p-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Crear Grupo Nuevo</h2>
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
          {/* Nombre del grupo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nombre del grupo *
            </label>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Ej: Familia, Amigos, Trabajo..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-whatsapp-green"
              maxLength={100}
            />
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Descripción (opcional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descripción del grupo..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-whatsapp-green resize-none"
              rows={3}
              maxLength={255}
            />
          </div>

          {/* Seleccionar participantes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Seleccionar participantes *
            </label>
            
            {/* Buscador */}
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar contacto..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-whatsapp-green mb-3"
            />

            {/* Seleccionados */}
            {selectedContacts.length > 0 && (
              <div className="mb-3 p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-600 mb-2">
                  Seleccionados: {selectedContacts.length}
                </p>
                <div className="flex flex-wrap gap-2">
                  {selectedContacts.map((contactUserId) => {
                    const contact = contacts.find((c) => c.user.id === contactUserId);
                    if (!contact) return null;
                    return (
                      <div
                        key={contactUserId}
                        className="flex items-center gap-2 bg-whatsapp-green text-white px-3 py-1 rounded-full text-sm"
                      >
                        <span>{contact.nickname}</span>
                        <button
                          onClick={() => toggleContact(contactUserId)}
                          className="hover:bg-whatsapp-green-dark rounded-full p-0.5"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 🔥 MOSTRAR ESTADO DE CARGA */}
            {isLoadingContacts ? (
              <div className="border border-gray-300 rounded-lg p-4 text-center text-gray-500">
                <svg className="animate-spin h-6 w-6 mx-auto mb-2 text-gray-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                <p>Cargando contactos...</p>
              </div>
            ) : (
              /* Lista de contactos */
              <div className="border border-gray-300 rounded-lg max-h-64 overflow-y-auto">
                {filteredContacts.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">
                    {searchQuery ? 'No se encontraron contactos' : contacts.length === 0 ? 'No tienes contactos agregados' : 'No hay resultados'}
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {filteredContacts.map((contact) => {
                      const isSelected = selectedContacts.includes(contact.user.id);
                      return (
                        <div
                          key={contact.id}
                          onClick={() => toggleContact(contact.user.id)}
                          className={`p-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50 transition ${
                            isSelected ? 'bg-green-50' : ''
                          }`}
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
                          <div className="flex-shrink-0">
                            {isSelected && (
                              <svg className="w-6 h-6 text-whatsapp-green" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 flex gap-3">
          <button
            onClick={handleClose}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
          >
            Cancelar
          </button>
          <button
            onClick={handleCreateGroup}
            disabled={isCreating || !groupName.trim() || selectedContacts.length === 0}
            className="flex-1 px-4 py-2 bg-whatsapp-green text-white rounded-lg hover:bg-whatsapp-green-dark transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCreating ? 'Creando...' : `Crear Grupo (${selectedContacts.length})`}
          </button>
        </div>
      </div>
    </div>
  );
};