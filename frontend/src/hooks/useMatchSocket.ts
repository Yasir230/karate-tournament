import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import socket from '../lib/socket';
import { useMatches } from './queries';
import type { Match } from '../components/scoreboard/types';

interface UseMatchSocketReturn {
    matches: Match[];
    liveMatch: Match | null;
    liveScores: any;
    timeRemaining: number | null;
    isTimerRunning: boolean;
    connectionStatus: 'connected' | 'disconnected';
    isLoading: boolean;
}

export default function useMatchSocket(selectedEvent: string): UseMatchSocketReturn {
    const queryClient = useQueryClient();
    const { data: matches = [], isLoading } = useMatches(selectedEvent);

    const [liveMatch, setLiveMatch] = useState<Match | null>(null);
    const [liveScores, setLiveScores] = useState<any>(null);
    const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
    const [isTimerRunning, setIsTimerRunning] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected'>('disconnected');

    // Socket.IO connection & event handlers
    useEffect(() => {
        if (!selectedEvent) return;

        socket.connect();
        socket.emit('join-event', selectedEvent);
        setConnectionStatus(socket.connected ? 'connected' : 'disconnected');

        const onConnect = () => setConnectionStatus('connected');
        const onDisconnect = () => setConnectionStatus('disconnected');

        const onScoreUpdated = (data: any) => {
            let normalizedScores = data.scores;
            if (Array.isArray(data.scores)) {
                normalizedScores = {} as Record<string, any>;
                data.scores.forEach((s: any) => { normalizedScores[s.athlete_id] = s; });
            }
            setLiveScores(normalizedScores);
            setLiveMatch(data.match);

            // Allow immediate UI update for scores without refetching entire list yet
            // But we can also optimize by updating the match in the cache if needed
            // queryClient.setQueryData(['matches', selectedEvent], (old: Match[]) => ... )
        };

        const onMatchFinished = () => {
            queryClient.invalidateQueries({ queryKey: ['matches', selectedEvent] });
            setLiveMatch(null);
            setLiveScores(null);
            setTimeRemaining(null);
        };

        const onTimerSync = (data: any) => {
            setTimeRemaining(data.timeRemaining);
            setIsTimerRunning(data.isRunning);
        };

        const onBracketUpdated = () => {
            queryClient.invalidateQueries({ queryKey: ['matches', selectedEvent] });
        };

        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);
        socket.on('score-update', onScoreUpdated); // Note: server emits 'score-update' (client) vs 'score-updated' (server)? Check backend/socket.
        socket.on('match-finished', onMatchFinished);
        socket.on('timer-sync', onTimerSync);
        socket.on('bracket-updated', onBracketUpdated);
        socket.on('match-updated', onBracketUpdated);

        return () => {
            socket.emit('leave-event', selectedEvent);
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
            socket.off('score-update', onScoreUpdated);
            socket.off('match-finished', onMatchFinished);
            socket.off('timer-sync', onTimerSync);
            socket.off('bracket-updated', onBracketUpdated);
            socket.off('match-updated', onBracketUpdated);
        };
    }, [selectedEvent, queryClient]);

    return { matches, liveMatch, liveScores, timeRemaining, isTimerRunning, connectionStatus, isLoading };
}
