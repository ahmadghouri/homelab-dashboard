import { z } from 'zod';
import { USER_ROLES } from '../models/User.js';

const password = z
  .string()
  .min(8, 'Use at least 8 characters')
  .max(200, 'Password is too long');

const name = z.string().trim().min(1, 'Name is required').max(80, 'Name is too long');

export const createUserSchema = z.object({
  name,
  email: z.string().trim().toLowerCase().pipe(z.email('Enter a valid email')),
  password,
  role: z.enum(USER_ROLES),
});

export const updateUserSchema = z
  .object({ name: name.optional(), role: z.enum(USER_ROLES).optional() })
  .refine((value) => value.name !== undefined || value.role !== undefined, {
    message: 'Nothing to update',
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password').max(200),
    newPassword: password,
  })
  .refine((value) => value.currentPassword !== value.newPassword, {
    message: 'The new password must be different',
    path: ['newPassword'],
  });
