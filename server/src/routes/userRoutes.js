import { Router } from 'express';
import { getUsers, patchUser, postUser, removeUser } from '../controllers/userController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateBody, validateObjectId } from '../middleware/validate.js';
import { createUserSchema, updateUserSchema } from '../validators/userValidators.js';

export const userRoutes = Router();

const validId = validateObjectId('id');

userRoutes.use(requireAuth, requireRole('admin'));
userRoutes.get('/', getUsers);
userRoutes.post('/', validateBody(createUserSchema), postUser);
userRoutes.patch('/:id', validId, validateBody(updateUserSchema), patchUser);
userRoutes.delete('/:id', validId, removeUser);
