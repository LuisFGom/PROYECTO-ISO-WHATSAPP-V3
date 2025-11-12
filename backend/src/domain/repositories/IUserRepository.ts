// backend/src/domain/repositories/IUserRepository.ts
import { User } from '../entities/User.entity';
import { UserStatus } from '../../shared/types/user.types';

export interface CreateUserData {
  username: string;
  email: string;
  passwordHash: string;
  avatarUrl?: string | null;
  status?: UserStatus;
  about?: string;
}

export interface IUserRepository {
  create(userData: CreateUserData): Promise<User>;
  findById(id: number): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  update(id: number, userData: Partial<User>): Promise<User | null>;
  updateStatus(id: number, status: UserStatus): Promise<void>;
  updateLastSeen(id: number): Promise<void>;
  delete(id: number): Promise<boolean>;
  findAll(searchTerm?: string, limit?: number): Promise<User[]>;
}