import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ZoomIn, ZoomOut, Maximize, Minimize, Move, RotateCcw, Layers } from 'lucide-react';

interface BracketMatch {
    id: string;
    match_code: string;
    athlete1_id: string | null;
    athlete2_id: string | null;
    athlete1_name: string | null;
    athlete1_dojo: string | null;
    athlete2_name: string | null;
    athlete2_dojo: string | null;
    winner_id: string | null;
    winner_name: string | null;
    round: number;
    match_order: number;
    status: string;
}

interface BracketViewerProps {
    matches: BracketMatch[];
    eventId: string;
    onClose?: () => void;
}

const MATCH_WIDTH = 210;
const MATCH_HEIGHT = 68;
const ROUND_GAP = 60;
const MATCH_V_GAP = 16;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 2.0;

export default function BracketViewer({ matches, eventId, onClose }: BracketViewerProps) {
    const navigate = useNavigate();
    const containerRef = useRef<HTMLDivElement>(null);
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showMinimap, setShowMinimap] = useState(true);
    const [collapsedRounds, setCollapsedRounds] = useState<Set<number>>(new Set());

    const maxRound = matches.length > 0 ? Math.max(...matches.map(m => m.round)) : 0;

    // Round labels
    const roundLabels: Record<number, string> = {};
    for (let r = 1; r <= maxRound; r++) {
        if (r === maxRound) roundLabels[r] = 'Final';
        else if (r === maxRound - 1) roundLabels[r] = 'Semi-Final';
        else if (r === maxRound - 2) roundLabels[r] = 'Quarter-Final';
        else roundLabels[r] = `Round ${r}`;
    }

    // Calculate total bracket dimensions
    const firstRoundMatches = matches.filter(m => m.round === 1).length;
    const totalWidth = maxRound * (MATCH_WIDTH + ROUND_GAP) + ROUND_GAP;
    const totalHeight = firstRoundMatches * (MATCH_HEIGHT + MATCH_V_GAP) + 60;

    // Auto-fit zoom on first render for large brackets
    useEffect(() => {
        if (containerRef.current && matches.length > 0) {
            const container = containerRef.current;
            const scaleX = (container.clientWidth - 40) / totalWidth;
            const scaleY = (container.clientHeight - 40) / totalHeight;
            const fitZoom = Math.min(scaleX, scaleY, 1);
            setZoom(Math.max(fitZoom, MIN_ZOOM));
            // Center the bracket
            setPan({
                x: Math.max(0, (container.clientWidth - totalWidth * fitZoom) / 2),
                y: 20,
            });
        }
    }, [matches.length, totalWidth, totalHeight]);

    // Zoom controls
    const handleZoom = useCallback((delta: number) => {
        setZoom(z => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z + delta)));
    }, []);

    const resetView = useCallback(() => {
        if (containerRef.current) {
            const container = containerRef.current;
            const scaleX = (container.clientWidth - 40) / totalWidth;
            const scaleY = (container.clientHeight - 40) / totalHeight;
            const fitZoom = Math.min(scaleX, scaleY, 1);
            setZoom(Math.max(fitZoom, MIN_ZOOM));
            setPan({
                x: Math.max(0, (container.clientWidth - totalWidth * fitZoom) / 2),
                y: 20,
            });
        }
    }, [totalWidth, totalHeight]);

    // Mouse wheel zoom
    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.08 : 0.08;
        handleZoom(delta);
    }, [handleZoom]);

    // Pan handlers
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (e.button === 0) {
            setIsPanning(true);
            setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
        }
    }, [pan]);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (isPanning) {
            setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
        }
    }, [isPanning, dragStart]);

    const handleMouseUp = useCallback(() => {
        setIsPanning(false);
    }, []);

    // Touch handlers for mobile pinch-zoom and pan
    const lastTouchRef = useRef<{ dist: number; x: number; y: number } | null>(null);

    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        if (e.touches.length === 1) {
            setIsPanning(true);
            setDragStart({ x: e.touches[0].clientX - pan.x, y: e.touches[0].clientY - pan.y });
        } else if (e.touches.length === 2) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            lastTouchRef.current = {
                dist: Math.hypot(dx, dy),
                x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
                y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
            };
        }
    }, [pan]);

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        if (e.touches.length === 1 && isPanning) {
            setPan({
                x: e.touches[0].clientX - dragStart.x,
                y: e.touches[0].clientY - dragStart.y,
            });
        } else if (e.touches.length === 2 && lastTouchRef.current) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const newDist = Math.hypot(dx, dy);
            const scaleFactor = newDist / lastTouchRef.current.dist;
            setZoom(z => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z * scaleFactor)));
            lastTouchRef.current.dist = newDist;
        }
    }, [isPanning, dragStart]);

    const handleTouchEnd = useCallback(() => {
        setIsPanning(false);
        lastTouchRef.current = null;
    }, []);

    // Toggle fullscreen
    const toggleFullscreen = useCallback(() => {
        setIsFullscreen(f => !f);
    }, []);

    // Toggle round collapse (accordion for large brackets)
    const toggleRound = (round: number) => {
        setCollapsedRounds(prev => {
            const next = new Set(prev);
            if (next.has(round)) next.delete(round);
            else next.add(round);
            return next;
        });
    };

    // Calculate match position
    const getMatchPosition = (round: number, matchOrder: number) => {
        const matchesInRound = matches.filter(m => m.round === round).length;
        const firstRoundCount = matches.filter(m => m.round === 1).length;
        const totalSlotHeight = MATCH_HEIGHT + MATCH_V_GAP;

        // Each round's matches are centered relative to the first round
        const roundSpacing = firstRoundCount / matchesInRound;
        const y = (matchOrder - 1) * roundSpacing * totalSlotHeight + (roundSpacing - 1) * totalSlotHeight / 2 + 40;
        const x = (round - 1) * (MATCH_WIDTH + ROUND_GAP) + ROUND_GAP / 2;

        return { x, y };
    };

    // Generate connector lines between rounds
    const renderConnectors = () => {
        const lines: React.ReactNode[] = [];
        for (let round = 1; round < maxRound; round++) {
            const roundMatches = matches.filter(m => m.round === round);
            for (let i = 0; i < roundMatches.length; i += 2) {
                const m1 = roundMatches[i];
                const m2 = roundMatches[i + 1];
                if (!m1) continue;

                const pos1 = getMatchPosition(round, m1.match_order);
                const nextMatchOrder = Math.ceil(m1.match_order / 2);
                const posNext = getMatchPosition(round + 1, nextMatchOrder);

                const x1 = pos1.x + MATCH_WIDTH;
                const y1 = pos1.y + MATCH_HEIGHT / 2;
                const y2 = m2 ? getMatchPosition(round, m2.match_order).y + MATCH_HEIGHT / 2 : y1;
                const xMid = x1 + ROUND_GAP / 2;
                const xEnd = posNext.x;
                const yMid = posNext.y + MATCH_HEIGHT / 2;

                // Horizontal line from match 1
                lines.push(
                    <line key={`h1-${m1.id}`} x1={x1} y1={y1} x2={xMid} y2={y1}
                        stroke="rgba(148,163,184,0.25)" strokeWidth={1.5} />
                );
                // Horizontal line from match 2
                if (m2) {
                    lines.push(
                        <line key={`h2-${m2.id}`} x1={x1} y1={y2} x2={xMid} y2={y2}
                            stroke="rgba(148,163,184,0.25)" strokeWidth={1.5} />
                    );
                }
                // Vertical connector
                lines.push(
                    <line key={`v-${m1.id}`} x1={xMid} y1={y1} x2={xMid} y2={m2 ? y2 : y1}
                        stroke="rgba(148,163,184,0.25)" strokeWidth={1.5} />
                );
                // Horizontal to next round
                lines.push(
                    <line key={`hn-${m1.id}`} x1={xMid} y1={yMid} x2={xEnd} y2={yMid}
                        stroke="rgba(148,163,184,0.25)" strokeWidth={1.5} />
                );
            }
        }
        return lines;
    };

    return (
        <div className={`${isFullscreen ? 'fixed inset-0 z-[100] bg-surface' : 'relative'} flex flex-col`}>
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-surface-light/80 backdrop-blur-sm z-10 flex-shrink-0">
                <div className="flex items-center gap-2">
                    <Layers size={18} className="text-red-400" />
                    <h3 className="text-lg font-bold text-white">Tournament Bracket</h3>
                    <span className="badge badge-pending text-xs">{matches.filter(m => m.status !== 'BYE').length} matches</span>
                    {firstRoundMatches > 16 && (
                        <span className="text-xs text-slate-500">({firstRoundMatches * 2} slots)</span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 bg-white/5 rounded-lg px-2 py-1 border border-white/10">
                        <button onClick={() => handleZoom(-0.1)} className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white transition-colors"><ZoomOut size={16} /></button>
                        <span className="text-xs text-slate-400 w-12 text-center font-mono">{Math.round(zoom * 100)}%</span>
                        <button onClick={() => handleZoom(0.1)} className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white transition-colors"><ZoomIn size={16} /></button>
                    </div>
                    <button onClick={resetView} className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors" title="Reset view"><RotateCcw size={16} /></button>
                    {firstRoundMatches > 16 && (
                        <button onClick={() => setShowMinimap(m => !m)} className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors" title="Toggle minimap"><Move size={16} /></button>
                    )}
                    <button onClick={toggleFullscreen} className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors" title="Toggle fullscreen">
                        {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
                    </button>
                    {onClose && (
                        <button onClick={onClose} className="btn-secondary text-xs py-1.5 px-3 ml-2">Close</button>
                    )}
                </div>
            </div>

            {/* Round headers */}
            <div className="flex px-4 py-2 border-b border-white/5 bg-surface/60 flex-shrink-0 overflow-hidden">
                <div style={{ transform: `translateX(${pan.x}px) scaleX(${zoom})`, transformOrigin: '0 0', display: 'flex', whiteSpace: 'nowrap' }}>
                    {Array.from({ length: maxRound }, (_, i) => i + 1).map(round => (
                        <div key={round} style={{ width: MATCH_WIDTH + ROUND_GAP, flexShrink: 0 }}
                            className="text-center cursor-pointer" onClick={() => toggleRound(round)}>
                            <span className={`text-xs font-semibold uppercase tracking-wider ${collapsedRounds.has(round) ? 'text-slate-600' : 'text-slate-400'}`}>
                                {roundLabels[round]} {collapsedRounds.has(round) ? '▸' : ''}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Bracket Canvas */}
            <div
                ref={containerRef}
                className={`flex-1 overflow-hidden ${isPanning ? 'cursor-grabbing' : 'cursor-grab'} ${isFullscreen ? '' : 'min-h-[500px]'}`}
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                style={{ touchAction: 'none' }}
            >
                <div
                    style={{
                        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                        transformOrigin: '0 0',
                        width: totalWidth,
                        height: totalHeight,
                        position: 'relative',
                    }}
                >
                    {/* SVG connector lines */}
                    <svg style={{ position: 'absolute', top: 0, left: 0, width: totalWidth, height: totalHeight, pointerEvents: 'none' }}>
                        {renderConnectors()}
                    </svg>

                    {/* Match cards */}
                    {matches.map(match => {
                        if (collapsedRounds.has(match.round)) return null;
                        const pos = getMatchPosition(match.round, match.match_order);

                        const isBye = match.status === 'BYE';
                        const isCompleted = match.status === 'COMPLETED';
                        const isInProgress = match.status === 'IN_PROGRESS';
                        const canClick = !isBye && match.athlete1_id && match.athlete2_id;

                        return (
                            <div
                                key={match.id}
                                className={`bracket-match absolute rounded-lg border overflow-hidden transition-all ${canClick ? 'cursor-pointer hover:scale-[1.03] hover:shadow-lg' : ''
                                    } ${isCompleted ? 'border-green-500/40 bg-green-500/5' :
                                        isInProgress ? 'border-amber-500/40 bg-amber-500/5 bracket-match-live' :
                                            isBye ? 'border-slate-700/40 bg-slate-800/60 opacity-50' :
                                                'border-white/10 bg-surface-light/90'
                                    }`}
                                style={{
                                    left: pos.x,
                                    top: pos.y,
                                    width: MATCH_WIDTH,
                                    height: MATCH_HEIGHT,
                                }}
                                onClick={() => canClick && navigate(`/scoring?match=${match.id}&event=${eventId}`)}
                            >
                                {/* Match code */}
                                <div className="text-[9px] text-slate-500 px-2 pt-1 font-mono flex items-center justify-between">
                                    <span>{match.match_code}</span>
                                    {isBye && <span className="text-slate-600 font-semibold">BYE</span>}
                                    {isInProgress && <span className="text-amber-400 animate-pulse">● LIVE</span>}
                                </div>
                                {/* Athlete 1 */}
                                <div className={`px-2 py-1 flex items-center justify-between text-xs border-b border-white/5 ${match.winner_id === match.athlete1_id ? 'bg-green-500/10' : ''}`}>
                                    <span className={`truncate ${match.athlete1_name ? 'text-white' : 'text-slate-600 italic'} ${match.winner_id === match.athlete1_id ? 'font-bold text-green-400' : ''}`}>
                                        {match.athlete1_name || 'TBD'}
                                    </span>
                                    {match.winner_id === match.athlete1_id && <span className="text-green-400 text-[10px] ml-1">W</span>}
                                </div>
                                {/* Athlete 2 */}
                                <div className={`px-2 py-1 flex items-center justify-between text-xs ${match.winner_id === match.athlete2_id ? 'bg-green-500/10' : ''}`}>
                                    <span className={`truncate ${match.athlete2_name ? 'text-white' : 'text-slate-600 italic'} ${match.winner_id === match.athlete2_id ? 'font-bold text-green-400' : ''}`}>
                                        {match.athlete2_name || 'TBD'}
                                    </span>
                                    {match.winner_id === match.athlete2_id && <span className="text-green-400 text-[10px] ml-1">W</span>}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Minimap overlay (for large brackets 64+) */}
            {showMinimap && firstRoundMatches > 16 && containerRef.current && (
                <div className="absolute bottom-4 right-4 w-48 h-32 bg-surface/90 border border-white/10 rounded-lg overflow-hidden z-20 backdrop-blur-sm">
                    <div className="text-[8px] text-slate-500 px-2 py-1 border-b border-white/5 font-semibold uppercase">Overview</div>
                    <div className="relative w-full h-full p-1">
                        {/* Mini bracket dots */}
                        {matches.filter(m => m.status !== 'BYE').map(match => {
                            const pos = getMatchPosition(match.round, match.match_order);
                            const scaleX = 160 / totalWidth;
                            const scaleY = 100 / totalHeight;
                            const dotColor = match.status === 'COMPLETED' ? '#22c55e' :
                                match.status === 'IN_PROGRESS' ? '#f59e0b' : '#475569';
                            return (
                                <div key={`mini-${match.id}`} className="absolute rounded-sm"
                                    style={{
                                        left: pos.x * scaleX + 4,
                                        top: pos.y * scaleY + 4,
                                        width: Math.max(2, MATCH_WIDTH * scaleX),
                                        height: Math.max(1, MATCH_HEIGHT * scaleY * 0.5),
                                        backgroundColor: dotColor,
                                        opacity: 0.8,
                                    }} />
                            );
                        })}
                        {/* Viewport indicator */}
                        {containerRef.current && (
                            <div className="absolute border border-red-500/60 rounded-sm bg-red-500/10"
                                style={{
                                    left: Math.max(0, (-pan.x / zoom) * (160 / totalWidth) + 4),
                                    top: Math.max(0, (-pan.y / zoom) * (100 / totalHeight) + 4),
                                    width: containerRef.current.clientWidth / zoom * (160 / totalWidth),
                                    height: containerRef.current.clientHeight / zoom * (100 / totalHeight),
                                }} />
                        )}
                    </div>
                </div>
            )}

            {/* Legend */}
            <div className="flex items-center gap-4 px-4 py-2 border-t border-white/5 bg-surface/60 flex-shrink-0 text-xs text-slate-500">
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" /> Live</div>
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400" /> Completed</div>
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-600" /> Pending</div>
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-700 opacity-50" /> BYE</div>
                <span className="ml-auto text-slate-600">Scroll to zoom · Drag to pan</span>
            </div>
        </div>
    );
}
