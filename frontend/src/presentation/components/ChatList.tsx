// frontend/src/presentation/components/ChatList.tsx
import type { Conversation } from '../hooks/useConversations';

interface ChatListProps {
  conversations: Conversation[];
  onConversationClick: (conversation: Conversation) => void;
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

    if (diff < 24 * 60 * 60 * 1000) {
      return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    }

    if (diff < 7 * 24 * 60 * 60 * 1000) {
      const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
      return days[date.getDay()];
    }

    return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
  };

  // 🔥 MEJORADO: Formatear el preview detectando mensajes eliminados
  const formatLastMessagePreview = (conversation: Conversation) => {
    const { last_message } = conversation;

    // Si no hay preview en absoluto
    if (!last_message.preview) {
      return 'Sin mensajes';
    }

    let preview = last_message.preview.trim();

    // 🔥 NUEVO: Detectar si el mensaje fue eliminado para todos
    if (
      preview === 'Este mensaje fue eliminado' ||
      preview === '[Este mensaje fue eliminado]' ||
      preview.includes('mensaje fue eliminado')
    ) {
      return '🚫 Este mensaje fue eliminado';
    }

    // Detectar si es mensaje propio
    const isOwnMessage =
      preview.includes('✓') ||
      conversation.last_message.is_own_message;

    // Remover el "Tú: " si ya está presente
    if (preview.startsWith('Tú: ')) {
      preview = preview.substring(4);
    }

    // Agregar "Tú: " solo si es mensaje propio y no está eliminado
    if (isOwnMessage) {
      return `Tú: ${preview}`;
    }

    return preview;
  };

  return (
    <div className="divide-y divide-gray-200">
      {conversations.map((conversation) => {
        const contactId = Number(conversation.contact.user_id);
        const selectedId = selectedConversationId !== null ? Number(selectedConversationId) : null;
        const isSelected = contactId === selectedId;

        const basePaddingClass = 'py-4 pr-4 pl-4';
        const selectedClass = isSelected ? 'bg-blue-100/50' : 'hover:bg-gray-50';

        const isOnline = !!conversation.contact.is_online;
        const avatarWrapperBg = isOnline ? 'bg-whatsapp-green' : 'bg-gray-300';
        const initialTextColor = isOnline ? 'text-white' : 'text-gray-700';

        // 🔥 NUEVO: Detectar si el último mensaje fue eliminado
        const lastMessagePreview = formatLastMessagePreview(conversation);
        const isDeletedMessage = lastMessagePreview.includes('🚫') || lastMessagePreview.includes('eliminado');

        return (
          <div
            key={conversation.contact.user_id}
            onClick={() => onConversationClick(conversation)}
            className={`flex items-center cursor-pointer transition ${basePaddingClass} ${selectedClass}`}
          >
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
                  <span className={`font-semibold text-lg select-none ${initialTextColor}`}>
                    {conversation.contact.nickname?.[0]?.toUpperCase() ?? '?'}
                  </span>
                )}
              </div>
            </div>

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
                {/* 🔥 MEJORADO: Estilo especial para mensajes eliminados */}
                <p
                  className={`text-sm truncate ${
                    isDeletedMessage
                      ? 'italic text-gray-500'
                      : conversation.unread_count > 0
                      ? 'font-semibold text-gray-900'
                      : 'text-gray-600'
                  }`}
                >
                  {lastMessagePreview}
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