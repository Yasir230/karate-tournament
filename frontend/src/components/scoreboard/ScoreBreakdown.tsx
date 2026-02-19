import { Clock } from 'lucide-react';
import type { Score } from './types';
import { formatTimestamp } from './types';

export function ScoreBadges({ score }: { score: Score }) {
    return (
        <div className="flex flex-wrap gap-1.5 mt-1">
            <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full font-medium">
                🦵 Head: {score.head_kicks} ({score.head_kicks * 3}pts)
            </span>
            <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full font-medium">
                🦶 Body: {score.body_kicks} ({score.body_kicks * 2}pts)
            </span>
            <span className="text-[10px] bg-green-500/20 text-green-300 px-2 py-0.5 rounded-full font-medium">
                👊 Punch: {score.punches} ({score.punches}pts)
            </span>
            {score.red_cards > 0 && (
                <span className="text-[10px] bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full font-medium">
                    🟥 Red: {score.red_cards} (-{score.red_cards}pts)
                </span>
            )}
            {score.blue_cards > 0 && (
                <span className="text-[10px] bg-sky-500/20 text-sky-300 px-2 py-0.5 rounded-full font-medium">
                    🟦 Warning: {score.blue_cards}
                </span>
            )}
        </div>
    );
}

interface ScoreDetailProps {
    athleteName: string | null;
    score: Score;
    isWinner: boolean;
}

export function ScoreDetail({ athleteName, score, isWinner }: ScoreDetailProps) {
    return (
        <div className={`p-3 rounded-xl ${isWinner ? 'bg-green-500/5 border border-green-500/20' : 'bg-white/5 border border-white/5'}`}>
            <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-white">{athleteName}</span>
                <span className="text-lg font-black text-white">{score.total_score} pts</span>
            </div>
            <ScoreBadges score={score} />
            <div className="flex items-center gap-1 mt-2 text-[10px] text-slate-500">
                <Clock size={10} />
                Score diinput: {formatTimestamp(score.updated_at)}
            </div>
        </div>
    );
}
