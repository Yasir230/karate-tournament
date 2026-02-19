import { useCallback, useRef } from 'react';

/**
 * Web Audio API-based scoring sound effects
 * No audio files needed — generates tones programmatically
 */
export default function useScoringSound() {
    const audioContextRef = useRef<AudioContext | null>(null);

    const getAudioContext = useCallback(() => {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        return audioContextRef.current;
    }, []);

    const playTone = useCallback((frequency: number, duration: number, type: OscillatorType = 'sine') => {
        try {
            const ctx = getAudioContext();
            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);

            oscillator.type = type;
            oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);

            gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

            oscillator.start(ctx.currentTime);
            oscillator.stop(ctx.currentTime + duration);
        } catch (err) {
            console.warn('Audio playback failed:', err);
        }
    }, [getAudioContext]);

    const playScore = useCallback((type: 'HEAD_KICK' | 'BODY_KICK' | 'PUNCH' | 'RED_CARD' | 'FOUL') => {
        // Context accessed only for type checking if needed, but not used here directly since playTone gets it again.
        // Actually playTone calls getAudioContext inside, so we don't need it here.

        switch (type) {
            case 'HEAD_KICK': // High kick = high tone (3 points)
                playTone(800, 0.15, 'triangle');
                setTimeout(() => playTone(1000, 0.1, 'triangle'), 80);
                setTimeout(() => playTone(1200, 0.1, 'triangle'), 150);
                break;
            case 'BODY_KICK': // Mid tone (2 points)
                playTone(600, 0.15, 'triangle');
                setTimeout(() => playTone(750, 0.1, 'triangle'), 80);
                break;
            case 'PUNCH': // Low tone (1 point)
                playTone(400, 0.12, 'square');
                break;
            case 'RED_CARD': // Warning sound
                playTone(300, 0.2, 'sawtooth');
                setTimeout(() => playTone(280, 0.15, 'sawtooth'), 100);
                break;
            case 'FOUL': // Error buzz
                playTone(200, 0.25, 'sawtooth');
                break;
        }
    }, [getAudioContext, playTone]);

    const playTimerEnd = useCallback(() => {
        // Gong-style sound for timer expiration
        playTone(150, 0.5, 'triangle');
        setTimeout(() => playTone(140, 0.5, 'triangle'), 200);
        setTimeout(() => playTone(130, 0.6, 'triangle'), 400);
    }, [playTone]);

    const playWinner = useCallback(() => {
        // Victory fanfare (ascending tones)
        playTone(523, 0.2, 'sine'); // C
        setTimeout(() => playTone(659, 0.2, 'sine'), 150); // E
        setTimeout(() => playTone(784, 0.3, 'sine'), 300); // G
        setTimeout(() => playTone(1047, 0.5, 'sine'), 450); // C (high)
    }, [playTone]);

    return { playScore, playTimerEnd, playWinner };
}
