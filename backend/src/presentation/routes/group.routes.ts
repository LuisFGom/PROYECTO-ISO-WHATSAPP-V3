// backend/src/presentation/routes/group.routes.ts
import { Router } from 'express';
import { groupController } from '../controllers/group.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

// 🔥 CRÍTICO: Middleware de logging
router.use((req, res, next) => {
  console.log(`🔥 [GROUP ROUTES] ${req.method} ${req.originalUrl}`);
  console.log(`🔥 Body:`, req.body);
  console.log(`🔥 User:`, (req as any).user || (req as any).userId);
  next();
});

// 🔥 CRÍTICO: Todas las rutas requieren autenticación
router.use(authMiddleware);

// ========== GRUPOS ==========

// GET /api/groups - Obtener todos los grupos del usuario
router.get('/', async (req, res) => {
  console.log('👥 GET /api/groups');
  await groupController.getUserGroups(req, res);
});

// POST /api/groups - Crear un nuevo grupo
router.post('/', async (req, res) => {
  console.log('➕ POST /api/groups - Body:', req.body);
  await groupController.createGroup(req, res);
});

// GET /api/groups/:id - Obtener un grupo por ID
router.get('/:id', async (req, res) => {
  console.log('📋 GET /api/groups/:id');
  await groupController.getGroupById(req, res);
});

// PUT /api/groups/:id - Actualizar información del grupo (solo admin)
router.put('/:id', async (req, res) => {
  console.log('✏️ PUT /api/groups/:id');
  await groupController.updateGroup(req, res);
});

// DELETE /api/groups/:id - Eliminar un grupo (solo admin)
router.delete('/:id', async (req, res) => {
  console.log('🗑️ DELETE /api/groups/:id');
  await groupController.deleteGroup(req, res);
});

// ========== MIEMBROS ==========

// GET /api/groups/:id/members - Obtener miembros del grupo
router.get('/:id/members', async (req, res) => {
  console.log('👤 GET /api/groups/:id/members');
  await groupController.getGroupMembers(req, res);
});

// POST /api/groups/:id/members - Agregar un miembro al grupo (solo admin)
router.post('/:id/members', async (req, res) => {
  console.log('➕ POST /api/groups/:id/members');
  await groupController.addMember(req, res);
});

// DELETE /api/groups/:id/members/:userId - Remover un miembro del grupo (solo admin)
router.delete('/:id/members/:userId', async (req, res) => {
  console.log('🚫 DELETE /api/groups/:id/members/:userId');
  await groupController.removeMember(req, res);
});

// ========== MENSAJES ==========

// GET /api/groups/:id/messages - Obtener mensajes del grupo
router.get('/:id/messages', async (req, res) => {
  console.log('💬 GET /api/groups/:id/messages');
  await groupController.getGroupMessages(req, res);
});

// POST /api/groups/:id/messages/search - Buscar mensajes en el grupo
router.post('/:id/messages/search', async (req, res) => {
  console.log('🔍 POST /api/groups/:id/messages/search');
  await groupController.searchGroupMessages(req, res);
});

// GET /api/groups/:id/unread-count - Obtener mensajes no leídos de un grupo
router.get('/:id/unread-count', async (req, res) => {
  console.log('📊 GET /api/groups/:id/unread-count');
  await groupController.getUnreadCount(req, res);
});

console.log('✅ Group routes configuradas correctamente');

export default router;