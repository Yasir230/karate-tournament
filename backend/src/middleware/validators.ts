import { z } from 'zod';
import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Creates Express middleware that validates req.body against a Zod schema.
 * Returns 400 with descriptive error messages on validation failure.
 */
export const validate = (schema: z.ZodSchema): RequestHandler => {
    return (req: Request, res: Response, next: NextFunction) => {
        const result = schema.safeParse(req.body);
        if (!result.success) {
            const errors = result.error.issues.map((e: any) => `${e.path.join('.')}: ${e.message}`);
            res.status(400).json({ error: 'Validation failed', details: errors });
            return;
        }
        req.body = result.data;
        next();
    };
};

// === Zod Schemas ===

const SCORE_ACTIONS = [
    'HEAD_KICK', 'BODY_KICK', 'PUNCH', 'RED_CARD', 'BLUE_CARD', 'FOUL',
    'UNDO_HEAD_KICK', 'UNDO_BODY_KICK', 'UNDO_PUNCH',
] as const;

export const ScoreInputSchema = z.object({
    athlete_id: z.string().min(1, 'athlete_id is required'),
    action: z.enum(SCORE_ACTIONS),
});

const WIN_METHODS = ['SCORE', 'POINT_GAP', 'DQ', 'REFEREE'] as const;

export const WinnerInputSchema = z.object({
    winner_id: z.string().min(1, 'winner_id is required'),
    method: z.enum(WIN_METHODS),
});

const GENDERS = ['MALE', 'FEMALE'] as const;

export const AthleteInputSchema = z.object({
    name: z.string().min(1, 'Name is required').max(100),
    dojo: z.string().min(1, 'Dojo is required').max(100),
    birth_date: z.string().optional(),
    weight: z.string().optional(),
    gender: z.enum(GENDERS),
});

export const EventInputSchema = z.object({
    name: z.string().min(1, 'Event name is required').max(200),
    start_date: z.string().optional(),
    end_date: z.string().optional(),
    location: z.string().optional(),
});
