import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'karate-tournament-secret-key-2024';

export interface AuthUser {
    id: string;
    username: string;
    role: 'ADMIN' | 'ATHLETE' | 'SPECTATOR';
    athleteId?: string;
}

declare global {
    namespace Express {
        interface Request {
            user?: AuthUser;
        }
    }
}

export function generateToken(user: AuthUser): string {
    return jwt.sign(user, JWT_SECRET, { expiresIn: '24h' });
}

export function verifyToken(token: string): AuthUser {
    return jwt.verify(token, JWT_SECRET) as AuthUser;
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Access token required' });
        return;
    }

    try {
        const token = authHeader.split(' ')[1];
        req.user = verifyToken(token);
        next();
    } catch (err) {
        res.status(401).json({ error: 'Invalid or expired token' });
    }
}

export function requireRole(...roles: string[]) {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (!req.user) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }
        if (!roles.includes(req.user.role)) {
            res.status(403).json({ error: 'Insufficient permissions' });
            return;
        }
        next();
    };
}
