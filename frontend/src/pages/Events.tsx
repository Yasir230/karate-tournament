import { useState, useEffect } from 'react';
import { Plus, Trash2, Award, Calendar, MapPin, Eye, UserPlus, Zap } from 'lucide-react';
import api from '../lib/api';
import toast from '../lib/toast';
import { useAuth } from '../context/AuthContext';
import BracketViewer from '../components/BracketViewer';

interface Event {
    id: string;
    name: string;
    event_code: string;
    start_date: string;
    end_date: string;
    location: string;
    status: string;
    athletes?: any[];
    matches?: any[];
}

export default function Events() {
    const { isAdmin } = useAuth();
    const [events, setEvents] = useState<Event[]>([]);
    const [showCreate, setShowCreate] = useState(false);
    const [showRegister, setShowRegister] = useState<string | null>(null);
    const [showBracket, setShowBracket] = useState<string | null>(null);
    const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
    const [athletes, setAthletes] = useState<any[]>([]);
    const [selectedAthletes, setSelectedAthletes] = useState<string[]>([]);
    const [form, setForm] = useState({ name: '', start_date: '', end_date: '', location: '' });
    const [creating, setCreating] = useState(false);
    const [generatingId, setGeneratingId] = useState<string | null>(null);

    useEffect(() => { fetchEvents(); }, []);

    const fetchEvents = async () => {
        try {
            const res = await api.get('/events');
            setEvents(res.data);
        } catch { }
    };

    const fetchEventDetails = async (id: string) => {
        try {
            const res = await api.get(`/events/${id}`);
            setSelectedEvent(res.data);
        } catch { }
    };

    const fetchAthletes = async () => {
        try {
            const res = await api.get('/athletes');
            setAthletes(res.data);
        } catch { }
    };

    const handleCreate = async () => {
        if (creating) return;
        setCreating(true);
        try {
            await api.post('/events', form);
            setShowCreate(false);
            setForm({ name: '', start_date: '', end_date: '', location: '' });
            fetchEvents();
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to create event');
        } finally {
            setCreating(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this event?')) return;
        try {
            await api.delete(`/events/${id}`);
            fetchEvents();
        } catch { }
    };

    const handleRegister = async (eventId: string) => {
        try {
            await api.post(`/events/${eventId}/athletes`, { athlete_ids: selectedAthletes });
            setShowRegister(null);
            setSelectedAthletes([]);
            fetchEvents();
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to register athletes');
        }
    };

    const handleGenerateBracket = async (eventId: string) => {
        if (generatingId) return;
        setGeneratingId(eventId);
        try {
            const res = await api.post(`/events/${eventId}/matches/generate-bracket`);
            toast.success(`Bracket generated with ${res.data.matches.length} matches!`);
            fetchEvents();
            fetchEventDetails(eventId);
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to generate bracket');
        } finally {
            setGeneratingId(null);
        }
    };

    const openBracket = async (eventId: string) => {
        await fetchEventDetails(eventId);
        setShowBracket(eventId);
    };

    const openRegister = async (eventId: string) => {
        await fetchAthletes();
        await fetchEventDetails(eventId);
        setShowRegister(eventId);
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'UPCOMING': return 'badge-pending';
            case 'ONGOING': return 'badge-valid';
            case 'COMPLETED': return 'bg-blue-500/15 text-blue-400 border border-blue-500/30';
            default: return '';
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-red-400 to-amber-400 bg-clip-text text-transparent">
                        🏆 Events
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">
                        {isAdmin ? 'Manage tournaments and brackets' : 'View tournaments and brackets'}
                    </p>
                </div>
                {/* Only admin can create events */}
                {isAdmin && (
                    <button onClick={() => setShowCreate(true)} className="btn-primary">
                        <Plus size={18} /> New Event
                    </button>
                )}
            </div>

            {/* Events Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {events.map(evt => (
                    <div key={evt.id} className="glass-card glass-card-hover p-5">
                        <div className="flex justify-between items-start mb-3">
                            <div>
                                <h3 className="text-lg font-bold text-white">{evt.name}</h3>
                                <p className="text-xs text-slate-500 font-mono mt-0.5">{evt.event_code}</p>
                            </div>
                            <span className={`badge ${getStatusBadge(evt.status)}`}>{evt.status}</span>
                        </div>

                        <div className="flex items-center gap-4 text-sm text-slate-400 mb-4">
                            <span className="flex items-center gap-1"><Calendar size={14} /> {evt.start_date}</span>
                            {evt.location && <span className="flex items-center gap-1"><MapPin size={14} /> {evt.location}</span>}
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {/* Admin-only buttons */}
                            {isAdmin && (
                                <>
                                    <button onClick={() => openRegister(evt.id)} className="btn-secondary text-xs py-1.5">
                                        <UserPlus size={14} /> Register
                                    </button>
                                    <button onClick={() => handleGenerateBracket(evt.id)} disabled={generatingId === evt.id} className="btn-success text-xs py-1.5 disabled:opacity-50">
                                        <Zap size={14} /> {generatingId === evt.id ? 'Generating...' : 'Generate Bracket'}
                                    </button>
                                </>
                            )}
                            {/* View Bracket — available to everyone */}
                            <button onClick={() => openBracket(evt.id)} className="btn-secondary text-xs py-1.5">
                                <Eye size={14} /> View Bracket
                            </button>
                            {/* Delete — admin only */}
                            {isAdmin && (
                                <button onClick={() => handleDelete(evt.id)} className="btn-danger text-xs py-1.5 ml-auto">
                                    <Trash2 size={14} />
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {events.length === 0 && (
                <div className="glass-card p-12 text-center">
                    <Award size={48} className="mx-auto text-slate-600 mb-4" />
                    <h3 className="text-lg text-slate-400 font-semibold">No Events</h3>
                    <p className="text-sm text-slate-500 mt-1">
                        {isAdmin ? 'Create your first tournament event.' : 'No tournaments available yet.'}
                    </p>
                </div>
            )}

            {/* Create Event Modal — admin only */}
            {showCreate && isAdmin && (
                <div className="modal-overlay" onClick={() => setShowCreate(false)}>
                    <div className="modal-content p-6 animate-slide-up" onClick={e => e.stopPropagation()}>
                        <h3 className="text-xl font-bold text-white mb-4">Create Event</h3>
                        <div className="space-y-3">
                            <input type="text" placeholder="Event Name" value={form.name}
                                onChange={e => setForm({ ...form, name: e.target.value })}
                                className="input-field" />
                            <div className="grid grid-cols-2 gap-3">
                                <input type="date" value={form.start_date}
                                    onChange={e => setForm({ ...form, start_date: e.target.value })}
                                    className="input-field" />
                                <input type="date" value={form.end_date}
                                    onChange={e => setForm({ ...form, end_date: e.target.value })}
                                    className="input-field" />
                            </div>
                            <input type="text" placeholder="Location (optional)" value={form.location}
                                onChange={e => setForm({ ...form, location: e.target.value })}
                                className="input-field" />
                        </div>
                        <div className="flex gap-3 mt-5">
                            <button onClick={handleCreate} disabled={creating} className="btn-primary flex-1 disabled:opacity-50">
                                {creating ? 'Creating...' : 'Create'}
                            </button>
                            <button onClick={() => setShowCreate(false)} className="btn-secondary flex-1">Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Register Athletes Modal — admin only */}
            {showRegister && isAdmin && (
                <div className="modal-overlay" onClick={() => setShowRegister(null)}>
                    <div className="modal-content p-6 animate-slide-up max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <h3 className="text-xl font-bold text-white mb-4">Register Athletes</h3>
                        <p className="text-sm text-slate-400 mb-3">
                            {selectedAthletes.length} selected
                            {selectedEvent?.athletes && ` · ${selectedEvent.athletes.length} already registered`}
                        </p>
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                            {athletes.map(a => {
                                const isRegistered = selectedEvent?.athletes?.some((ea: any) => ea.id === a.id);
                                return (
                                    <label key={a.id} className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer ${isRegistered ? 'bg-green-500/5 border border-green-500/20' : 'hover:bg-white/5'}`}>
                                        <input
                                            type="checkbox"
                                            checked={selectedAthletes.includes(a.id) || isRegistered}
                                            disabled={isRegistered}
                                            onChange={e => {
                                                if (e.target.checked) setSelectedAthletes([...selectedAthletes, a.id]);
                                                else setSelectedAthletes(selectedAthletes.filter(id => id !== a.id));
                                            }}
                                            className="accent-red-500"
                                        />
                                        <div>
                                            <span className="text-sm text-white">{a.name}</span>
                                            <span className="text-xs text-slate-500 ml-2">{a.dojo} · {a.status}</span>
                                        </div>
                                    </label>
                                );
                            })}
                        </div>
                        <div className="flex gap-3 mt-4">
                            <button onClick={() => showRegister && handleRegister(showRegister)}
                                className="btn-primary flex-1" disabled={selectedAthletes.length === 0}>
                                Register ({selectedAthletes.length})
                            </button>
                            <button onClick={() => setShowRegister(null)} className="btn-secondary flex-1">Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Bracket Viewer Modal (Full-Page Overlay) */}
            {showBracket && selectedEvent?.matches && (
                <div className="fixed inset-0 z-[60] bg-surface/98 backdrop-blur-sm flex flex-col">
                    <BracketViewer
                        matches={selectedEvent.matches}
                        eventId={showBracket}
                        onClose={() => setShowBracket(null)}
                    />
                </div>
            )}
        </div>
    );
}
