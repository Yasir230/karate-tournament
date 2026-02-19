import { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import type { Match } from './types';

interface SearchBarProps {
    matches: Match[];
}

export default function SearchBar({ matches }: SearchBarProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [showResults, setShowResults] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Debounced search
    useEffect(() => {
        if (!searchQuery.trim()) {
            setSearchResults([]);
            setShowResults(false);
            return;
        }
        const timer = setTimeout(() => {
            const q = searchQuery.toLowerCase();
            const results: any[] = [];

            matches.forEach(m => {
                const matchesSearch =
                    m.match_code?.toLowerCase().includes(q) ||
                    m.athlete1_name?.toLowerCase().includes(q) ||
                    m.athlete2_name?.toLowerCase().includes(q) ||
                    m.athlete1_dojo?.toLowerCase().includes(q) ||
                    m.athlete2_dojo?.toLowerCase().includes(q);
                if (matchesSearch) {
                    results.push({
                        type: 'match', id: m.id,
                        title: `${m.athlete1_name || 'TBD'} vs ${m.athlete2_name || 'TBD'}`,
                        subtitle: m.match_code, status: m.status,
                        extra: `Round ${m.round}${m.athlete1_dojo ? ' · ' + m.athlete1_dojo : ''}`,
                    });
                }
            });

            const seenAthletes = new Set<string>();
            matches.forEach(m => {
                if (m.athlete1_id && m.athlete1_name?.toLowerCase().includes(q) && !seenAthletes.has(m.athlete1_id)) {
                    seenAthletes.add(m.athlete1_id);
                    results.push({ type: 'athlete', id: m.athlete1_id, title: m.athlete1_name, subtitle: m.athlete1_dojo, status: null, extra: 'Competing' });
                }
                if (m.athlete2_id && m.athlete2_name?.toLowerCase().includes(q) && !seenAthletes.has(m.athlete2_id)) {
                    seenAthletes.add(m.athlete2_id);
                    results.push({ type: 'athlete', id: m.athlete2_id, title: m.athlete2_name, subtitle: m.athlete2_dojo, status: null, extra: 'Competing' });
                }
            });

            const seenDojos = new Set<string>();
            matches.forEach(m => {
                if (m.athlete1_dojo?.toLowerCase().includes(q) && !seenDojos.has(m.athlete1_dojo)) {
                    seenDojos.add(m.athlete1_dojo);
                    const count = matches.filter(mm => mm.athlete1_dojo === m.athlete1_dojo || mm.athlete2_dojo === m.athlete1_dojo).length;
                    results.push({ type: 'dojo', id: m.athlete1_dojo, title: m.athlete1_dojo, subtitle: `${count} match appearances`, status: null, extra: 'Dojo' });
                }
            });

            setSearchResults(results.slice(0, 20));
            setShowResults(true);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery, matches]);

    // Click-outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setShowResults(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={containerRef}>
            <div className="glass-card p-1">
                <div className="relative">
                    <Search size={18} className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search athletes, dojos, or match IDs..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full bg-transparent border-none px-12 py-3.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-0"
                    />
                    {searchQuery && (
                        <button onClick={() => { setSearchQuery(''); setShowResults(false); }}
                            className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-500 hover:text-white">
                            <X size={16} />
                        </button>
                    )}
                </div>
            </div>

            {showResults && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 glass-card border border-white/10 rounded-xl overflow-hidden z-50 max-h-80 overflow-y-auto">
                    <div className="px-3 py-2 border-b border-white/5">
                        <span className="text-xs text-slate-500 font-semibold">{searchResults.length} results for "{searchQuery}"</span>
                    </div>
                    {searchResults.map((result, idx) => (
                        <div key={`${result.type}-${result.id}-${idx}`}
                            className="flex items-center justify-between px-4 py-3 hover:bg-white/5 cursor-pointer border-b border-white/5 last:border-0 transition-colors"
                            onClick={() => { setSearchQuery(result.title || ''); setShowResults(false); }}>
                            <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${result.type === 'match' ? 'bg-red-500/20 text-red-400' :
                                    result.type === 'athlete' ? 'bg-blue-500/20 text-blue-400' :
                                        'bg-amber-500/20 text-amber-400'
                                    }`}>
                                    {result.type === 'match' ? '⚔️' : result.type === 'athlete' ? '🥋' : '🏠'}
                                </div>
                                <div>
                                    <p className="text-sm text-white font-medium">{result.title}</p>
                                    <p className="text-xs text-slate-500">{result.subtitle} · {result.extra}</p>
                                </div>
                            </div>
                            {result.status && (
                                <span className={`badge text-[10px] ${result.status === 'COMPLETED' ? 'badge-valid' :
                                    result.status === 'IN_PROGRESS' ? 'badge-pending' : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                                    }`}>{result.status.replace('_', ' ')}</span>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
