import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../utils/prisma';
import { signToken } from '../utils/jwt';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';

export const authRouter = Router();

// POST /api/auth/register — Create company + admin user
authRouter.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyName, name, email, password } = req.body;
    if (!companyName || !name || !email || !password) {
      res.status(400).json({ success: false, error: 'All fields required' });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ success: false, error: 'Email already registered' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const company = await prisma.company.create({
      data: {
        name: companyName,
        users: {
          create: { name, email, passwordHash, role: 'ADMIN' },
        },
      },
      include: { users: true },
    });

    const user = company.users[0];
    const token = signToken({ userId: user.id, companyId: company.id, role: user.role });

    res.status(201).json({
      success: true,
      data: {
        token,
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
        company: { id: company.id, name: company.name },
      },
    });
  } catch (err) { next(err); }
});

// POST /api/auth/login
authRouter.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ success: false, error: 'Email and password required' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { company: true },
    });
    if (!user || !user.isActive) {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }

    const token = signToken({ userId: user.id, companyId: user.companyId, role: user.role });

    res.json({
      success: true,
      data: {
        token,
        user: { id: user.id, name: user.name, email: user.email, role: user.role, companyId: user.companyId },
        company: { id: user.company.id, name: user.company.name, logo: user.company.logo },
      },
    });
  } catch (err) { next(err); }
});

// GET /api/auth/me
authRouter.get('/me', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: { company: true },
    });
    if (!user) { res.status(404).json({ success: false, error: 'User not found' }); return; }

    res.json({
      success: true,
      data: {
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
        company: { id: user.company.id, name: user.company.name, logo: user.company.logo },
      },
    });
  } catch (err) { next(err); }
});

// PUT /api/auth/fcm-token
authRouter.put('/fcm-token', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { fcmToken } = req.body;
    await prisma.user.update({ where: { id: req.user!.userId }, data: { fcmToken } });
    res.json({ success: true, message: 'FCM token updated' });
  } catch (err) { next(err); }
});
