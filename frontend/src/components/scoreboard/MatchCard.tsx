import { Trophy, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import type { Match } from './types';
import { getMatchScore, formatTimestamp } from './types';
import { ScoreDetail } from './ScoreBreakdown';

interface MatchCardProps {
    match: Match;
    isExpanded: boolean;
    onToggle: () => void;
}

export function CompletedMatchCard({ match, isExpanded, onToggle }: MatchCardProps) {
    const score1 = getMatchScore(match, match.athlete1_id);
    const score2 = getMatchScore(match, match.athlete2_id);

    return (
        <div className="glass-card p-4 border border-green-500/10 cursor-pointer transition-all hover:border-green-500/30"
            onClick={onToggle}>
            {/* Header */}
            <div className="flex justify-between items-center mb-3">
                <span className="text-[10px] text-slate-500 font-mono">{match.match_code} · Round {match.round}</span>
                <div className="flex items-center gap-2">
                    <span className="badge badge-valid text-[10px]">DONE</span>
                    {isExpanded ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
                </div>
            </div>

            {/* Athletes + Scores */}
            <div className="flex justify-between items-center">
                <div className="flex-1">
                    <p className={`text-sm font-semibold ${match.winner_id === match.athlete1_id ? 'text-green-400' : 'text-slate-400'}`}>
                        {match.winner_id === match.athlete1_id && '🏆 '}{match.athlete1_name || 'TBD'}
                    </p>
                    <p className="text-xs text-slate-500">{match.athlete1_dojo}</p>
                </div>
                <div className="flex items-center gap-3 mx-4">
                    <span className={`text-2xl font-black ${match.winner_id === match.athlete1_id ? 'text-green-400' : 'text-slate-500'}`}>
                        {score1?.total_score ?? 0}
                    </span>
                    <span className="text-xs text-slate-600">—</span>
                    <span className={`text-2xl font-black ${match.winner_id === match.athlete2_id ? 'text-green-400' : 'text-slate-500'}`}>
                        {score2?.total_score ?? 0}
                    </span>
                </div>
                <div className="flex-1 text-right">
                    <p className={`text-sm font-semibold ${match.winner_id === match.athlete2_id ? 'text-green-400' : 'text-slate-400'}`}>
                        {match.winner_id === match.athlete2_id && '🏆 '}{match.athlete2_name || 'TBD'}
                    </p>
                    <p className="text-xs text-slate-500">{match.athlete2_dojo}</p>
                </div>
            </div>

            {/* Winner badge */}
            {match.winner_name && (
                <div className="mt-2 flex items-center gap-1 text-xs text-green-400">
                    <Trophy size={10} /> Winner: <span className="font-bold">{match.winner_name}</span>
                </div>
            )}

            {/* Expanded Score Detail */}
            {isExpanded && (
                <div className="mt-4 pt-4 border-t border-white/10 space-y-4 animate-fade-in">
                    {score1 && (
                        <ScoreDetail athleteName={match.athlete1_name ?? null} score={score1} isWinner={match.winner_id === match.athlete1_id} />
                    )}
                    {score2 && (
                        <ScoreDetail athleteName={match.athlete2_name ?? null} score={score2} isWinner={match.winner_id === match.athlete2_id} />
                    )}
                    {!score1 && !score2 && (
                        <p className="text-xs text-slate-500 text-center py-2">No detailed score data available for this match</p>
                    )}
                    {match.updated_at && (
                        <div className="flex items-center justify-center gap-1 text-[10px] text-slate-500">
                            <Clock size={10} />
                            Match selesai: {formatTimestamp(match.updated_at)}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export function InProgressMatchCard({ match }: { match: Match }) {
    return (
        <div className="glass-card glass-card-hover p-4">
            <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-slate-500 font-mono">{match.match_code}</span>
                <span className="badge badge-pending">LIVE</span>
            </div>
            <div className="flex justify-between items-center">
                <div>
                    <p className="text-sm font-semibold text-white">{match.athlete1_name}</p>
                    <p className="text-xs text-slate-500">{match.athlete1_dojo}</p>
                </div>
                <span className="text-slate-600 font-bold text-sm">VS</span>
                <div className="text-right">
                    <p className="text-sm font-semibold text-white">{match.athlete2_name}</p>
                    <p className="text-xs text-slate-500">{match.athlete2_dojo}</p>
                </div>
            </div>
        </div>
    );
}

export function UpcomingMatchCard({ match }: { match: Match }) {
    return (
        <div className="glass-card p-3">
            <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] text-slate-500 font-mono">{match.match_code}</span>
                <span className="text-[10px] text-slate-500">Round {match.round}</span>
            </div>
            <div className="flex justify-between items-center">
                <span className="text-xs text-white font-medium truncate">{match.athlete1_name || 'TBD'}</span>
                <span className="text-[10px] text-slate-600 mx-2">vs</span>
                <span className="text-xs text-white font-medium truncate text-right">{match.athlete2_name || 'TBD'}</span>
            </div>
        </div>
    );
}
