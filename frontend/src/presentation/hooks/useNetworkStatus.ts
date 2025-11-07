// frontend/src/presentation/hooks/useNetworkStatus.ts

import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '../../infrastructure/api/apiClient';

export const useNetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isBackendReachable, setIsBackendReachable] = useState(true);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [isReconnecting, setIsReconnecting] = useState(false);

  // Referencia para manejar el timeout de reconexión manual
  const timeoutRef = useRef<number | undefined>(undefined);

  // 🔥 Verificar conexión con el backend
  const checkBackendConnection = useCallback(async () => {
    try {
      await apiClient.get('/health', { timeout: 5000 });

      setIsBackendReachable(true);
      setIsReconnecting(false);
      setReconnectAttempt(0);
      return true;
    } catch (error: any) {
      const isServerDownError =
        error?.code === 'ECONNABORTED' ||
        error?.code === 'ETIMEDOUT' ||
        error?.code === 'ERR_NETWORK';
      const isCorsError = error?.response === undefined && !isServerDownError;

      if (isCorsError) {
        console.log('⚠️ Error de Red/CORS (asumiendo backend vivo)');
        setIsBackendReachable(true);
        setIsReconnecting(false);
        return true;
      }

      if (isServerDownError) {
        console.log('❌ Backend no alcanzable o error grave (Servicio caído):', error.message);
        setIsBackendReachable(false);
        return false;
      }

      console.log('❌ Error inesperado del backend:', error.message);
      setIsBackendReachable(false);
      return false;
    }
  }, []);

  useEffect(() => {
    // Función recursiva para intentar reconectarse
    const attemptReconnect = async () => {
      console.log(`🔄 Intentando reconectar al backend... Intento #${reconnectAttempt + 1}`);
      setReconnectAttempt((prev) => prev + 1);

      const connected = await checkBackendConnection();

      if (connected) {
        console.log('✅ Reconexión exitosa');
        if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      } else if (isOnline) {
        // Si falla y estamos online, programar el siguiente intento
        timeoutRef.current = window.setTimeout(attemptReconnect, 3000);
      }
    };

    const startReconnecting = () => {
      if (isReconnecting) return;

      console.log('🔄 Iniciando proceso de reconexión...');
      setIsReconnecting(true);
      setReconnectAttempt(1);

      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      attemptReconnect();
    };

    // 🌐 Escuchar eventos del navegador
    const handleOnline = () => {
      console.log('🌐 Internet conectado');
      setIsOnline(true);
      checkBackendConnection();
    };

    const handleOffline = () => {
      console.log('❌ Internet desconectado');
      setIsOnline(false);
      setIsReconnecting(true);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      startReconnecting();
    };

    // 👁️ Verificar cuando la página vuelve al foco o se hace visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('👁️ Página visible de nuevo, verificando conexión...');
        checkBackendConnection();
      }
    };
    const handleFocus = () => {
      console.log('🎯 Ventana con foco, verificando conexión...');
      checkBackendConnection();
    };

    // 🔥 Registro de listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    // 🔥 Verificación inicial al montar
    checkBackendConnection()
      .then((connected) => {
        if (!connected) {
          console.log('🚨 Verificación inicial fallida. Forzando inicio de reconexión.');
          startReconnecting();
        }
      })
      .catch(() => {});

    // 🧩 NUEVO: Verificación continua cada 5 segundos (detecta caída del backend sin cambiar de pestaña)
    const interval = window.setInterval(() => {
      if (isOnline && !isReconnecting) {
        checkBackendConnection();
      }
    }, 5000); // cada 5 segundos

    // 🧹 Limpieza al desmontar
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      window.clearInterval(interval);
    };
  }, [isOnline, isReconnecting, checkBackendConnection, reconnectAttempt]);

  return {
    isOnline,
    isBackendReachable,
    isReconnecting: !isOnline || (isOnline && !isBackendReachable),
    reconnectAttempt,
  };
};
