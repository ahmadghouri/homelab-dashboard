import { createUser, deleteUser, listUsers, updateUser } from '../services/userService.js';

export async function getUsers(req, res) {
  res.json({ users: await listUsers() });
}

export async function postUser(req, res) {
  res.status(201).json({ user: await createUser(req.body) });
}

export async function patchUser(req, res) {
  res.json({ user: await updateUser(req.params.id, req.body, req.user) });
}

export async function removeUser(req, res) {
  await deleteUser(req.params.id, req.user);
  res.status(204).end();
}
