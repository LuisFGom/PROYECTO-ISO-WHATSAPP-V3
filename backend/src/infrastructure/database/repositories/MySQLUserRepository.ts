// backend/src/infrastructure/database/repositories/MySQLUserRepository.ts
import type { IUserRepository, CreateUserData } from '../../../domain/repositories/IUserRepository';
import { User } from '../../../domain/entities/User.entity';
import { UserStatus } from '../../../shared/types/user.types';
import { database } from '../mysql/connection';
import type { RowDataPacket } from 'mysql2';

interface UserRow extends RowDataPacket {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  avatar_url: string | null;
  status: UserStatus;
  about: string;
  created_at: Date;
  updated_at: Date;
  last_seen: Date | null;
}

export class MySQLUserRepository implements IUserRepository {
  
  private mapRowToUser(row: UserRow): User {
    return new User(
      row.id,
      row.username,
      row.email,
      row.password_hash,
      row.avatar_url,
      row.status,
      row.about,
      row.created_at,
      row.updated_at,
      row.last_seen
    );
  }

  async create(userData: CreateUserData): Promise<User> {
    const sql = `
      INSERT INTO users (username, email, password_hash, avatar_url, status, about)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    try {
      const result = await database.query(sql, [
        userData.username,
        userData.email,
        userData.passwordHash,
        userData.avatarUrl || null,
        userData.status || UserStatus.OFFLINE,
        userData.about || 'Hey there! I am using WhatsApp Clone',
      ]);

      const resultSetHeader: any = Array.isArray(result) ? result[0] : result;
      const insertId = resultSetHeader.insertId;

      if (!insertId) {
        throw new Error('Failed to get insert ID');
      }

      const newUser = await this.findById(insertId);
      if (!newUser) {
        throw new Error('Failed to retrieve created user');
      }
      
      return newUser;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  async findById(id: number): Promise<User | null> {
    const sql = 'SELECT * FROM users WHERE id = ?';
    const rows = await database.query<UserRow[]>(sql, [id]);
    
    if (rows.length === 0) {
      return null;
    }
    
    return this.mapRowToUser(rows[0]);
  }

  async findByEmail(email: string): Promise<User | null> {
    const sql = 'SELECT * FROM users WHERE email = ?';
    const rows = await database.query<UserRow[]>(sql, [email]);
    
    if (rows.length === 0) {
      return null;
    }
    
    return this.mapRowToUser(rows[0]);
  }

  async findByUsername(username: string): Promise<User | null> {
    const sql = 'SELECT * FROM users WHERE username = ?';
    const rows = await database.query<UserRow[]>(sql, [username]);
    
    if (rows.length === 0) {
      return null;
    }
    
    return this.mapRowToUser(rows[0]);
  }

  async update(id: number, userData: Partial<User>): Promise<User | null> {
    const updates: string[] = [];
    const values: any[] = [];

    if (userData.username !== undefined) {
      updates.push('username = ?');
      values.push(userData.username);
    }
    if (userData.avatarUrl !== undefined) {
      updates.push('avatar_url = ?');
      values.push(userData.avatarUrl);
    }
    if (userData.about !== undefined) {
      updates.push('about = ?');
      values.push(userData.about);
    }
    if (userData.status !== undefined) {
      updates.push('status = ?');
      values.push(userData.status);
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    const sql = `UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`;
    values.push(id);

    await database.query(sql, values);
    return this.findById(id);
  }

  /**
   * 🔥 CRÍTICO: Actualizar estado del usuario (online/offline)
   */
  async updateStatus(id: number, status: UserStatus): Promise<void> {
    const idNum = Number(id);
    
    console.log(`🔄 Actualizando estado: userId=${idNum}, status=${status}`);

    const sql = 'UPDATE users SET status = ?, updated_at = NOW() WHERE id = ?';
    await database.query(sql, [status, idNum]);

    console.log(`✅ Estado actualizado: userId=${idNum} -> ${status}`);
  }

  /**
   * 🔥 CRÍTICO: Actualizar último visto
   */
  async updateLastSeen(id: number): Promise<void> {
    const idNum = Number(id);
    
    const sql = 'UPDATE users SET last_seen = NOW(), updated_at = NOW() WHERE id = ?';
    await database.query(sql, [idNum]);
  }

  async delete(id: number): Promise<boolean> {
    const sql = 'DELETE FROM users WHERE id = ?';
    const [result]: any = await database.query(sql, [id]);
    return result.affectedRows > 0;
  }

  async findAll(searchTerm?: string, limit: number = 50): Promise<User[]> {
    let sql = 'SELECT * FROM users';
    const params: any[] = [];

    if (searchTerm) {
      sql += ' WHERE username LIKE ? OR email LIKE ?';
      const search = `%${searchTerm}%`;
      params.push(search, search);
    }

    sql += ' ORDER BY username ASC LIMIT ?';
    params.push(limit);

    const rows = await database.query<UserRow[]>(sql, params);
    return rows.map(row => this.mapRowToUser(row));
  }
}