// frontend/src/presentation/components/ContactList.tsx
import { useState } from 'react';
import type { Contact } from '../hooks/useContacts';

interface ContactListProps {
  contacts: Contact[];
  onContactClick: (contact: Contact) => void;
  onDeleteContact: (contactId: number) => void;
  onEditContact: (contactId: number, nickname: string) => void;
}

export const ContactList = ({
  contacts,
  onContactClick,
  onDeleteContact,
  onEditContact,
}: ContactListProps) => {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editNickname, setEditNickname] = useState('');
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);

  const handleStartEdit = (contact: Contact) => {
    setEditingId(contact.id);
    setEditNickname(contact.nickname);
    setOpenMenuId(null);
  };

  const handleSaveEdit = (contactId: number) => {
    if (editNickname.trim()) {
      onEditContact(contactId, editNickname.trim());
    }
    setEditingId(null);
    setEditNickname('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditNickname('');
  };

  const handleDelete = (contactId: number) => {
    if (window.confirm('¿Eliminar este contacto?')) {
      onDeleteContact(contactId);
    }
    setOpenMenuId(null);
  };

  if (contacts.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        <p className="text-4xl mb-2">👥</p>
        <p>No tienes contactos aún</p>
        <p className="text-sm mt-1">Haz clic en + para agregar</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-200">
      {contacts.map((contact) => (
        <div
          key={contact.id}
          className="relative hover:bg-gray-50 transition"
        >
          {editingId === contact.id ? (
            // Modo edición
            <div className="p-4">
              <input
                type="text"
                value={editNickname}
                onChange={(e) => setEditNickname(e.target.value)}
                className="w-full px-3 py-2 border border-whatsapp-green rounded-lg focus:outline-none"
                autoFocus
                maxLength={100}
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => handleSaveEdit(contact.id)}
                  className="flex-1 px-3 py-1 bg-whatsapp-green text-white rounded-lg text-sm"
                >
                  Guardar
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="flex-1 px-3 py-1 bg-gray-300 text-gray-700 rounded-lg text-sm"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            // Modo normal
            <div className="flex items-center p-4">
              <div
                className="flex items-center gap-3 flex-1 cursor-pointer"
                onClick={() => onContactClick(contact)}
              >
                {/* Avatar */}
                <div className="relative">
                  <div className="w-12 h-12 bg-whatsapp-green rounded-full flex items-center justify-center flex-shrink-0">
                    {contact.user.avatarUrl ? (
                      <img
                        src={contact.user.avatarUrl}
                        alt={contact.nickname}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      <span className="text-white font-bold text-lg">
                        {contact.nickname[0].toUpperCase()}
                      </span>
                    )}
                  </div>
                  {/* 🔥 CORRECCIÓN: Indicador online - POSICIÓN CORREGIDA */}
                  {contact.user.status === 'online' && (
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full transform translate-x-1/2 translate-y-1/2"></div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-800 truncate">
                    {contact.nickname}
                  </h3>
                  <p className="text-sm text-gray-500 truncate">
                    {contact.user.email}
                  </p>
                </div>
              </div>

              {/* Menú de opciones */}
              <div className="relative">
                <button
                  onClick={() =>
                    setOpenMenuId(openMenuId === contact.id ? null : contact.id)
                  }
                  className="p-2 hover:bg-gray-200 rounded-full transition"
                >
                  <svg
                    className="w-5 h-5 text-gray-600"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                  </svg>
                </button>

                {openMenuId === contact.id && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl z-10 border border-gray-200">
                    <button
                      onClick={() => handleStartEdit(contact)}
                      className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-2 text-gray-700"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                      Editar apodo
                    </button>
                    <button
                      onClick={() => handleDelete(contact.id)}
                      className="w-full px-4 py-2 text-left hover:bg-red-50 flex items-center gap-2 text-red-600"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Eliminar contacto
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};