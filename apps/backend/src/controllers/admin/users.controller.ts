import type { Request, Response } from 'express';
import { User } from '../../models/User';
import { RefreshToken } from '../../models/RefreshToken';
import { hashPassword } from '../../services/auth.service';
import { ok, created, conflict, notFound, serverError, badRequest } from '../../utils/response';
import type { CreateUserInput, AdminUpdateUserInput, AdminResetPasswordInput } from '../../validation/user.schemas';

export async function listUsers(req: Request, res: Response): Promise<void> {
  try {
    const users = await User.find().sort({ createdAt: -1 }).select('-passwordHash');
    ok(res, users);
  } catch (err) {
    console.error('[admin.users.list]', err);
    serverError(res);
  }
}

export async function createUser(req: Request, res: Response): Promise<void> {
  try {
    const { email, password, username, displayName, role } = req.body as CreateUserInput;

    const existing = await User.findOne({ $or: [{ email: email.toLowerCase() }, { username }] });
    if (existing) {
      if (existing.email === email.toLowerCase()) { conflict(res, 'Email already in use'); return; }
      conflict(res, 'Username already taken');
      return;
    }

    const passwordHash = await hashPassword(password);
    const user = await User.create({
      email: email.toLowerCase(),
      username,
      displayName,
      passwordHash,
      role,
      createdBy: req.user!.id,
    });

    created(res, {
      _id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      createdAt: user.createdAt,
    });
  } catch (err) {
    console.error('[admin.users.create]', err);
    serverError(res);
  }
}

export async function updateUser(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const updates = req.body as AdminUpdateUserInput;

    const user = await User.findByIdAndUpdate(id, updates, { new: true }).select('-passwordHash');
    if (!user) { notFound(res); return; }
    ok(res, user);
  } catch (err) {
    console.error('[admin.users.update]', err);
    serverError(res);
  }
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { newPassword } = req.body as AdminResetPasswordInput;

    const passwordHash = await hashPassword(newPassword);
    const user = await User.findByIdAndUpdate(id, { passwordHash }, { new: true }).select('-passwordHash');
    if (!user) { notFound(res); return; }

    // Revoke all refresh tokens so existing sessions are invalidated.
    await RefreshToken.updateMany(
      { userId: user._id, revokedAt: { $exists: false } },
      { revokedAt: new Date() },
    );

    ok(res, user, 'Password updated');
  } catch (err) {
    console.error('[admin.users.resetPassword]', err);
    serverError(res);
  }
}

export async function deactivateUser(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    if (id === req.user!.id) {
      badRequest(res, 'Cannot deactivate yourself');
      return;
    }
    const user = await User.findByIdAndUpdate(id, { isActive: false }, { new: true }).select('-passwordHash');
    if (!user) { notFound(res); return; }
    ok(res, user, 'User deactivated');
  } catch (err) {
    console.error('[admin.users.deactivate]', err);
    serverError(res);
  }
}
