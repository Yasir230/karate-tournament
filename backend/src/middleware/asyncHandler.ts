import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Wraps an async route handler to automatically catch errors
 * and forward them to Express error middleware.
 * Eliminates repetitive try-catch blocks in every route.
 */
export const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>): RequestHandler => {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
