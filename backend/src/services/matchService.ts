import { v4 as uuidv4 } from 'uuid';
import { query, withTransaction } from '../db/database';

export class MatchService {
    static async getMatchById(matchId: string) {
        const matchResult = await query(`
            SELECT m.*, 
                a1.name as athlete1_name, a1.dojo as athlete1_dojo,
                a2.name as athlete2_name, a2.dojo as athlete2_dojo,
                w.name as winner_name
            FROM matches m
            LEFT JOIN athletes a1 ON m.athlete1_id = a1.id
            LEFT JOIN athletes a2 ON m.athlete2_id = a2.id
            LEFT JOIN athletes w ON m.winner_id = w.id
            WHERE m.id = $1
        `, [matchId]);

        const match = matchResult.rows[0];
        if (!match) return null;

        const scoresResult = await query('SELECT * FROM scores WHERE match_id = $1', [matchId]);
        return { ...match, scores: scoresResult.rows };
    }

    static async updateScore(matchId: string, athleteId: string, action: string, userId: string) {
        await withTransaction(async (client) => {
            const matchResult = await client.query('SELECT * FROM matches WHERE id = $1', [matchId]);
            const match = matchResult.rows[0];

            if (!match) throw new Error('Match not found');
            if (match.status === 'COMPLETED') throw new Error('Match already completed');

            if (match.status === 'PENDING') {
                await client.query("UPDATE matches SET status = 'IN_PROGRESS', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [matchId]);
            }

            let scoreResult = await client.query('SELECT * FROM scores WHERE match_id = $1 AND athlete_id = $2', [matchId, athleteId]);
            let score = scoreResult.rows[0];

            if (!score) {
                const scoreId = uuidv4();
                await client.query(`INSERT INTO scores (id, match_id, athlete_id) VALUES ($1, $2, $3)`, [scoreId, matchId, athleteId]);
                scoreResult = await client.query('SELECT * FROM scores WHERE id = $1', [scoreId]);
                score = scoreResult.rows[0];
            }

            const oldScore = { ...score };
            const actionMap: Record<string, string> = {
                'HEAD_KICK': 'UPDATE scores SET head_kicks = head_kicks + 1 WHERE id = $1',
                'BODY_KICK': 'UPDATE scores SET body_kicks = body_kicks + 1 WHERE id = $1',
                'PUNCH': 'UPDATE scores SET punches = punches + 1 WHERE id = $1',
                'RED_CARD': 'UPDATE scores SET red_cards = red_cards + 1 WHERE id = $1',
                'BLUE_CARD': 'UPDATE scores SET blue_cards = blue_cards + 1 WHERE id = $1',
                'FOUL': 'UPDATE scores SET fouls = fouls + 1 WHERE id = $1',
            };

            if (actionMap[action]) {
                await client.query(actionMap[action], [score.id]);
            } else {
                throw new Error('Invalid action');
            }

            // Recalculate total
            await client.query(`
                UPDATE scores SET total_score = (head_kicks * 3) + (body_kicks * 2) + (punches * 1) - (red_cards * 1),
                updated_at = CURRENT_TIMESTAMP WHERE id = $1
            `, [score.id]);

            const newScoreResult = await client.query('SELECT * FROM scores WHERE id = $1', [score.id]);
            const newScore = newScoreResult.rows[0];

            // Audit Log
            await client.query(`
                INSERT INTO score_audit_log (match_id, athlete_id, action, old_value, new_value, performed_by)
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [matchId, athleteId, action, oldScore.total_score, newScore.total_score, userId]);
        });

        // Fetch fresh data after transaction commit
        return this.getMatchById(matchId);
    }

    static async undoLastAction(matchId: string) {
        let undoneAction = '';

        await withTransaction(async (client) => {
            const lastLogResult = await client.query('SELECT * FROM score_audit_log WHERE match_id = $1 ORDER BY id DESC LIMIT 1', [matchId]);
            const lastLog = lastLogResult.rows[0];

            if (!lastLog) throw new Error('No actions to undo');

            const { athlete_id, action, id } = lastLog;
            undoneAction = action;

            const reverseMap: Record<string, string> = {
                'HEAD_KICK': 'head_kicks', 'BODY_KICK': 'body_kicks', 'PUNCH': 'punches',
                'RED_CARD': 'red_cards', 'BLUE_CARD': 'blue_cards', 'FOUL': 'fouls'
            };

            const column = reverseMap[action];
            if (column) {
                // GREATEST(0, ...) is Postgres equivalent of MAX(0, ...)
                await client.query(`UPDATE scores SET ${column} = GREATEST(0, ${column} - 1) WHERE match_id = $1 AND athlete_id = $2`, [matchId, athlete_id]);

                await client.query(`
                    UPDATE scores SET total_score = (head_kicks * 3) + (body_kicks * 2) + (punches * 1) - (red_cards * 1),
                    updated_at = CURRENT_TIMESTAMP WHERE match_id = $1 AND athlete_id = $2
                `, [matchId, athlete_id]);

                await client.query('DELETE FROM score_audit_log WHERE id = $1', [id]);
            }
        });

        const match = await this.getMatchById(matchId);
        return { ...match, undoneAction };
    }

    static async setWinner(matchId: string, winnerId: string, method: string) {
        await withTransaction(async (client) => {
            const matchResult = await client.query('SELECT * FROM matches WHERE id = $1', [matchId]);
            const match = matchResult.rows[0];
            if (!match) throw new Error('Match not found');

            await client.query("UPDATE matches SET winner_id = $1, status = 'COMPLETED', updated_at = CURRENT_TIMESTAMP WHERE id = $2", [winnerId, matchId]);

            // Auto-advance logic
            // Check if there are matches in the next round using client
            const nextRound = match.round + 1;
            const nextMatchesResult = await client.query('SELECT * FROM matches WHERE event_id = $1 AND round = $2', [match.event_id, nextRound]);

            if (nextMatchesResult.rows.length > 0) {
                // Formula: next_match_index = floor((current_order - 1) / 2)
                const nextMatchIdx = Math.floor((match.match_order - 1) / 2);
                const nextOrder = nextMatchIdx + 1;

                const targetMatchResult = await client.query('SELECT * FROM matches WHERE event_id = $1 AND round = $2 AND match_order = $3', [match.event_id, nextRound, nextOrder]);
                const targetMatch = targetMatchResult.rows[0];

                if (targetMatch) {
                    const slot = (match.match_order % 2 === 1) ? 'athlete1_id' : 'athlete2_id';
                    await client.query(`UPDATE matches SET ${slot} = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [winnerId, targetMatch.id]);
                }
            }

            // Check Event Completion
            const remainingResult = await client.query("SELECT COUNT(*) as count FROM matches WHERE event_id = $1 AND status != 'COMPLETED' AND status != 'BYE'", [match.event_id]);
            // parseInt because COUNT returns string in pg
            const remainingCount = parseInt(remainingResult.rows[0].count, 10);

            if (remainingCount === 0) {
                await client.query("UPDATE events SET status = 'COMPLETED' WHERE id = $1", [match.event_id]);
            }
        });

        return this.getMatchById(matchId);
    }
}
