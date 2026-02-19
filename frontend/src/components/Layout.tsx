import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    LayoutDashboard, Users, ScanLine, Trophy, Swords,
    Monitor, Award, LogOut, Menu, X
} from 'lucide-react';
import { useState } from 'react';

export default function Layout() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const navItems = [
        { to: '/', icon: LayoutDashboard, label: 'Dashboard', roles: ['ADMIN', 'ATHLETE', 'SPECTATOR'] },
        { to: '/athletes', icon: Users, label: 'Athletes', roles: ['ADMIN'] },
        { to: '/scanner', icon: ScanLine, label: 'QR Scanner', roles: ['ADMIN'] },
        { to: '/events', icon: Trophy, label: 'Events', roles: ['ADMIN', 'ATHLETE', 'SPECTATOR'] },
        { to: '/scoring', icon: Swords, label: 'Scoring', roles: ['ADMIN'] },
        { to: '/scoreboard', icon: Monitor, label: 'Scoreboard', roles: ['ADMIN', 'ATHLETE', 'SPECTATOR'] },
        { to: '/certificates', icon: Award, label: 'Certificates', roles: ['ADMIN'] },
    ];

    const filteredNav = navItems.filter(item => user && item.roles.includes(user.role));

    return (
        <div className="flex min-h-screen">
            {/* Mobile menu button */}
            <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="fixed top-4 left-4 z-50 p-2 rounded-lg bg-surface-light lg:hidden"
            >
                {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>

            {/* Sidebar */}
            <aside className={`
        fixed lg:static inset-y-0 left-0 z-40 w-64 
        bg-surface/95 backdrop-blur-xl border-r border-white/5
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
                <div className="flex flex-col h-full">
                    {/* Logo */}
                    <div className="p-6 border-b border-white/5">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center text-xl">
                                🥋
                            </div>
                            <div>
                                <h1 className="text-lg font-bold text-white">KarateTMS</h1>
                                <p className="text-xs text-slate-400">Tournament System</p>
                            </div>
                        </div>
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 p-4 space-y-1">
                        {filteredNav.map((item) => (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                onClick={() => setSidebarOpen(false)}
                                className={({ isActive }) => `
                  flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium
                  transition-all duration-200
                  ${isActive
                                        ? 'bg-gradient-to-r from-red-600/20 to-transparent text-red-400 border-l-[3px] border-red-500'
                                        : 'text-slate-400 hover:text-white hover:bg-white/5'}
                `}
                            >
                                <item.icon size={18} />
                                {item.label}
                            </NavLink>
                        ))}
                    </nav>

                    {/* User info */}
                    <div className="p-4 border-t border-white/5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-white">{user?.username}</p>
                                <p className="text-xs text-slate-400">{user?.role}</p>
                            </div>
                            <button
                                onClick={handleLogout}
                                className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-red-400 transition-colors"
                            >
                                <LogOut size={18} />
                            </button>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Overlay for mobile */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-30 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Main content */}
            <main className="flex-1 lg:ml-0 min-h-screen">
                <div className="p-4 lg:p-8 pt-16 lg:pt-8">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
