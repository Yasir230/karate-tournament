import { Server, Socket } from 'socket.io';
import db from '../db/database';

export function setupSocketHandlers(io: Server): void {
    io.on('connection', (socket: Socket) => {
        console.log(`🔌 Client connected: ${socket.id}`);

        // Join event room
        socket.on('join-event', (eventId: string) => {
            socket.join(`event:${eventId}`);
            console.log(`📺 ${socket.id} joined event: ${eventId}`);
        });

        // Leave event room
        socket.on('leave-event', (eventId: string) => {
            socket.leave(`event:${eventId}`);
        });

        // Join match room  
        socket.on('join-match', (matchId: string) => {
            socket.join(`match:${matchId}`);
            console.log(`🥊 ${socket.id} joined match: ${matchId}`);
        });

        // Leave match room
        socket.on('leave-match', (matchId: string) => {
            socket.leave(`match:${matchId}`);
        });

        // Score update - broadcast to BOTH match room AND event room
        // This ensures the spectator scoreboard gets instant updates
        socket.on('score-update', (data: { matchId: string; eventId: string; scores: any; match: any }) => {
            // Broadcast to all clients in the match room (except sender)
            socket.to(`match:${data.matchId}`).emit('score-updated', data);
            // Broadcast to all clients in the event room (including scoreboard spectators)
            socket.to(`event:${data.eventId}`).emit('score-updated', data);
            socket.to(`event:${data.eventId}`).emit('match-updated', data);
        });

        // Match completed - broadcast to everyone in both rooms
        socket.on('match-completed', (data: { matchId: string; eventId: string; match: any }) => {
            io.to(`match:${data.matchId}`).emit('match-finished', data);
            io.to(`event:${data.eventId}`).emit('match-finished', data);
            io.to(`event:${data.eventId}`).emit('bracket-updated', data);
        });

        // Timer sync - broadcast to match room AND event room
        // So the spectator scoreboard can also display the live timer
        socket.on('timer-update', (data: { matchId: string; eventId?: string; timeRemaining: number; isRunning: boolean }) => {
            socket.to(`match:${data.matchId}`).emit('timer-sync', data);
            // Also broadcast to event room for spectator scoreboard
            if (data.eventId) {
                socket.to(`event:${data.eventId}`).emit('timer-sync', data);
            }
        });

        socket.on('disconnect', () => {
            console.log(`🔌 Client disconnected: ${socket.id}`);
        });
    });
}
