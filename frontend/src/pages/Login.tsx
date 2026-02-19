import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, User, AlertCircle, Swords } from 'lucide-react';

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await login(username, password);
            navigate('/');
        } catch (err: any) {
            setError(err.response?.data?.error || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4" style={{
            background: 'radial-gradient(ellipse at top, #1e293b 0%, #0f172a 50%, #020617 100%)'
        }}>
            <div className="w-full max-w-md animate-slide-up">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-red-600 to-red-800 mb-4 shadow-2xl pulse-glow">
                        <Swords size={40} className="text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-1">KarateTMS</h1>
                    <p className="text-slate-400">Tournament Management System</p>
                </div>

                {/* Login Card */}
                <div className="glass-card p-8">
                    <h2 className="text-xl font-semibold text-white mb-6 text-center">Sign In</h2>

                    {error && (
                        <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm text-slate-400 mb-1.5">Username</label>
                            <div className="relative">
                                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="input-field pl-10"
                                    placeholder="Enter username"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm text-slate-400 mb-1.5">Password</label>
                            <div className="relative">
                                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="input-field pl-10"
                                    placeholder="Enter password"
                                    required
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="btn-primary w-full justify-center py-3 text-base disabled:opacity-50"
                        >
                            {loading ? (
                                <span className="inline-block w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : 'Sign In'}
                        </button>
                    </form>

                    <div className="mt-6 pt-4 border-t border-white/10">
                        <p className="text-xs text-slate-500 text-center mb-2">Demo credentials:</p>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            <button
                                onClick={() => { setUsername('admin'); setPassword('admin123'); }}
                                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 transition-colors text-center"
                            >
                                <span className="font-medium text-white">Admin</span><br />admin / admin123
                            </button>
                            <button
                                onClick={() => { setUsername('spectator'); setPassword('spectator'); }}
                                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 transition-colors text-center"
                            >
                                <span className="font-medium text-white">Spectator</span><br />spectator / spectator
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
