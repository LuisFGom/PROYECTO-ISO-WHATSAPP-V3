// backend/generate-key.js
// Ejecutar una sola vez: node generate-key.js

const crypto = require('crypto');

const encryptionKey = crypto.randomBytes(32).toString('hex');

console.log('═'.repeat(60));
console.log('🔐 CLAVE DE ENCRIPTACIÓN GENERADA');
console.log('═'.repeat(60));
console.log('');
console.log('Copia esta línea a tu archivo .env:');
console.log('');
console.log(`ENCRYPTION_KEY=${encryptionKey}`);
console.log('');
console.log('⚠️  IMPORTANTE:');
console.log('- Guarda esta clave de forma segura');
console.log('- NUNCA la subas a Git');
console.log('- Si la pierdes, no podrás desencriptar mensajes antiguos');
console.log('');
console.log('═'.repeat(60));