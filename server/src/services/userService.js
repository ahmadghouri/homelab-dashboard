import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { HttpError } from '../utils/httpError.js';
import { hashPassword } from './authService.js';

export function listUsers() {
  return User.find().sort({ createdAt: 1 });
}

async function findUserOrThrow(id) {
  const user = await User.findById(id);
  if (!user) {
    throw new HttpError(404, 'User not found');
  }
  return user;
}

export async function createUser({ name, email, password, role }) {
  if (await User.exists({ email })) {
    throw new HttpError(409, 'A user with this email already exists', {
      email: ['This email is already used'],
    });
  }
  return User.create({ name, email, role, passwordHash: await hashPassword(password) });
}

// The last admin cannot be removed or demoted, or nobody could manage the app.
async function assertNotLastAdmin(user) {
  if (user.role === 'admin' && (await User.countDocuments({ role: 'admin' })) <= 1) {
    throw new HttpError(409, 'There must be at least one admin');
  }
}

export async function updateUser(id, changes, actingUser) {
  const user = await findUserOrThrow(id);
  if (changes.role !== undefined && changes.role !== user.role) {
    if (user.id === actingUser.id) {
      throw new HttpError(409, 'You cannot change your own role');
    }
    await assertNotLastAdmin(user);
    user.role = changes.role;
  }
  if (changes.name !== undefined) {
    user.name = changes.name;
  }
  await user.save();
  return user;
}

export async function deleteUser(id, actingUser) {
  const user = await findUserOrThrow(id);
  if (user.id === actingUser.id) {
    throw new HttpError(409, 'You cannot delete your own account');
  }
  await assertNotLastAdmin(user);
  await user.deleteOne();
}

// Also signs out other sessions: tokens issued before passwordChangedAt stop working.
export async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw new HttpError(400, 'Current password is wrong', {
      currentPassword: ['Current password is wrong'],
    });
  }
  user.passwordHash = await hashPassword(newPassword);
  user.passwordChangedAt = new Date();
  await user.save();
  return user;
}
