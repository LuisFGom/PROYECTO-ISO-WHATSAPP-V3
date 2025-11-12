// backend/src/presentation/routes/index.ts
import { Router } from 'express';
import authRoutes from './auth.routes';
import contactRoutes from './contact.routes';
import conversationRoutes from './conversation.routes'; // 🔥 NUEVO

const router = Router();

// Rutas de autenticación
router.use('/auth', authRoutes);

// Rutas de contactos
router.use('/contacts', contactRoutes);

// 🔥 NUEVO: Rutas de conversaciones (chats)
router.use('/conversations', conversationRoutes);

export default router;