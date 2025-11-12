// frontend/src/presentation/components/ChatList.tsx
import type { Conversation } from '../hooks/useConversations';

interface ChatListProps {
  conversations: Conversation[];
  onConversationClick: (conversation: Conversation) => void;
}

export const ChatList = ({
  conversations,
  onConversationClick,
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

  // 🔥 CORREGIDO: Formatear el preview del último mensaje con "Tú:"
  const formatLastMessagePreview = (conversation: Conversation) => {
    const { last_message } = conversation;

    if (!last_message.preview) {
      return 'Sin mensajes';
    }

    if (last_message.preview.startsWith('Tú: ')) {
      return last_message.preview;
    }

    const isOwnMessage =
      last_message.preview.includes('✓') ||
      conversation.last_message.is_own_message;

    if (isOwnMessage && !last_message.preview.startsWith('Tú: ')) {
      return `Tú: ${last_message.preview}`;
    }

    return last_message.preview;
  };

  return (
    <div className="divide-y divide-gray-200">
      {conversations.map((conversation) => {
        // clases condicionales para el avatar/initial
        const isOnline = !!conversation.contact.is_online;
        const avatarWrapperBg = isOnline ? 'bg-whatsapp-green' : 'bg-gray-300';
        const initialTextColor = isOnline ? 'text-white' : 'text-gray-700';

        return (
          <div
            key={conversation.conversation_id}
            onClick={() => onConversationClick(conversation)}
            className="flex items-center p-4 hover:bg-gray-50 cursor-pointer transition"
          >
            {/* AVATAR: ahora sin círculo indicador.
                - Si no hay avatar_url mostramos la letra sobre fondo que cambia con is_online
                - Si hay avatar_url mostramos la imagen (la imagen ocupa todo el círculo);
                  el fondo seguirá cambiando pero la imagen cubrirá el fondo en la mayoría de casos.
            */}
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
