import { useState, useEffect } from 'react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Users, Trophy, Swords, Award, TrendingUp, Activity, QrCode, Download } from 'lucide-react';
import QRCode from 'qrcode';

export default function Dashboard() {
    const { user, isAdmin } = useAuth();
    const [stats, setStats] = useState<any>(null);
    const [events, setEvents] = useState<any[]>([]);
    const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

    useEffect(() => {
        api.get('/stats').then(res => setStats(res.data)).catch(console.error);
        api.get('/events').then(res => setEvents(res.data)).catch(console.error);
    }, []);

    // Generate QR code for non-admin users
    useEffect(() => {
        if (user && !isAdmin) {
            const qrData = JSON.stringify({
                id: user.id,
                username: user.username,
                role: user.role,
                athleteId: user.athleteId || null,
            });
            QRCode.toDataURL(qrData, {
                width: 280,
                margin: 2,
                color: { dark: '#000000', light: '#ffffff' },
                errorCorrectionLevel: 'M',
            }).then(url => setQrDataUrl(url)).catch(console.error);
        }
    }, [user, isAdmin]);

    const downloadQR = () => {
        if (!qrDataUrl) return;
        const link = document.createElement('a');
        link.download = `qr-${user?.username || 'user'}.png`;
        link.href = qrDataUrl;
        link.click();
    };

    const statCards = stats ? [
        { label: 'Total Athletes', value: stats.athletes.total, icon: Users, color: 'from-blue-600 to-blue-800', sub: `${stats.athletes.valid} valid, ${stats.athletes.pending} pending` },
        { label: 'Events', value: stats.events.total, icon: Trophy, color: 'from-amber-600 to-amber-800', sub: `${stats.events.ongoing} ongoing` },
        { label: 'Matches', value: stats.matches.total, icon: Swords, color: 'from-red-600 to-red-800', sub: `${stats.matches.completed} completed` },
        { label: 'Certificates', value: stats.certificates, icon: Award, color: 'from-emerald-600 to-emerald-800', sub: 'Issued' },
    ] : [];

    return (
        <div className="space-y-8 animate-fade-in">
            <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-white">Dashboard</h1>
                <p className="text-slate-400 mt-1">
                    {isAdmin ? 'Tournament management overview' : `Welcome, ${user?.username}!`}
                </p>
            </div>

            {/* QR Code Card — for Spectators & Athletes */}
            {!isAdmin && user && (
                <div className="glass-card p-6 border border-purple-500/20">
                    <div className="flex flex-col md:flex-row items-center gap-6">
                        <div className="flex-shrink-0">
                            {qrDataUrl ? (
                                <div className="bg-white rounded-2xl p-3 shadow-2xl">
                                    <img src={qrDataUrl} alt="QR Code" className="w-48 h-48" />
                                </div>
                            ) : (
                                <div className="w-48 h-48 bg-white/10 rounded-2xl flex items-center justify-center">
                                    <QrCode size={48} className="text-slate-500 animate-pulse" />
                                </div>
                            )}
                        </div>
                        <div className="text-center md:text-left flex-1">
                            <div className="flex items-center gap-2 justify-center md:justify-start mb-2">
                                <QrCode size={20} className="text-purple-400" />
                                <h2 className="text-xl font-bold text-white">My QR Code</h2>
                            </div>
                            <p className="text-sm text-slate-400 mb-4">
                                Tunjukkan QR code ini ke admin untuk verifikasi & scan cepat di lapangan.
                                QR code berisi informasi identitas Anda.
                            </p>
                            <div className="grid grid-cols-2 gap-3 mb-4">
                                <div className="bg-white/5 rounded-lg p-3">
                                    <p className="text-[10px] text-slate-500 uppercase tracking-wide">Username</p>
                                    <p className="text-sm text-white font-medium">{user.username}</p>
                                </div>
                                <div className="bg-white/5 rounded-lg p-3">
                                    <p className="text-[10px] text-slate-500 uppercase tracking-wide">Role</p>
                                    <span className={`badge text-xs ${user.role === 'ATHLETE' ? 'badge-valid' : 'badge-pending'}`}>
                                        {user.role}
                                    </span>
                                </div>
                            </div>
                            <button onClick={downloadQR} disabled={!qrDataUrl} className="btn-primary disabled:opacity-50">
                                <Download size={16} /> Download QR Code
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {statCards.map((card, i) => (
                    <div key={i} className="glass-card glass-card-hover p-5">
                        <div className="flex items-start justify-between mb-3">
                            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center`}>
                                <card.icon size={20} className="text-white" />
                            </div>
                            <TrendingUp size={14} className="text-green-400" />
                        </div>
                        <p className="text-2xl font-bold text-white">{card.value}</p>
                        <p className="text-sm text-slate-400 mt-0.5">{card.label}</p>
                        <p className="text-xs text-slate-500 mt-1">{card.sub}</p>
                    </div>
                ))}
            </div>

            {/* Recent Events */}
            <div className="glass-card p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Activity size={18} className="text-red-400" />
                    <h2 className="text-lg font-semibold text-white">Recent Events</h2>
                </div>
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Event Name</th>
                                <th>Code</th>
                                <th>Dates</th>
                                <th>Location</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {events.length === 0 ? (
                                <tr><td colSpan={5} className="text-center text-slate-500 py-8">No events yet</td></tr>
                            ) : events.map((event: any) => (
                                <tr key={event.id}>
                                    <td className="font-medium text-white">{event.name}</td>
                                    <td className="text-slate-400 font-mono text-xs">{event.event_code}</td>
                                    <td className="text-slate-400">{event.start_date} → {event.end_date}</td>
                                    <td className="text-slate-400">{event.location || '—'}</td>
                                    <td>
                                        <span className={`badge ${event.status === 'ONGOING' ? 'badge-valid' :
                                            event.status === 'COMPLETED' ? 'badge-gold' : 'badge-pending'
                                            }`}>
                                            {event.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
