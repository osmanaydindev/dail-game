import { Router } from 'express';
import { listUsers, createUser, updateUser, resetPassword, deactivateUser } from '../../controllers/admin/users.controller';
import { validate } from '../../middleware/validate';
import { createUserSchema, adminUpdateUserSchema, adminResetPasswordSchema } from '../../validation/user.schemas';

const router = Router();

router.get('/', listUsers);
router.post('/', validate(createUserSchema), createUser);
router.patch('/:id', validate(adminUpdateUserSchema), updateUser);
router.patch('/:id/password', validate(adminResetPasswordSchema), resetPassword);
router.delete('/:id', deactivateUser);

export default router;
