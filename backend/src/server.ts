// backend/src/server.ts
import express from 'express';
import cors from 'cors';
import authRoutes from './presentation/routes/auth.routes';
import contactRoutes from './presentation/routes/contact.routes';
import conversationRoutes from './presentation/routes/conversation.routes';
import groupRoutes from './presentation/routes/group.routes'; // 🔥 NUEVO

const app = express();

app.use(cors());
app.use(express.json());

// 🔥 LOG INICIAL: para saber si Express se levanta bien
console.log('🟢 Iniciando servidor Express...');

// ========== RUTAS ==========

// Rutas de autenticación
app.use('/api/auth', (req, res, next) => {
  console.log(`➡️ [AUTH] [${req.method}] ${req.originalUrl}`);
  next();
}, authRoutes);

// Rutas de contactos
app.use('/api/contacts', (req, res, next) => {
  console.log(`➡️ [CONTACTS] [${req.method}] ${req.originalUrl}`);
  next();
}, contactRoutes);

// Rutas de conversaciones
app.use('/api/conversations', (req, res, next) => {
  console.log(`➡️ [CONVERSATIONS] [${req.method}] ${req.originalUrl}`);
  next();
}, conversationRoutes);

// 🔥 NUEVO: Rutas de grupos
app.use('/api/groups', (req, res, next) => {
  console.log(`➡️ [GROUPS] [${req.method}] ${req.originalUrl}`);
  next();
}, groupRoutes);

// ========== RUTA DE PRUEBA ==========
app.get('/', (req, res) => {
  res.send('Servidor funcionando correctamente');
});

// ========== HEALTH CHECK ==========
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    routes: {
      auth: '/api/auth',
      contacts: '/api/contacts',
      conversations: '/api/conversations',
      groups: '/api/groups' // 🔥 NUEVO
    }
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en el puerto ${PORT}`);
  console.log(`📡 Rutas disponibles:`);
  console.log(`   - /api/auth`);
  console.log(`   - /api/contacts`);
  console.log(`   - /api/conversations`);
  console.log(`   - /api/groups 🔥 NUEVO`);
});