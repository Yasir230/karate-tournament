import { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import api from '../lib/api';
import { Camera, CheckCircle, AlertCircle, Weight, User } from 'lucide-react';

export default function Scanner() {
    const [scanning, setScanning] = useState(false);
    const [scannedAthlete, setScannedAthlete] = useState<any>(null);
    const [editWeight, setEditWeight] = useState('');
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const scannerRef = useRef<Html5Qrcode | null>(null);

    const startScanner = async () => {
        try {
            const scanner = new Html5Qrcode('qr-reader');
            scannerRef.current = scanner;

            await scanner.start(
                { facingMode: 'environment' },
                { fps: 10, qrbox: { width: 250, height: 250 } },
                async (decodedText) => {
                    try {
                        const data = JSON.parse(decodedText);
                        if (data.id) {
                            await scanner.stop();
                            setScanning(false);
                            const res = await api.get(`/athletes/${data.id}`);
                            setScannedAthlete(res.data);
                            setEditWeight(String(res.data.weight));
                        }
                    } catch (err) {
                        console.error('QR parse error:', err);
                    }
                },
                () => { }
            );
            setScanning(true);
        } catch (err) {
            setMessage({ type: 'error', text: 'Could not access camera. Please allow camera permissions.' });
        }
    };

    const stopScanner = async () => {
        if (scannerRef.current) {
            try { await scannerRef.current.stop(); } catch { }
            setScanning(false);
        }
    };

    const handleVerify = async () => {
        if (!scannedAthlete) return;
        try {
            const res = await api.post(`/athletes/${scannedAthlete.id}/verify`, {
                weight: parseFloat(editWeight),
            });
            setScannedAthlete(res.data);
            setMessage({ type: 'success', text: `${res.data.name} verified successfully!` });
        } catch (err: any) {
            setMessage({ type: 'error', text: err.response?.data?.error || 'Verification failed' });
        }
    };

    useEffect(() => {
        return () => { stopScanner(); };
    }, []);

    return (
        <div className="space-y-6 animate-fade-in max-w-2xl mx-auto">
            <div className="text-center">
                <h1 className="text-2xl font-bold text-white">QR Scanner</h1>
                <p className="text-slate-400 text-sm mt-1">Scan athlete QR code for field verification</p>
            </div>

            {message && (
                <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-500/10 border border-green-500/30 text-green-400' : 'bg-red-500/10 border border-red-500/30 text-red-400'
                    }`}>
                    {message.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                    {message.text}
                </div>
            )}

            {/* Scanner Area */}
            <div className="glass-card p-6">
                <div id="qr-reader" className="rounded-xl overflow-hidden bg-black/50 mb-4" style={{ minHeight: scanning ? 300 : 0 }} />

                {!scanning && !scannedAthlete && (
                    <div className="text-center py-12">
                        <Camera size={48} className="mx-auto text-slate-600 mb-4" />
                        <p className="text-slate-400 mb-4">Click to activate QR scanner</p>
                        <button onClick={startScanner} className="btn-primary text-lg px-8 py-3">
                            <Camera size={20} /> Start Scanner
                        </button>
                    </div>
                )}

                {scanning && (
                    <div className="text-center">
                        <p className="text-slate-400 mb-3">Position the QR code within the frame</p>
                        <button onClick={stopScanner} className="btn-secondary">Stop Scanner</button>
                    </div>
                )}
            </div>

            {/* Scanned Athlete Profile */}
            {scannedAthlete && (
                <div className="glass-card p-6 animate-slide-up">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <User size={20} className="text-red-400" />
                        Athlete Profile
                    </h3>

                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div>
                            <p className="text-xs text-slate-500 uppercase">Name</p>
                            <p className="text-white font-medium">{scannedAthlete.name}</p>
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 uppercase">Dojo</p>
                            <p className="text-white">{scannedAthlete.dojo}</p>
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 uppercase">Gender</p>
                            <p className="text-white">{scannedAthlete.gender}</p>
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 uppercase">Birth Date</p>
                            <p className="text-white">{scannedAthlete.birth_date}</p>
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 uppercase">Age Class</p>
                            <span className="badge badge-pending">{scannedAthlete.age_class}</span>
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 uppercase">Weight Class</p>
                            <span className="badge badge-gold">{scannedAthlete.weight_class}</span>
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 uppercase">Status</p>
                            <span className={`badge ${scannedAthlete.status === 'VALID' ? 'badge-valid' : 'badge-pending'}`}>
                                {scannedAthlete.status}
                            </span>
                        </div>
                    </div>

                    {/* Weight verification */}
                    <div className="border-t border-white/10 pt-4">
                        <label className="flex items-center gap-2 text-sm text-slate-400 mb-2">
                            <Weight size={16} /> Verified Weight (kg)
                        </label>
                        <div className="flex gap-3">
                            <input
                                type="number"
                                step="0.1"
                                value={editWeight}
                                onChange={e => setEditWeight(e.target.value)}
                                className="input-field flex-1"
                            />
                            <button
                                onClick={handleVerify}
                                disabled={scannedAthlete.status === 'VALID'}
                                className="btn-success disabled:opacity-50"
                            >
                                <CheckCircle size={16} /> {scannedAthlete.status === 'VALID' ? 'Already Verified' : 'Mark as VALID'}
                            </button>
                        </div>
                    </div>

                    <div className="mt-4 flex gap-3">
                        <button onClick={() => { setScannedAthlete(null); setMessage(null); }} className="btn-secondary flex-1 justify-center">Clear</button>
                        <button onClick={startScanner} className="btn-primary flex-1 justify-center"><Camera size={16} /> Scan Another</button>
                    </div>
                </div>
            )}
        </div>
    );
}
