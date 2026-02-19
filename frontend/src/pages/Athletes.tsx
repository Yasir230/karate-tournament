import { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, QrCode, Upload, X, Barcode } from 'lucide-react';
import api from '../lib/api';
import toast from '../lib/toast';

interface Athlete {
    id: string;
    name: string;
    dojo: string;
    birth_date: string;
    weight: number;
    gender: string;
    age_class: string;
    weight_class: string;
    status: string;
    qr_code?: string;
    barcode?: string;
}

export default function Athletes() {
    const [athletes, setAthletes] = useState<Athlete[]>([]);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [genderFilter, setGenderFilter] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editingAthlete, setEditingAthlete] = useState<Athlete | null>(null);
    const [showIdModal, setShowIdModal] = useState<Athlete | null>(null);
    const [idTab, setIdTab] = useState<'qr' | 'barcode'>('qr');
    const [form, setForm] = useState({
        name: '', dojo: '', birth_date: '', weight: '', gender: 'MALE'
    });

    useEffect(() => {
        const timer = setTimeout(() => fetchAthletes(), 400);
        return () => clearTimeout(timer);
    }, [search, statusFilter, genderFilter]);

    const fetchAthletes = async () => {
        try {
            const params: any = {};
            if (search) params.search = search;
            if (statusFilter) params.status = statusFilter;
            if (genderFilter) params.gender = genderFilter;
            const res = await api.get('/athletes', { params });
            setAthletes(res.data);
        } catch { }
    };

    const handleSubmit = async () => {
        try {
            const data = { ...form, weight: parseFloat(form.weight) };
            if (editingAthlete) {
                await api.put(`/athletes/${editingAthlete.id}`, data);
            } else {
                await api.post('/athletes', data);
            }
            setShowForm(false);
            setEditingAthlete(null);
            setForm({ name: '', dojo: '', birth_date: '', weight: '', gender: 'MALE' });
            fetchAthletes();
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to save athlete');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this athlete?')) return;
        try {
            await api.delete(`/athletes/${id}`);
            fetchAthletes();
        } catch { }
    };

    const handleEdit = (athlete: Athlete) => {
        setEditingAthlete(athlete);
        setForm({
            name: athlete.name,
            dojo: athlete.dojo,
            birth_date: athlete.birth_date,
            weight: String(athlete.weight),
            gender: athlete.gender,
        });
        setShowForm(true);
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const formData = new FormData();
        formData.append('file', file);
        try {
            const res = await api.post('/athletes/import', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            toast.success(res.data.message);
            fetchAthletes();
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Import failed');
        }
    };

    const openIdModal = async (athlete: Athlete) => {
        setShowIdModal(athlete);
        setIdTab('qr');
        // Fetch QR if missing
        if (!athlete.qr_code) {
            try {
                const res = await api.get(`/athletes/${athlete.id}/qr`);
                setShowIdModal({ ...athlete, qr_code: res.data.qr_code });
            } catch { }
        }
    };

    const fetchBarcode = async (athlete: Athlete) => {
        if (athlete.barcode) return;
        try {
            const res = await api.get(`/athletes/${athlete.id}/barcode`);
            setShowIdModal(prev => prev ? { ...prev, barcode: res.data.barcode } : null);
        } catch { }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'VALID': return 'badge-valid';
            case 'PENDING': return 'badge-pending';
            case 'DISQUALIFIED': return 'badge-disqualified';
            default: return '';
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-red-400 to-amber-400 bg-clip-text text-transparent">
                        🥋 Athletes
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">{athletes.length} athletes registered</p>
                </div>
                <div className="flex items-center gap-2">
                    <label className="btn-secondary cursor-pointer">
                        <Upload size={16} /> Import CSV/XLSX
                        <input type="file" accept=".xlsx,.csv" onChange={handleImport} className="hidden" />
                    </label>
                    <button onClick={() => { setEditingAthlete(null); setForm({ name: '', dojo: '', birth_date: '', weight: '', gender: 'MALE' }); setShowForm(true); }}
                        className="btn-primary"><Plus size={18} /> Add Athlete</button>
                </div>
            </div>

            {/* Filters */}
            <div className="glass-card p-4">
                <div className="flex flex-col md:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input type="text" placeholder="Search athletes or dojos..." value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="input-field pl-10" />
                    </div>
                    <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input-field w-auto">
                        <option value="">All Status</option>
                        <option value="VALID">Valid</option>
                        <option value="PENDING">Pending</option>
                        <option value="DISQUALIFIED">Disqualified</option>
                    </select>
                    <select value={genderFilter} onChange={e => setGenderFilter(e.target.value)} className="input-field w-auto">
                        <option value="">All Gender</option>
                        <option value="MALE">Male</option>
                        <option value="FEMALE">Female</option>
                    </select>
                </div>
            </div>

            {/* Athletes Table */}
            <div className="glass-card table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Dojo</th>
                            <th>Gender</th>
                            <th>Weight</th>
                            <th>Age Class</th>
                            <th>Weight Class</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {athletes.map(a => (
                            <tr key={a.id}>
                                <td className="font-medium text-white">{a.name}</td>
                                <td className="text-slate-400">{a.dojo}</td>
                                <td><span className={`text-xs ${a.gender === 'MALE' ? 'text-blue-400' : 'text-pink-400'}`}>{a.gender}</span></td>
                                <td>{a.weight} kg</td>
                                <td>Class {a.age_class}</td>
                                <td>Class {a.weight_class}</td>
                                <td><span className={`badge ${getStatusBadge(a.status)}`}>{a.status}</span></td>
                                <td>
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => openIdModal(a)}
                                            className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors" title="View ID (QR & Barcode)">
                                            <QrCode size={16} />
                                        </button>
                                        <button onClick={() => handleEdit(a)}
                                            className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors" title="Edit">
                                            <Edit2 size={16} />
                                        </button>
                                        <button onClick={() => handleDelete(a.id)}
                                            className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-red-400 transition-colors" title="Delete">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Create/Edit Modal */}
            {showForm && (
                <div className="modal-overlay" onClick={() => setShowForm(false)}>
                    <div className="modal-content p-6 animate-slide-up" onClick={e => e.stopPropagation()}>
                        <h3 className="text-xl font-bold text-white mb-4">
                            {editingAthlete ? 'Edit Athlete' : 'Add Athlete'}
                        </h3>
                        <div className="space-y-3">
                            <input type="text" placeholder="Full Name" value={form.name}
                                onChange={e => setForm({ ...form, name: e.target.value })}
                                className="input-field" />
                            <input type="text" placeholder="Dojo" value={form.dojo}
                                onChange={e => setForm({ ...form, dojo: e.target.value })}
                                className="input-field" />
                            <div className="grid grid-cols-2 gap-3">
                                <input type="date" value={form.birth_date}
                                    onChange={e => setForm({ ...form, birth_date: e.target.value })}
                                    className="input-field" />
                                <input type="number" placeholder="Weight (kg)" value={form.weight}
                                    onChange={e => setForm({ ...form, weight: e.target.value })}
                                    className="input-field" />
                            </div>
                            <select value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })}
                                className="input-field">
                                <option value="MALE">Male</option>
                                <option value="FEMALE">Female</option>
                            </select>
                        </div>
                        <div className="flex gap-3 mt-5">
                            <button onClick={handleSubmit} className="btn-primary flex-1">
                                {editingAthlete ? 'Update' : 'Create'}
                            </button>
                            <button onClick={() => setShowForm(false)} className="btn-secondary flex-1">Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ID Modal - QR Code + Barcode */}
            {showIdModal && (
                <div className="modal-overlay" onClick={() => setShowIdModal(null)}>
                    <div className="modal-content p-6 animate-slide-up" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-white">Athlete ID</h3>
                            <button onClick={() => setShowIdModal(null)} className="text-slate-400 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="text-center mb-4">
                            <p className="text-lg font-semibold text-white">{showIdModal.name}</p>
                            <p className="text-sm text-slate-400">{showIdModal.dojo}</p>
                            <p className="text-xs text-slate-500 mt-1">
                                Class {showIdModal.age_class} · Weight {showIdModal.weight_class} · {showIdModal.weight}kg
                            </p>
                        </div>

                        {/* Tab Switcher */}
                        <div className="flex gap-1 p-1 bg-white/5 rounded-xl mb-4">
                            <button onClick={() => setIdTab('qr')}
                                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${idTab === 'qr' ? 'bg-red-500/20 text-red-400 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}>
                                <QrCode size={16} /> QR Code
                            </button>
                            <button onClick={() => { setIdTab('barcode'); fetchBarcode(showIdModal); }}
                                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${idTab === 'barcode' ? 'bg-amber-500/20 text-amber-400 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}>
                                <Barcode size={16} /> Barcode
                            </button>
                        </div>

                        {/* QR Tab */}
                        {idTab === 'qr' && (
                            <div className="flex flex-col items-center">
                                {showIdModal.qr_code ? (
                                    <div className="bg-white p-4 rounded-xl">
                                        <img src={showIdModal.qr_code} alt="QR Code" className="w-48 h-48" />
                                    </div>
                                ) : (
                                    <div className="w-48 h-48 bg-white/5 rounded-xl flex items-center justify-center">
                                        <span className="text-sm text-slate-500">Loading...</span>
                                    </div>
                                )}
                                <p className="text-xs text-slate-500 mt-3">Scan with QR reader for verification</p>
                            </div>
                        )}

                        {/* Barcode Tab */}
                        {idTab === 'barcode' && (
                            <div className="flex flex-col items-center">
                                {showIdModal.barcode ? (
                                    <div className="bg-white p-4 rounded-xl">
                                        <img src={showIdModal.barcode} alt="Barcode" className="max-w-full" />
                                    </div>
                                ) : (
                                    <div className="w-64 h-24 bg-white/5 rounded-xl flex items-center justify-center">
                                        <span className="text-sm text-slate-500">Loading barcode...</span>
                                    </div>
                                )}
                                <p className="text-xs text-slate-500 mt-3">Code 128 · Fallback identification</p>
                            </div>
                        )}

                        <div className="mt-5 flex gap-2 justify-center">
                            <span className={`badge ${getStatusBadge(showIdModal.status)}`}>{showIdModal.status}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
