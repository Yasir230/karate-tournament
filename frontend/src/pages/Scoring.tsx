import { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../lib/api';
import toast from '../lib/toast';
import socket from '../lib/socket';
import useScoringSound from '../hooks/useScoringSound';
import { Swords, Timer, Trophy, AlertTriangle, RotateCcw } from 'lucide-react';
import { useEvents, useMatches } from '../hooks/queries';

export default function Scoring() {
    const [searchParams] = useSearchParams();
    const { data: events = [] } = useEvents();
    const [selectedEvent, setSelectedEvent] = useState(searchParams.get('event') || '');
    const { data: matches = [] } = useMatches(selectedEvent);
    const [selectedMatch, setSelectedMatch] = useState(searchParams.get('match') || '');
    const [matchData, setMatchData] = useState<any>(null);
    const [scores, setScores] = useState<any[]>([]);
    const [timer, setTimer] = useState(120); // 2 minutes
    const [timerRunning, setTimerRunning] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const { playScore, playTimerEnd, playWinner } = useScoringSound();

    const loadMatch = useCallback(async (matchId: string) => {
        const res = await api.get(`/matches/${matchId}`);
        setMatchData(res.data);
        setScores(res.data.scores || []);

        socket.connect();
        socket.emit('join-match', matchId);
        if (selectedEvent) socket.emit('join-event', selectedEvent);
    }, [selectedEvent]);

    useEffect(() => {
        if (selectedMatch) loadMatch(selectedMatch);
        return () => {
            if (selectedMatch) {
                socket.emit('leave-match', selectedMatch);
                socket.disconnect();
            }
        };
    }, [selectedMatch, loadMatch]);

    // Timer
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (timerRunning && timer > 0) {
            interval = setInterval(() => {
                setTimer(t => {
                    const newT = t - 1;
                    socket.emit('timer-update', { matchId: selectedMatch, eventId: selectedEvent, timeRemaining: newT, isRunning: true });
                    return newT;
                });
            }, 1000);
        } else if (timer === 0) {
            setTimerRunning(false);
            playTimerEnd();
        }
        return () => clearInterval(interval);
    }, [timerRunning, timer, selectedMatch, playTimerEnd]);

    const handleScore = async (athleteId: string, action: string) => {
        if (!selectedMatch || isProcessing) return;
        setIsProcessing(true);
        try {
            const res = await api.post(`/matches/${selectedMatch}/scores`, { athlete_id: athleteId, action });
            setMatchData(res.data.match);
            setScores(res.data.scores);
            // Convert scores array to keyed object for spectator scoreboard compatibility
            const scoresByAthlete: Record<string, any> = {};
            for (const s of res.data.scores) { scoresByAthlete[s.athlete_id] = s; }
            socket.emit('score-update', { matchId: selectedMatch, eventId: selectedEvent, scores: scoresByAthlete, match: res.data.match });

            // Play sound based on action
            if (action === 'HEAD_KICK') playScore('HEAD_KICK');
            else if (action === 'BODY_KICK') playScore('BODY_KICK');
            else if (action === 'PUNCH') playScore('PUNCH');
            else if (action === 'RED_CARD') playScore('RED_CARD');
            else if (action === 'FOUL') playScore('FOUL');

        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Score update failed');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSelectWinner = async (winnerId: string, method: string) => {
        if (!confirm(`Confirm winner selection?`) || isProcessing) return;
        setIsProcessing(true);
        try {
            const res = await api.post(`/matches/${selectedMatch}/winner`, { winner_id: winnerId, method });
            setMatchData(res.data.match);
            setTimerRunning(false);
            socket.emit('match-completed', { matchId: selectedMatch, eventId: selectedEvent, match: res.data.match });
            playWinner();
            toast.success('Winner selected! Match completed.');
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleUndo = async () => {
        if (!selectedMatch || isProcessing) return;
        if (!confirm('Undo last action?')) return;

        setIsProcessing(true);
        try {
            const res = await api.post(`/matches/${selectedMatch}/undo`);
            setMatchData(res.data.match);
            setScores(res.data.scores);
            toast.success(res.data.message);

            const scoresByAthlete: Record<string, any> = {};
            for (const s of res.data.scores) { scoresByAthlete[s.athlete_id] = s; }
            socket.emit('score-update', { matchId: selectedMatch, eventId: selectedEvent, scores: scoresByAthlete, match: res.data.match });
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Undo failed');
        } finally {
            setIsProcessing(false);
        }
    };

    const getScore = (athleteId: string) => scores.find(s => s.athlete_id === athleteId) || { head_kicks: 0, body_kicks: 0, punches: 0, red_cards: 0, blue_cards: 0, total_score: 0 };

    const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

    return (
        <div className="space-y-6 animate-fade-in">
            <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Swords size={24} className="text-red-400" /> Scoring</h1>

            {/* Selectors */}
            <div className="flex flex-wrap gap-3">
                <select value={selectedEvent} onChange={e => { setSelectedEvent(e.target.value); setSelectedMatch(''); setMatchData(null); }} className="input-field w-auto">
                    <option value="">Select Event</option>
                    {events.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
                <select value={selectedMatch} onChange={e => setSelectedMatch(e.target.value)} className="input-field w-auto" disabled={!selectedEvent}>
                    <option value="">Select Match</option>
                    {matches.map(m => (
                        <option key={m.id} value={m.id} disabled={m.status === 'COMPLETED'}>
                            {m.match_code} — {m.athlete1_name || 'TBD'} vs {m.athlete2_name || 'TBD'} {m.status === 'COMPLETED' ? '(Done)' : ''}
                        </option>
                    ))}
                </select>
            </div>

            {matchData && matchData.status !== 'COMPLETED' && (
                <>
                    {/* Timer */}
                    <div className="glass-card p-6 text-center">
                        <div className="flex items-center justify-center gap-4 mb-4">
                            <Timer size={24} className="text-amber-400" />
                            <span className={`text-5xl font-mono font-bold ${timer <= 10 ? 'text-red-400 animate-pulse' : 'text-white'}`}>
                                {formatTime(timer)}
                            </span>
                        </div>
                        <div className="flex gap-3 justify-center">
                            <button onClick={() => setTimerRunning(!timerRunning)} className={timerRunning ? 'btn-danger' : 'btn-success'}>
                                {timerRunning ? 'Pause' : 'Start'}
                            </button>
                            <button onClick={() => { setTimer(120); setTimerRunning(false); }} className="btn-secondary">Reset (2:00)</button>
                            <button onClick={() => { setTimer(180); setTimerRunning(false); }} className="btn-secondary">Reset (3:00)</button>
                            <button onClick={handleUndo} disabled={isProcessing} className="btn-danger flex items-center gap-2">
                                <RotateCcw size={16} /> Undo
                            </button>
                        </div>
                    </div>

                    {/* Scoring Area */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {[
                            { id: matchData.athlete1_id, name: matchData.athlete1_name, dojo: matchData.athlete1_dojo, color: 'red' },
                            { id: matchData.athlete2_id, name: matchData.athlete2_name, dojo: matchData.athlete2_dojo, color: 'blue' },
                        ].map((athlete) => {
                            const score = getScore(athlete.id);
                            return (
                                <div key={athlete.id} className={`glass-card p-6 border-t-4 ${athlete.color === 'red' ? 'border-t-red-500' : 'border-t-blue-500'}`}>
                                    <div className="text-center mb-4">
                                        <h3 className="text-xl font-bold text-white">{athlete.name}</h3>
                                        <p className="text-sm text-slate-400">{athlete.dojo}</p>
                                        <p className="text-5xl font-bold mt-2 text-white">{score.total_score}</p>
                                        <p className="text-xs text-slate-500 mt-1">Total Points</p>
                                    </div>

                                    {/* Score breakdown */}
                                    <div className="grid grid-cols-3 gap-2 mb-4 text-center text-xs">
                                        <div className="p-2 rounded-lg bg-white/5">
                                            <p className="text-purple-400 font-bold text-lg">{score.head_kicks}</p>
                                            <p className="text-slate-500">Head</p>
                                        </div>
                                        <div className="p-2 rounded-lg bg-white/5">
                                            <p className="text-blue-400 font-bold text-lg">{score.body_kicks}</p>
                                            <p className="text-slate-500">Body</p>
                                        </div>
                                        <div className="p-2 rounded-lg bg-white/5">
                                            <p className="text-green-400 font-bold text-lg">{score.punches}</p>
                                            <p className="text-slate-500">Punch</p>
                                        </div>
                                    </div>

                                    {/* Action buttons */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <button onClick={() => handleScore(athlete.id, 'HEAD_KICK')} disabled={isProcessing} className="score-btn score-btn-head disabled:opacity-50">
                                            <span>🦵 Head Kick</span><span className="text-sm opacity-75">+3 pts</span>
                                        </button>
                                        <button onClick={() => handleScore(athlete.id, 'BODY_KICK')} disabled={isProcessing} className="score-btn score-btn-body disabled:opacity-50">
                                            <span>🦶 Body Kick</span><span className="text-sm opacity-75">+2 pts</span>
                                        </button>
                                        <button onClick={() => handleScore(athlete.id, 'PUNCH')} disabled={isProcessing} className="score-btn score-btn-punch disabled:opacity-50">
                                            <span>👊 Punch</span><span className="text-sm opacity-75">+1 pt</span>
                                        </button>
                                        <button onClick={() => handleScore(athlete.id, 'RED_CARD')} disabled={isProcessing} className="score-btn score-btn-penalty disabled:opacity-50">
                                            <span>🟥 Red Card</span><span className="text-sm opacity-75">-1 pt</span>
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 mt-3">
                                        <button onClick={() => handleScore(athlete.id, 'BLUE_CARD')} disabled={isProcessing} className="score-btn score-btn-warning text-sm py-3 disabled:opacity-50">
                                            <span>🟦 Warning</span>
                                        </button>
                                        <button onClick={() => handleSelectWinner(athlete.id, 'REFEREE')} disabled={isProcessing || matchData?.status === 'COMPLETED'} className="btn-primary py-3 justify-center text-sm w-full rounded-xl disabled:opacity-50">
                                            <Trophy size={16} /> Declare Winner
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Auto-win checks */}
                    {scores.length === 2 && Math.abs(getScore(matchData.athlete1_id).total_score - getScore(matchData.athlete2_id).total_score) >= 8 && (
                        <div className="glass-card p-4 text-center border border-amber-500/30 bg-amber-500/5">
                            <AlertTriangle size={20} className="mx-auto text-amber-400 mb-2" />
                            <p className="text-amber-400 font-semibold">8-Point Gap Detected!</p>
                            <p className="text-sm text-slate-400">Consider ending the match by point gap rule.</p>
                        </div>
                    )}
                </>
            )}

            {matchData?.status === 'COMPLETED' && (
                <div className="glass-card p-8 text-center">
                    <Trophy size={48} className="mx-auto text-gold mb-4" />
                    <h3 className="text-2xl font-bold text-white mb-2">Match Completed</h3>
                    <p className="text-lg text-green-400">Winner: {matchData.winner_name}</p>
                </div>
            )}

            {!selectedMatch && selectedEvent && matches.length === 0 && (
                <div className="glass-card p-12 text-center text-slate-500">
                    No eligible matches. Generate a bracket first from the Events page.
                </div>
            )}
        </div>
    );
}
