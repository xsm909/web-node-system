import React from 'react';

interface AdminSidebarProps {
    activeTab: 'users' | 'nodes' | 'credentials';
    setActiveTab: (tab: 'users' | 'nodes' | 'credentials') => void;
    onLogout: () => void;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({ activeTab, setActiveTab, onLogout }) => {
    return (
        <aside className="w-64 bg-surface-800 border-r border-white/5 flex flex-col h-full ring-1 ring-white/5">
            <div className="p-6">
                <div className="text-xl font-bold bg-gradient-to-r from-brand to-purple-400 bg-clip-text text-transparent">
                    ⚡ Workflow Engine
                </div>
            </div>

            <nav className="flex-1 px-3 space-y-1">
                <button
                    onClick={() => setActiveTab('users')}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group ${activeTab === 'users'
                            ? 'bg-brand/10 text-brand font-semibold shadow-sm ring-1 ring-brand/20'
                            : 'text-white/50 hover:text-white hover:bg-white/5'
                        }`}
                >
                    <span className={`text-lg transition-transform group-hover:scale-110 ${activeTab === 'users' ? 'scale-110' : ''}`}>👥</span>
                    <span className="text-sm">Users</span>
                </button>

                <button
                    onClick={() => setActiveTab('nodes')}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group ${activeTab === 'nodes'
                            ? 'bg-brand/10 text-brand font-semibold shadow-sm ring-1 ring-brand/20'
                            : 'text-white/50 hover:text-white hover:bg-white/5'
                        }`}
                >
                    <span className={`text-lg transition-transform group-hover:scale-110 ${activeTab === 'nodes' ? 'scale-110' : ''}`}>🔧</span>
                    <span className="text-sm">Node Types</span>
                </button>

                <button
                    onClick={() => setActiveTab('credentials')}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group ${activeTab === 'credentials'
                            ? 'bg-brand/10 text-brand font-semibold shadow-sm ring-1 ring-brand/20'
                            : 'text-white/50 hover:text-white hover:bg-white/5'
                        }`}
                >
                    <span className={`text-lg transition-transform group-hover:scale-110 ${activeTab === 'credentials' ? 'scale-110' : ''}`}>🔑</span>
                    <span className="text-sm">Credentials</span>
                </button>
            </nav>

            <div className="p-4 border-t border-white/5">
                <button
                    onClick={onLogout}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium text-white/40 border border-white/5 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition-all active:scale-[0.98]"
                >
                    <span>🚪</span>
                    Sign Out
                </button>
            </div>
        </aside>
    );
};

