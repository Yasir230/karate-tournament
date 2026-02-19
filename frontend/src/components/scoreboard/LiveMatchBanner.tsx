import { Activity, Timer } from 'lucide-react';
import type { Match } from './types';
import { formatTime, getLiveScore, getLiveBreakdown } from './types';

interface LiveMatchBannerProps {
    liveMatch: Match;
    liveScores: any;
    timeRemaining: number | null;
    isTimerRunning: boolean;
}

function BreakdownBadges({ scores, athleteId }: { scores: any; athleteId: string | null }) {
    const bd = getLiveBreakdown(scores, athleteId);
    if (!bd) return null;
    return (
        <div className="flex justify-center gap-1.5 mt-2 flex-wrap">
            <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full">H:{bd.head}</span>
            <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full">B:{bd.body}</span>
            <span className="text-[10px] bg-green-500/20 text-green-300 px-2 py-0.5 rounded-full">P:{bd.punch}</span>
            {bd.fouls > 0 && <span className="text-[10px] bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full">F:{bd.fouls}</span>}
        </div>
    );
}

export default function LiveMatchBanner({ liveMatch, liveScores, timeRemaining, isTimerRunning }: LiveMatchBannerProps) {
    return (
        <div className="glass-card p-6 pulse-glow border-2 border-red-500/30">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Activity size={18} className="text-red-400 animate-pulse" />
                    <h2 className="text-lg font-bold text-white">LIVE NOW</h2>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-400 font-mono">{liveMatch.match_code}</span>
                    {timeRemaining !== null && (
                        <div className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-2xl font-mono font-bold ${isTimerRunning ? 'bg-red-600 text-white' : 'bg-slate-700 text-slate-300'}`}>
                            <Timer size={18} />
                            {formatTime(timeRemaining)}
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-3 gap-4 items-center">
                <div className="text-center">
                    <p className="text-xl font-bold text-white">{(liveMatch as any).athlete1_name || 'TBD'}</p>
                    <p className="text-sm text-slate-400 mt-1">{(liveMatch as any).athlete1_dojo || ''}</p>
                    <div className="text-5xl font-black mt-3 text-red-400">
                        {getLiveScore(liveScores, liveMatch.athlete1_id)}
                    </div>
                    {liveScores && liveMatch.athlete1_id && (
                        <BreakdownBadges scores={liveScores} athleteId={liveMatch.athlete1_id} />
                    )}
                </div>

                <div className="text-center">
                    <span className="text-2xl font-black text-slate-600">VS</span>
                </div>

                <div className="text-center">
                    <p className="text-xl font-bold text-white">{(liveMatch as any).athlete2_name || 'TBD'}</p>
                    <p className="text-sm text-slate-400 mt-1">{(liveMatch as any).athlete2_dojo || ''}</p>
                    <div className="text-5xl font-black mt-3 text-blue-400">
                        {getLiveScore(liveScores, liveMatch.athlete2_id)}
                    </div>
                    {liveScores && liveMatch.athlete2_id && (
                        <BreakdownBadges scores={liveScores} athleteId={liveMatch.athlete2_id} />
                    )}
                </div>
            </div>
        </div>
    );
}
