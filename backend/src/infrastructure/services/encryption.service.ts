// backend/src/infrastructure/services/encryption.service.ts
import crypto from 'crypto';

export class EncryptionService {
  private readonly algorithm = 'aes-256-cbc';
  private readonly key: Buffer;

  constructor() {
    const encryptionKey = process.env.ENCRYPTION_KEY;
    
    if (!encryptionKey) {
      throw new Error('⚠️ ENCRYPTION_KEY no está definida en .env');
    }

    this.key = Buffer.from(encryptionKey, 'hex');
    
    if (this.key.length !== 32) {
      throw new Error('⚠️ ENCRYPTION_KEY debe ser de 32 bytes (64 caracteres hex)');
    }
  }

  /**
   * Encripta un mensaje usando AES-256-CBC
   */
  encrypt(text: string): { encryptedContent: string; iv: string } {
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
      
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      return {
        encryptedContent: encrypted,
        iv: iv.toString('hex')
      };
    } catch (error) {
      console.error('❌ Error al encriptar:', error);
      throw new Error('Error en el proceso de encriptación');
    }
  }

  /**
   * Desencripta un mensaje
   */
  decrypt(encryptedContent: string, ivHex: string): string {
    try {
      const iv = Buffer.from(ivHex, 'hex');
      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
      
      let decrypted = decipher.update(encryptedContent, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('❌ Error al desencriptar:', error);
      throw new Error('Error en el proceso de desencriptación');
    }
  }

  /**
   * Genera una clave de encriptación (ejecutar una vez)
   */
  static generateKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}