import { useState, useEffect } from 'react';
import api from '../lib/api';
import toast from '../lib/toast';
import { Award, CheckCircle, FileText, Loader2 } from 'lucide-react';

export default function Certificates() {
    const [events, setEvents] = useState<any[]>([]);
    const [selectedEvent, setSelectedEvent] = useState('');
    const [certificates, setCertificates] = useState<any[]>([]);
    const [generating, setGenerating] = useState(false);
    const [redeemingId, setRedeemingId] = useState<string | null>(null);

    useEffect(() => { api.get('/events').then(r => setEvents(r.data)).catch(err => console.error('Failed to load events:', err)); }, []);

    useEffect(() => {
        if (selectedEvent) {
            api.get('/certificates', { params: { event_id: selectedEvent } })
                .then(r => setCertificates(r.data))
                .catch(err => console.error('Failed to load certificates:', err));
        }
    }, [selectedEvent]);

    const handleGenerate = async () => {
        if (!selectedEvent) return;
        setGenerating(true);
        try {
            const res = await api.post('/certificates/generate', { event_id: selectedEvent });
            setCertificates(res.data.certificates);
            toast.success(res.data.message);
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Generation failed');
        } finally {
            setGenerating(false);
        }
    };

    const handleRedeem = async (certId: string) => {
        if (redeemingId) return;
        setRedeemingId(certId);
        try {
            await api.post(`/certificates/${certId}/redeem`);
            const res = await api.get('/certificates', { params: { event_id: selectedEvent } });
            setCertificates(res.data);
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Redeem failed');
        } finally {
            setRedeemingId(null);
        }
    };

    const downloadPdf = (certId: string) => {
        const token = localStorage.getItem('token');
        window.open(`/api/certificates/${certId}/pdf?token=${token}`, '_blank');
    };

    const medalEmoji: Record<string, string> = { GOLD: '🥇', SILVER: '🥈', BRONZE: '🥉', PARTICIPATION: '📜' };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Award size={24} className="text-amber-400" /> Certificates</h1>
                    <p className="text-slate-400 text-sm">Generate and manage awards</p>
                </div>
            </div>

            <div className="flex flex-wrap gap-3">
                <select value={selectedEvent} onChange={e => setSelectedEvent(e.target.value)} className="input-field w-auto">
                    <option value="">Select Event</option>
                    {events.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
                {selectedEvent && (
                    <button onClick={handleGenerate} disabled={generating} className="btn-primary">
                        {generating ? <Loader2 size={16} className="animate-spin" /> : <Award size={16} />}
                        Generate Certificates
                    </button>
                )}
            </div>

            {certificates.length > 0 && (
                <div className="grid gap-4">
                    {certificates.map(cert => (
                        <div key={cert.id} className={`glass-card glass-card-hover p-6 border-l-4 ${cert.type === 'GOLD' ? 'border-l-yellow-400' : cert.type === 'SILVER' ? 'border-l-gray-300' : cert.type === 'BRONZE' ? 'border-l-amber-700' : 'border-l-blue-400'
                            }`}>
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                <div className="flex items-center gap-4">
                                    <span className="text-4xl">{medalEmoji[cert.type]}</span>
                                    <div>
                                        <h3 className="text-lg font-bold text-white">{cert.athlete_name}</h3>
                                        <p className="text-sm text-slate-400">{cert.dojo} · {cert.event_name}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className={`badge ${cert.type === 'GOLD' ? 'badge-gold' : cert.type === 'SILVER' ? 'badge-silver' : cert.type === 'BRONZE' ? 'badge-bronze' : 'badge-pending'}`}>
                                                {cert.type}
                                            </span>
                                            {cert.redeemed ? (
                                                <span className="badge badge-valid">Redeemed</span>
                                            ) : (
                                                <span className="badge badge-pending">Not Redeemed</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => downloadPdf(cert.id)} className="btn-secondary">
                                        <FileText size={14} /> View PDF
                                    </button>
                                    {!cert.redeemed && (
                                        <button onClick={() => handleRedeem(cert.id)} disabled={redeemingId === cert.id} className="btn-success disabled:opacity-50">
                                            <CheckCircle size={14} /> {redeemingId === cert.id ? 'Redeeming...' : 'Redeem'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {selectedEvent && certificates.length === 0 && (
                <div className="glass-card p-12 text-center">
                    <Award size={48} className="mx-auto text-slate-600 mb-4" />
                    <p className="text-slate-400">No certificates generated yet.</p>
                    <p className="text-sm text-slate-500 mt-1">Complete the tournament first, then generate certificates.</p>
                </div>
            )}

            {!selectedEvent && (
                <div className="glass-card p-12 text-center text-slate-500">Select an event to view certificates</div>
            )}
        </div>
    );
}
