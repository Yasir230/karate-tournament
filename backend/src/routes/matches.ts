import { Router, Request, Response } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { validate, ScoreInputSchema, WinnerInputSchema } from '../middleware/validators';
import { MatchService } from '../services/matchService';

const router = Router();

// GET /api/matches/:id
router.get('/:id', authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const matchId = req.params.id as string;
  const match = await MatchService.getMatchById(matchId);
  if (!match) {
    res.status(404).json({ error: 'Match not found' });
    return;
  }
  res.json(match);
}));

// POST /api/matches/:id/scores - Update scores
router.post('/:id/scores', authMiddleware, requireRole('ADMIN'), validate(ScoreInputSchema), asyncHandler(async (req: Request, res: Response) => {
  try {
    const { athlete_id, action } = req.body;
    const matchId = req.params.id as string;
    const userId = (req as any).user.id;

    const result = await MatchService.updateScore(matchId, athlete_id, action, userId);

    // Emit socket event for real-time updates
    const io = req.app.get('io');
    if (result && io) {
      io.to(`match:${matchId}`).emit('score-updated', { matchId, eventId: result.event_id, scores: result.scores, match: result });
      io.to(`event:${result.event_id}`).emit('score-updated', { matchId, eventId: result.event_id, scores: result.scores, match: result });
      io.to(`event:${result.event_id}`).emit('match-updated', { matchId, eventId: result.event_id, match: result });
    }

    res.json({ match: result, scores: result?.scores });
  } catch (err: any) {
    if (err.message === 'Match not found') {
      res.status(404).json({ error: err.message });
    } else if (err.message === 'Match already completed') {
      res.status(409).json({ error: err.message });
    } else if (err.message === 'Invalid action') {
      res.status(400).json({ error: err.message });
    } else {
      console.error('Update score error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}));

// POST /api/matches/:id/undo
router.post('/:id/undo', authMiddleware, requireRole('ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  try {
    const matchId = req.params.id as string;
    const result = await MatchService.undoLastAction(matchId);

    // Emit socket event
    const io = req.app.get('io');
    if (result && io) {
      io.to(`match:${matchId}`).emit('score-updated', { matchId, eventId: result.event_id, scores: result.scores, match: result });
      io.to(`event:${result.event_id}`).emit('score-updated', { matchId, eventId: result.event_id, scores: result.scores, match: result });
      io.to(`event:${result.event_id}`).emit('match-updated', { matchId, eventId: result.event_id, match: result });
    }

    res.json({ match: result, scores: result?.scores, message: `Undid action: ${result.undoneAction}` });
  } catch (err: any) {
    if (err.message === 'No actions to undo') {
      res.status(400).json({ error: err.message });
    } else {
      console.error('Undo error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}));

// POST /api/matches/:id/winner
router.post('/:id/winner', authMiddleware, requireRole('ADMIN'), validate(WinnerInputSchema), asyncHandler(async (req: Request, res: Response) => {
  try {
    const { winner_id, method } = req.body;
    const matchId = req.params.id as string;

    const result = await MatchService.setWinner(matchId, winner_id, method);

    // Emit socket event
    const io = req.app.get('io');
    if (result && io) {
      // Include event_id in payload so clients can update bracket view
      const payload = { matchId, eventId: result.event_id, match: result };
      io.to(`match:${matchId}`).emit('match-finished', payload);
      io.to(`event:${result.event_id}`).emit('match-finished', payload);
      io.to(`event:${result.event_id}`).emit('bracket-updated', payload);
    }

    res.json({ match: result, method });
  } catch (err: any) {
    if (err.message === 'Match not found') {
      res.status(404).json({ error: err.message });
    } else {
      console.error('Set winner error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}));

export default router;
