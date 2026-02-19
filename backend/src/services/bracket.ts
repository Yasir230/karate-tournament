import { v4 as uuidv4 } from 'uuid';

// ─── Types ───────────────────────────────────────────────────────────────

interface Athlete {
    id: string;
    name: string;
    [key: string]: any;
}

interface BracketMatch {
    id: string;
    match_code: string;
    event_id: string;
    athlete1_id: string | null;
    athlete2_id: string | null;
    winner_id: string | null;
    round: number;
    match_order: number;
    arena: string;
    status: string;
    parent_match_id: string | null;
    slot: string | null;
}

interface BracketMetadata {
    bracketSize: number;
    totalRounds: number;
    totalMatches: number;
    byeCount: number;
    participantCount: number;
}

// ─── Utility Functions ───────────────────────────────────────────────────

/** Fisher-Yates shuffle */
function shuffle<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

/** Next power of 2 >= n */
function nextPowerOf2(n: number): number {
    if (n <= 1) return 1;
    let p = 1;
    while (p < n) p *= 2;
    return p;
}

/** Check if n is a power of 2 */
function isPowerOf2(n: number): boolean {
    return n > 0 && (n & (n - 1)) === 0;
}

// ─── Fair BYE Distribution ──────────────────────────────────────────────
//
// Uses bit-reversal permutation to spread BYEs evenly across the bracket.
// This mimics how real tournaments seed BYEs: top seeds (positions 1, 2, ...)
// get BYEs first, and BYE positions are maximally separated.
//
// For example, with 8 slots and 5 athletes (3 BYEs):
//   Bit-reversal order for 8 positions: [0, 4, 2, 6, 1, 5, 3, 7]
//   BYE slots (bottom of each match): positions 7, 3, 5 (last 3 in reversed order)
//   This ensures BYEs land at the bottom-half of matches 4, 2, 3 — maximally spread.

/**
 * Generate bit-reversal permutation for `n` positions (n must be power of 2).
 * Returns an array where index i contains the bit-reversed value of i.
 */
function bitReversalPermutation(n: number): number[] {
    const bits = Math.log2(n);
    const result: number[] = [];
    for (let i = 0; i < n; i++) {
        let reversed = 0;
        let val = i;
        for (let b = 0; b < bits; b++) {
            reversed = (reversed << 1) | (val & 1);
            val >>= 1;
        }
        result.push(reversed);
    }
    return result;
}

/**
 * Calculate which first-round slots should be BYEs, distributed fairly.
 * Returns a Set of slot indices (0-based) that should be empty (BYE).
 */
function calculateByeSlots(bracketSize: number, athleteCount: number): Set<number> {
    const byeCount = bracketSize - athleteCount;
    if (byeCount <= 0) return new Set();

    // The bit-reversal permutation gives us the ideal BYE placement order.
    // We place BYEs at the LAST slot of selected matches to ensure:
    //   1. BYEs are maximally spread across the bracket
    //   2. The "stronger" seeds (first placed) avoid BYEs
    const perm = bitReversalPermutation(bracketSize);

    // BYE positions: take the last `byeCount` positions in reversed bit order
    // These correspond to the slots that would receive the lowest seeds
    const byeSlots = new Set<number>();
    for (let i = bracketSize - 1; i >= bracketSize - byeCount; i--) {
        byeSlots.add(perm[i]);
    }

    return byeSlots;
}

// ─── Main Bracket Generator ─────────────────────────────────────────────

/**
 * Generate a single-elimination bracket for any number of athletes (2–512).
 *
 * Supports:
 * - Pre-defined templates: 4, 8, 16, 32, 64, 128, 256, 512
 * - Any custom count (e.g., 47 → pads to 64 with 17 BYEs)
 * - Fair BYE distribution using bit-reversal permutation
 * - Auto-advance of BYE winners through cascading rounds
 *
 * @param athletes Array of athletes to seed into the bracket
 * @param eventId  Event UUID
 * @param eventCode Event code prefix for match codes
 * @returns Array of BracketMatch objects for all rounds
 */
export function generateBracket(
    athletes: Athlete[],
    eventId: string,
    eventCode: string
): BracketMatch[] {
    if (athletes.length < 2) {
        throw new Error('At least 2 athletes are required to generate a bracket');
    }
    if (athletes.length > 512) {
        throw new Error('Maximum 512 athletes supported per bracket');
    }

    const shuffled = shuffle(athletes);
    const bracketSize = nextPowerOf2(shuffled.length);
    const totalRounds = Math.log2(bracketSize);
    const byeSlots = calculateByeSlots(bracketSize, shuffled.length);

    // ── Step 1: Create match structure for all rounds ──

    const matchesByRound: Map<number, BracketMatch[]> = new Map();

    for (let round = totalRounds; round >= 1; round--) {
        const matchesInRound = Math.pow(2, totalRounds - round);
        const roundMatches: BracketMatch[] = [];

        for (let i = 0; i < matchesInRound; i++) {
            const match: BracketMatch = {
                id: uuidv4(),
                match_code: `${eventCode}-R${round}-M${i + 1}`,
                event_id: eventId,
                athlete1_id: null,
                athlete2_id: null,
                winner_id: null,
                round,
                match_order: i + 1,
                arena: String.fromCharCode(65 + (i % 4)), // A, B, C, D rotation
                status: 'PENDING',
                parent_match_id: null,
                slot: null,
            };
            roundMatches.push(match);
        }

        matchesByRound.set(round, roundMatches);
    }

    // ── Step 2: Seed athletes into first round with BYE distribution ──

    const firstRoundMatches = matchesByRound.get(1) || [];

    // Build the seeding array: athletes fill non-BYE slots, BYE slots are null
    const seedSlots: (Athlete | null)[] = new Array(bracketSize).fill(null);
    let athleteIdx = 0;
    for (let slot = 0; slot < bracketSize; slot++) {
        if (!byeSlots.has(slot) && athleteIdx < shuffled.length) {
            seedSlots[slot] = shuffled[athleteIdx++];
        }
        // BYE slots remain null
    }

    // Assign seeded athletes to first-round matches
    for (let slot = 0; slot < bracketSize; slot++) {
        const matchIdx = Math.floor(slot / 2);
        const match = firstRoundMatches[matchIdx];
        const athlete = seedSlots[slot];

        if (athlete) {
            if (slot % 2 === 0) {
                match.athlete1_id = athlete.id;
            } else {
                match.athlete2_id = athlete.id;
            }
        }
    }

    // ── Step 3: Process BYEs in first round ──

    for (const match of firstRoundMatches) {
        if (match.athlete1_id && !match.athlete2_id) {
            // Athlete 1 gets a free pass
            match.winner_id = match.athlete1_id;
            match.status = 'BYE';
        } else if (!match.athlete1_id && match.athlete2_id) {
            // Athlete 2 gets a free pass
            match.winner_id = match.athlete2_id;
            match.status = 'BYE';
        } else if (!match.athlete1_id && !match.athlete2_id) {
            // Double BYE (empty match)
            match.status = 'BYE';
        }
        // Both athletes present → status stays PENDING
    }

    // ── Step 4: Cascade BYE winners through subsequent rounds ──
    //
    // After placing all first-round BYEs, advance winners upward.
    // If two BYE winners meet in a later round, keep advancing
    // (this handles edge cases for very small participant counts).

    for (let round = 1; round < totalRounds; round++) {
        const currentRound = matchesByRound.get(round) || [];
        const nextRound = matchesByRound.get(round + 1) || [];

        for (let i = 0; i < currentRound.length; i++) {
            const match = currentRound[i];
            if (!match.winner_id) continue;

            const nextMatchIdx = Math.floor(i / 2);
            const nextMatch = nextRound[nextMatchIdx];
            if (!nextMatch) continue;

            // Place winner in the correct slot of the parent match
            if (i % 2 === 0) {
                nextMatch.athlete1_id = match.winner_id;
            } else {
                nextMatch.athlete2_id = match.winner_id;
            }

            // Check if the parent match now has a BYE scenario
            // (one athlete present, other feeder match is also a completed BYE)
            if (nextMatch.athlete1_id && nextMatch.athlete2_id) {
                // Both slots filled — normal match, stays PENDING
            } else if (nextMatch.athlete1_id && !nextMatch.athlete2_id) {
                // Check if the other feeder is a double-BYE (no winner)
                const otherIdx = (i % 2 === 0) ? i + 1 : i - 1;
                const otherFeeder = currentRound[otherIdx];
                if (otherFeeder && otherFeeder.status === 'BYE' && !otherFeeder.winner_id) {
                    nextMatch.winner_id = nextMatch.athlete1_id;
                    nextMatch.status = 'BYE';
                }
            } else if (!nextMatch.athlete1_id && nextMatch.athlete2_id) {
                const otherIdx = (i % 2 === 0) ? i + 1 : i - 1;
                const otherFeeder = currentRound[otherIdx];
                if (otherFeeder && otherFeeder.status === 'BYE' && !otherFeeder.winner_id) {
                    nextMatch.winner_id = nextMatch.athlete2_id;
                    nextMatch.status = 'BYE';
                }
            }
        }
    }

    // ── Step 5: Collect all matches in round order ──

    const matches: BracketMatch[] = [];
    for (let round = 1; round <= totalRounds; round++) {
        const roundMatches = matchesByRound.get(round) || [];
        matches.push(...roundMatches);
    }

    return matches;
}

/**
 * Get metadata about a bracket without generating it.
 * Useful for UI to pre-calculate layout dimensions.
 */
export function getBracketMetadata(participantCount: number): BracketMetadata {
    const bracketSize = nextPowerOf2(participantCount);
    const totalRounds = Math.log2(bracketSize);
    const totalMatches = bracketSize - 1; // Single elimination: N-1 matches
    const byeCount = bracketSize - participantCount;

    return {
        bracketSize,
        totalRounds,
        totalMatches,
        byeCount,
        participantCount,
    };
}

/**
 * Validate a bracket template size.
 * Returns true if the size is a valid pre-defined template.
 */
export function isValidTemplateSize(size: number): boolean {
    const validSizes = [4, 8, 16, 32, 64, 128, 256, 512];
    return validSizes.includes(size);
}

export { nextPowerOf2, isPowerOf2, calculateByeSlots, bitReversalPermutation };
