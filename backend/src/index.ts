// backend/src/index.ts
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { config } from './config/environment';
import { database } from './infrastructure/database/mysql/connection';
import routes from './presentation/routes';
import { errorMiddleware } from './presentation/middlewares/error.middleware';
import { initializeSocket } from './infrastructure/socket/socket'; 

const app = express();

// 🔥 Crear servidor HTTP para Socket.IO
const httpServer = createServer(app);

// 🔥 Configuración de CORS simplificada y corregida para desarrollo (API)
const corsOptions = {
    // 💡 Lista de orígenes para que Express envíe el encabezado ACAO correctamente.
    origin: [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        config.cors.origin, // Esto es '*' de tu .env o valor configurado
        'http://10.79.11.214:5173', 
        'https://specifically-semihumanistic-maria.ngrok-free.dev', 
        // ✅ AÑADIDO: Origen reportado en el error
        'http://10.79.19.113:5173', 
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'ngrok-skip-browser-warning'], 
};

// 🌟 LOG DE DIAGNÓSTICO:
app.use((req, res, next) => {
    if (req.method === 'OPTIONS') {
        console.log(`📡 Recibida petición OPTIONS (Preflight) desde Origin: ${req.headers.origin}`);
    } else if (req.url === '/api/health') {
        console.log(`✅ Recibida petición GET /api/health desde Origin: ${req.headers.origin}`);
    } else if (req.url.startsWith('/api/groups')) {
        // 🔥 NUEVO: Log específico para rutas de grupos
        console.log(`🔥 [GROUPS] ${req.method} ${req.url} desde Origin: ${req.headers.origin}`);
    }
    next();
});
// 🌟 FIN DEL LOG DE DIAGNÓSTICO

app.use(cors(corsOptions)); // Aplica la configuración de CORS

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ruta de prueba
app.get('/', (req, res) => { 
    res.send('Servidor funcionando correctamente');
});

// Ruta para probar conexión a DB (ruta original /health, ahora /api/health)
// Esta es la ruta que está siendo llamada constantemente en tu frontend (useNetworkStatus.ts)
app.get('/api/health', async (req, res) => {
    try {
        await database.query('SELECT 1');
        res.json({ 
            status: 'healthy',
            database: 'connected',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ 
            status: 'unhealthy',
            database: 'disconnected',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// API Routes
// 🔥 IMPORTANTE: Este import ya incluye las rutas de grupos porque las agregamos en routes/index.ts
app.use('/api', routes);

// Error handler middleware (debe ir al final)
app.use(errorMiddleware);

// 🔥 Inicializar Socket.IO
const socketService = initializeSocket(httpServer);
console.log('🔌 Socket.IO inicializado');

// 🔥 Iniciar servidor con HTTP (para Socket.IO)
httpServer.listen(config.port, '0.0.0.0', () => {
    console.log('');
    console.log('🚀 ========================================');
    console.log(`🚀 Server running on port ${config.port}`);
    console.log(`📍 http://localhost:${config.port}`);
    console.log(`🌍 Environment: ${config.nodeEnv}`);
    console.log(`🔌 Socket.IO ready`);
    console.log('📡 Rutas API disponibles:');
    console.log(`   - GET  /api/health`);
    console.log(`   - POST /api/auth/login`);
    console.log(`   - POST /api/auth/register`);
    console.log(`   - GET  /api/contacts`);
    console.log(`   - GET  /api/conversations`);
    console.log(`   - GET  /api/groups 🔥 NUEVO`);
    console.log(`   - POST /api/groups 🔥 NUEVO`);
    console.log('🚀 ========================================');
    console.log('');
});

// Manejo de errores no capturados
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    process.exit(1);
});