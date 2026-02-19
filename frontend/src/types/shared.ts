export interface Athlete {
    id: string;
    name: string;
    dojo: string;
    birth_date?: string;
    weight?: number;
    gender: 'MALE' | 'FEMALE';
    age_class?: 'A' | 'B' | 'C';
    weight_class?: '1' | '2' | '3';
    qr_code?: string;
    status: 'PENDING' | 'VALID' | 'DISQUALIFIED';
    photo_url?: string;
}

export interface Score {
    id: string;
    match_id: string;
    athlete_id: string;
    head_kicks: number;
    body_kicks: number;
    punches: number;
    red_cards: number;
    blue_cards: number;
    fouls: number;
    total_score: number;
    created_at?: string;
    updated_at?: string;
}

export interface Match {
    id: string;
    match_code: string;
    event_id: string;
    athlete1_id: string | null;
    athlete2_id: string | null;
    athlete1_name?: string | null;
    athlete1_dojo?: string | null;
    athlete2_name?: string | null;
    athlete2_dojo?: string | null;
    winner_id: string | null;
    winner_name?: string | null;
    round: number;
    match_order: number;
    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'BYE';
    scores?: Score[];
    updated_at?: string;
    scheduled_time?: string;
}

export interface Event {
    id: string;
    name: string;
    event_code: string;
    status: 'UPCOMING' | 'ONGOING' | 'COMPLETED';
    start_date?: string;
    end_date?: string;
    location?: string;
}

// Utility functions
export const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
};

export const formatTimestamp = (ts: string | undefined) => {
    if (!ts) return '';
    try {
        const d = new Date(ts + 'Z');
        return d.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch { return ts || ''; }
};

export const getLiveScore = (scores: any, athleteId: string | null) => {
    if (!scores || !athleteId) return 0;
    const s = scores[athleteId];
    if (!s) return 0;
    return (s.head_kicks || 0) * 3 + (s.body_kicks || 0) * 2 + (s.punches || 0) * 1 - (s.fouls || 0);
};

export const getLiveBreakdown = (scores: any, athleteId: string | null) => {
    if (!scores || !athleteId) return null;
    const s = scores[athleteId];
    if (!s) return null;
    return { head: s.head_kicks || 0, body: s.body_kicks || 0, punch: s.punches || 0, fouls: s.fouls || 0 };
};

export const getMatchScore = (match: Match, athleteId: string | null) => {
    if (!match.scores || !athleteId) return null;
    return match.scores.find(s => s.athlete_id === athleteId) || null;
};
