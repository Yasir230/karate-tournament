import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import type { Event, Athlete, Match } from '../components/scoreboard/types';

// === EVENTS ===
export const useEvents = () => {
    return useQuery<Event[]>({
        queryKey: ['events'],
        queryFn: async () => {
            const res = await api.get('/events');
            return res.data;
        },
    });
};

export const useEvent = (id: string) => {
    return useQuery<Event>({
        queryKey: ['events', id],
        queryFn: async () => {
            const res = await api.get(`/events/${id}`);
            return res.data;
        },
        enabled: !!id,
    });
};

export const useCreateEvent = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: Partial<Event>) => api.post('/events', data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['events'] });
        },
    });
};

// === ATHLETES ===
export const useAthletes = () => {
    return useQuery<Athlete[]>({
        queryKey: ['athletes'],
        queryFn: async () => {
            const res = await api.get('/athletes');
            return res.data;
        },
    });
};

export const useCreateAthlete = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: Partial<Athlete>) => api.post('/athletes', data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['athletes'] });
        },
    });
};

// === MATCHES ===
export const useMatches = (eventId: string) => {
    return useQuery<Match[]>({
        queryKey: ['matches', eventId],
        queryFn: async () => {
            const res = await api.get(`/events/${eventId}/matches`);
            return res.data; // Ensure backend returns array
        },
        enabled: !!eventId,
    });
};

export const useMatch = (matchId: string) => {
    return useQuery<Match>({
        queryKey: ['match', matchId],
        queryFn: async () => {
            const res = await api.get(`/matches/${matchId}`);
            return res.data;
        },
        enabled: !!matchId,
    });
};
