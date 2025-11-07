// backend/src/index.ts - Versión Definitiva con Log
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
    // 💡 Lista de orígenes fijos para que Express envíe el encabezado ACAO correctamente.
    origin: [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        config.cors.origin, // Esto es '*' de tu .env
        'http://10.79.11.214:5173', // Tu IP local
        'https://specifically-semihumanistic-maria.ngrok-free.dev', // URL de ngrok
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
    }
    next();
});
// 🌟 FIN DEL LOG DE DIAGNÓSTICO

app.use(cors(corsOptions)); // Aplica la configuración de CORS

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ... (El resto del código es igual, incluyendo las rutas y el inicio del servidor) ...

// Ruta de prueba
app.get('/', (req, res) => { /* ... */ });

// Ruta para probar conexión a DB
app.get('/health', async (req, res) => { /* ... */ });

// 🔥 Health check sin autenticación (para el frontend)
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
app.use('/api', routes);

// Error handler middleware (debe ir al final)
app.use(errorMiddleware);

// 🔥 Inicializar Socket.IO
const socketService = initializeSocket(httpServer);
console.log('🔌 Socket.IO inicializado');

// 🔥 Iniciar servidor con HTTP (para Socket.IO)
httpServer.listen(config.port, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${config.port}`);
  console.log(`📍 http://localhost:${config.port}`);
  console.log(`🌍 Environment: ${config.nodeEnv}`);
  console.log(`🔌 Socket.IO ready`);
});

// Manejo de errores no capturados
process.on('unhandledRejection', (reason, promise) => { /* ... */ });
process.on('uncaughtException', (error) => { /* ... */ });