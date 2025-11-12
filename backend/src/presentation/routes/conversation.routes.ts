// backend/src/presentation/routes/conversation.routes.ts
import { Router } from 'express';
import { ConversationController } from '../controllers/conversation.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();
const conversationController = new ConversationController();

// Obtener todas las conversaciones del usuario
router.get(
  '/',
  authMiddleware,
  (req, res) => conversationController.getUserConversations(req, res)
);

export default router;