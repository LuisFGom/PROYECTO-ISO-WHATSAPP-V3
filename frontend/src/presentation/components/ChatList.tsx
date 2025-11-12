// frontend/src/presentation/components/ChatList.tsx
import type { Conversation } from '../hooks/useConversations';

// 🔥 CORRECCIÓN CLAVE: La prop ahora acepta string | number | null para ser compatible con HomePage.tsx
interface ChatListProps {
  conversations: Conversation[];
  onConversationClick: (conversation: Conversation) => void;
  // ID de la conversación actualmente seleccionada
  // NOTA: Usaremos el ID del contacto (contact.user_id) para la comparación.
  selectedConversationId: string | number | null;
}

export const ChatList = ({
  conversations,
  onConversationClick,
  selectedConversationId,
}: ChatListProps) => {
  if (conversations.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        <p className="text-4xl mb-2">💬</p>
        <p>No tienes conversaciones</p>
        <p className="text-sm mt-1">Envía un mensaje a tus contactos</p>
      </div>
    );
  }

  const formatTimestamp = (timestamp: Date | null) => {
    if (!timestamp) return '';

    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    // Si es hoy
    if (diff < 24 * 60 * 60 * 1000) {
      return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    }

    // Si es esta semana
    if (diff < 7 * 24 * 60 * 60 * 1000) {
      const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
      return days[date.getDay()];
    }

    // Si es más antiguo
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
  };

  // Formatear el preview del último mensaje con "Tú:"
  const formatLastMessagePreview = (conversation: Conversation) => {
    const { last_message } = conversation;

    if (!last_message.preview) {
      return 'Sin mensajes';
    }

    const isOwnMessage =
      last_message.preview.includes('✓') ||
      conversation.last_message.is_own_message;

    let preview = last_message.preview;

    // Remover el "Tú: " si ya está, para reañadirlo condicionalmente y limpiar
    if (preview.startsWith('Tú: ')) {
        preview = preview.substring(4); 
    }

    if (isOwnMessage) {
      return `Tú: ${preview}`;
    }

    return preview;
  };

  return (
    <div className="divide-y divide-gray-200">
      {conversations.map((conversation) => {
        // --- LÓGICA DE COMPARACIÓN (SEGURA) ---
        // Convertimos ambos IDs a número para asegurar una comparación estricta,
        // sin importar si vienen como string o number del estado padre.
        const contactId = Number(conversation.contact.user_id);
        const selectedId = selectedConversationId !== null ? Number(selectedConversationId) : null;
        
        const isSelected = contactId === selectedId;
        // --- FIN LÓGICA DE COMPARACIÓN ---


        // LÍNEA 1: Definimos las clases base de padding (vertical y derecha)
        // Manteniendo un padding izquierdo de 16px (p-4)
        const basePaddingClass = 'py-4 pr-4 pl-4'; // <-- Cambiado para incluir pl-4

        // LÍNEA 2: Ajustamos 'selectedClass'
        const selectedClass = isSelected 
          // Cuando SÍ está seleccionado: SOLO fondo celeste. NO hay borde izquierdo y el padding queda en pl-4
          ? 'bg-blue-100/50' 
          // Cuando NO está seleccionado: Fondo hover normal y padding de pl-4.
          : 'hover:bg-gray-50'; 

        // clases condicionales para el avatar/initial
        const isOnline = !!conversation.contact.is_online;
        const avatarWrapperBg = isOnline ? 'bg-whatsapp-green' : 'bg-gray-300';
        const initialTextColor = isOnline ? 'text-white' : 'text-gray-700';

        // Usamos contact.user_id en el key para asegurar la unicidad
        return (
          <div
            key={conversation.contact.user_id}
            onClick={() => onConversationClick(conversation)}
            // LÍNEA 3: Aplicamos la combinación de clases.
            // Eliminamos border-l-4 y el ajuste de padding.
            className={`flex items-center cursor-pointer transition ${basePaddingClass} ${selectedClass}`}
          >
            {/* AVATAR */}
            <div className="relative flex-shrink-0">
              <div
                className={`relative w-12 h-12 rounded-full overflow-hidden flex items-center justify-center ${avatarWrapperBg}`}
              >
                {conversation.contact.avatar_url ? (
                  <img
                    src={conversation.contact.avatar_url}
                    alt={conversation.contact.nickname}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span
                    className={`font-semibold text-lg select-none ${initialTextColor}`}
                  >
                    {conversation.contact.nickname?.[0]?.toUpperCase() ?? '?'}
                  </span>
                )}
              </div>
            </div>

            {/* Info del chat */}
            <div className="flex-1 min-w-0 ml-3">
              <div className="flex items-baseline justify-between mb-1">
                <h3
                  className={`font-semibold truncate ${
                    conversation.unread_count > 0 ? 'text-gray-900' : 'text-gray-800'
                  }`}
                >
                  {conversation.contact.has_contact
                    ? conversation.contact.nickname
                    : conversation.contact.email}
                </h3>

                <span
                  className={`text-xs flex-shrink-0 ml-2 ${
                    conversation.unread_count > 0
                      ? 'text-whatsapp-green font-semibold'
                      : 'text-gray-500'
                  }`}
                >
                  {formatTimestamp(conversation.last_message.timestamp)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <p
                  className={`text-sm truncate ${
                    conversation.unread_count > 0 ? 'font-semibold text-gray-900' : 'text-gray-600'
                  }`}
                >
                  {formatLastMessagePreview(conversation)}
                </p>

                {conversation.unread_count > 0 && (
                  <div className="flex-shrink-0 ml-2">
                    <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-whatsapp-green rounded-full">
                      {conversation.unread_count > 99 ? '99+' : conversation.unread_count}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};