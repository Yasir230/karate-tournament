import { useState, useEffect } from 'react';
import { Trophy, Timer, Users, Wifi, Loader2 } from 'lucide-react';
import { useEvents } from '../hooks/queries';
import useMatchSocket from '../hooks/useMatchSocket';
import SearchBar from '../components/scoreboard/SearchBar';
import LiveMatchBanner from '../components/scoreboard/LiveMatchBanner';
import { CompletedMatchCard, InProgressMatchCard, UpcomingMatchCard } from '../components/scoreboard/MatchCard';

export default function Scoreboard() {
    const { data: events = [], isLoading: eventsLoading } = useEvents();
    const [selectedEvent, setSelectedEvent] = useState('');
    const [expandedMatch, setExpandedMatch] = useState<string | null>(null);

    // Auto-select first event
    useEffect(() => {
        if (!selectedEvent && events.length > 0) {
            setSelectedEvent(events[0].id);
        }
    }, [events, selectedEvent]);

    // All socket/match state via custom hook
    const { matches, liveMatch, liveScores, timeRemaining, isTimerRunning, connectionStatus, isLoading: matchesLoading } = useMatchSocket(selectedEvent);

    const inProgressMatches = matches.filter(m => m.status === 'IN_PROGRESS');
    const upcomingMatches = matches.filter(m => m.status === 'PENDING' && m.athlete1_id && m.athlete2_id);
    const completedMatches = matches.filter(m => m.status === 'COMPLETED');

    if (eventsLoading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-white" size={32} /></div>;

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-red-400 to-amber-400 bg-clip-text text-transparent">
                        🏟️ Live Scoreboard
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">Real-time tournament updates · Score transparency</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${connectionStatus === 'connected' ? 'bg-green-500/15 text-green-400 border border-green-500/30' : 'bg-red-500/15 text-red-400 border border-red-500/30'}`}>
                        <Wifi size={12} className={connectionStatus === 'connected' ? 'animate-pulse' : ''} />
                        {connectionStatus === 'connected' ? 'LIVE' : 'OFFLINE'}
                    </div>
                    {events.length > 0 && (
                        <select value={selectedEvent} onChange={e => setSelectedEvent(e.target.value)}
                            className="input-field w-auto text-sm">
                            {events.map(e => (
                                <option key={e.id} value={e.id}>{e.name}</option>
                            ))}
                        </select>
                    )}
                </div>
            </div>

            {/* Search */}
            <SearchBar matches={matches} />

            {/* Live Match Spotlight */}
            {liveMatch && (
                <LiveMatchBanner
                    liveMatch={liveMatch}
                    liveScores={liveScores}
                    timeRemaining={timeRemaining}
                    isTimerRunning={isTimerRunning}
                />
            )}

            {/* Stats bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="glass-card p-4 text-center">
                    <p className="text-2xl font-bold text-white">{matches.filter(m => m.status !== 'BYE').length}</p>
                    <p className="text-xs text-slate-400">Total Matches</p>
                </div>
                <div className="glass-card p-4 text-center">
                    <p className="text-2xl font-bold text-amber-400">{inProgressMatches.length}</p>
                    <p className="text-xs text-slate-400">In Progress</p>
                </div>
                <div className="glass-card p-4 text-center">
                    <p className="text-2xl font-bold text-green-400">{completedMatches.length}</p>
                    <p className="text-xs text-slate-400">Completed</p>
                </div>
                <div className="glass-card p-4 text-center">
                    <p className="text-2xl font-bold text-slate-400">{upcomingMatches.length}</p>
                    <p className="text-xs text-slate-400">Upcoming</p>
                </div>
            </div>

            {/* Loading Data */}
            {matchesLoading && matches.length === 0 && (
                <div className="flex justify-center p-12"><Loader2 className="animate-spin text-white" size={32} /></div>
            )}

            {/* In Progress */}
            {inProgressMatches.length > 0 && (
                <div>
                    <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" /> In Progress
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {inProgressMatches.map(match => (
                            <InProgressMatchCard key={match.id} match={match} />
                        ))}
                    </div>
                </div>
            )}

            {/* Completed */}
            {completedMatches.length > 0 && (
                <div>
                    <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                        <Trophy size={16} className="text-green-400" /> Completed Results
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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

            {/* Upcoming */}
            {upcomingMatches.length > 0 && (
                <div>
                    <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                        <Timer size={16} className="text-slate-400" /> Upcoming
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {upcomingMatches.slice(0, 12).map(match => (
                            <UpcomingMatchCard key={match.id} match={match} />
                        ))}
                    </div>
                    {upcomingMatches.length > 12 && (
                        <p className="text-xs text-slate-500 mt-2 text-center">
                            +{upcomingMatches.length - 12} more upcoming matches
                        </p>
                    )}
                </div>
            )}

            {/* Empty state */}
            {!matchesLoading && matches.length === 0 && (
                <div className="glass-card p-12 text-center">
                    <Users size={48} className="mx-auto text-slate-600 mb-4" />
                    <h3 className="text-lg text-slate-400 font-semibold">No Matches Yet</h3>
                    <p className="text-sm text-slate-500 mt-1">Select an event with an active bracket to view matches.</p>
                </div>
            )}
        </div>
    );
}
