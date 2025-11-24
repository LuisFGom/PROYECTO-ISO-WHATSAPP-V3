// backend/src/presentation/routes/index.ts
import { Router } from 'express';
import authRoutes from './auth.routes';
import contactRoutes from './contact.routes';
import conversationRoutes from './conversation.routes';
import groupRoutes from './group.routes'; // 🔥 NUEVO

const router = Router();

console.log('📡 Configurando rutas principales...');

// Rutas de autenticación
router.use('/auth', (req, res, next) => {
  console.log(`🔐 [AUTH] ${req.method} ${req.originalUrl}`);
  next();
}, authRoutes);

// Rutas de contactos
router.use('/contacts', (req, res, next) => {
  console.log(`👥 [CONTACTS] ${req.method} ${req.originalUrl}`);
  next();
}, contactRoutes);

// Rutas de conversaciones (chats)
router.use('/conversations', (req, res, next) => {
  console.log(`💬 [CONVERSATIONS] ${req.method} ${req.originalUrl}`);
  next();
}, conversationRoutes);

// 🔥 NUEVO: Rutas de grupos
router.use('/groups', (req, res, next) => {
  console.log(`🔥 [GROUPS] ${req.method} ${req.originalUrl}`);
  next();
}, groupRoutes);

console.log('✅ Rutas configuradas:');
console.log('   - /api/auth');
console.log('   - /api/contacts');
console.log('   - /api/conversations');
console.log('   - /api/groups 🔥');

export default router;