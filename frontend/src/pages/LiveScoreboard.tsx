import { useState, useEffect } from 'react';
import { Trophy, Activity, Users, Loader2 } from 'lucide-react';
import { useEvents } from '../hooks/queries';
import useMatchSocket from '../hooks/useMatchSocket';
import LiveMatchBanner from '../components/scoreboard/LiveMatchBanner';
import { CompletedMatchCard } from '../components/scoreboard/MatchCard';

/**
 * Public Live Scoreboard — No login required
 * Optimized fullscreen view for spectators
 */
export default function LiveScoreboard() {
    const { data: events = [], isLoading: eventsLoading } = useEvents();
    const [selectedEvent, setSelectedEvent] = useState('');
    const [expandedMatch, setExpandedMatch] = useState<string | null>(null);

    useEffect(() => {
        if (!selectedEvent && events.length > 0) {
            setSelectedEvent(events[0].id);
        }
    }, [events, selectedEvent]);

    const { matches, liveMatch, liveScores, timeRemaining, isTimerRunning, connectionStatus, isLoading } = useMatchSocket(selectedEvent);

    const completedMatches = matches.filter(m => m.status === 'COMPLETED').slice(0, 6); // Latest 6 results
    const totalMatches = matches.filter(m => m.status !== 'BYE').length;
    const completedCount = matches.filter(m => m.status === 'COMPLETED').length;

    if (eventsLoading) return <div className="h-screen flex items-center justify-center bg-slate-900"><Loader2 className="animate-spin text-white" size={48} /></div>;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <div className="text-center">
                    <h1 className="text-5xl font-black bg-gradient-to-r from-red-400 via-amber-400 to-red-400 bg-clip-text text-transparent mb-2">
                        🥋 LIVE TOURNAMENT
                    </h1>
                    <p className="text-slate-400 text-lg">Real-time scoring · Public view</p>

                    <div className="flex items-center justify-center gap-4 mt-4">
                        <div className={`px-4 py-2 rounded-full text-sm font-bold ${connectionStatus === 'connected' ? 'bg-green-500/20 text-green-400 border-2 border-green-500/50 animate-pulse' : 'bg-red-500/20 text-red-400 border-2 border-red-500/50'}`}>
                            {connectionStatus === 'connected' ? '🔴 LIVE' : '⚫ OFFLINE'}
                        </div>

                        {events.length > 0 && (
                            <select
                                value={selectedEvent}
                                onChange={e => setSelectedEvent(e.target.value)}
                                className="bg-slate-800/50 border-2 border-slate-700 text-white px-4 py-2 rounded-xl font-semibold text-sm focus:outline-none focus:border-amber-500 transition-colors">
                                {events.map(e => (
                                    <option key={e.id} value={e.id}>{e.name}</option>
                                ))}
                            </select>
                        )}
                    </div>
                </div>

                {/* Stats Bar */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="glass-card p-6 text-center border-2 border-white/10">
                        <p className="text-4xl font-black text-white">{totalMatches}</p>
                        <p className="text-sm text-slate-400 mt-1">Total Matches</p>
                    </div>
                    <div className="glass-card p-6 text-center border-2 border-green-500/30">
                        <p className="text-4xl font-black text-green-400">{completedCount}</p>
                        <p className="text-sm text-slate-400 mt-1">Completed</p>
                    </div>
                </div>

                {/* Live Match (Large) */}
                {liveMatch ? (
                    <div className="animate-fade-in">
                        <LiveMatchBanner
                            liveMatch={liveMatch}
                            liveScores={liveScores}
                            timeRemaining={timeRemaining}
                            isTimerRunning={isTimerRunning}
                        />
                    </div>
                ) : (
                    <div className="glass-card p-16 text-center border-2 border-slate-700/50">
                        <Activity size={64} className="mx-auto text-slate-600 mb-4 animate-pulse" />
                        <h3 className="text-2xl text-slate-400 font-bold">No Live Match</h3>
                        <p className="text-slate-500 mt-2">Waiting for the next match to start...</p>
                    </div>
                )}

                {/* Recent Results */}
                {completedMatches.length > 0 && (
                    <div>
                        <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                            <Trophy size={24} className="text-green-400" />
                            Recent Results
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {completedMatches.map(match => (
                                <CompletedMatchCard
                                    key={match.id}
                                    match={match}
                                    isExpanded={expandedMatch === match.id}
                                    onToggle={() => setExpandedMatch(expandedMatch === match.id ? null : match.id)}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* Empty State */}
                {!liveMatch && completedMatches.length === 0 && matches.length === 0 && !isLoading && (
                    <div className="glass-card p-16 text-center">
                        <Users size={64} className="mx-auto text-slate-600 mb-4" />
                        <h3 className="text-2xl text-slate-400 font-bold">Tournament Not Started</h3>
                        <p className="text-slate-500 mt-2">Select an active event to view live matches</p>
                    </div>
                )}

                {/* Footer */}
                <div className="text-center text-slate-600 text-sm pt-8 border-t border-slate-800">
                    <p>Karate Tournament Management System · Live Scoreboard</p>
                    <p className="text-xs mt-1">Updates automatically in real-time via WebSocket</p>
                </div>
            </div>
        </div>
    );
}
