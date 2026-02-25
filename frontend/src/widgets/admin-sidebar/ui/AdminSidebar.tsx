import { Icon } from '../../../shared/ui/icon';
import { ThemeToggle } from '../../../shared/ui/theme-toggle/ThemeToggle';

interface AdminSidebarProps {
    activeTab: 'users' | 'nodes' | 'credentials';
    setActiveTab: (tab: 'users' | 'nodes' | 'credentials') => void;
    onLogout: () => void;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({ activeTab, setActiveTab, onLogout }) => {
    return (
        <aside className="w-64 bg-surface-800 border-r border-[var(--border-base)] flex flex-col h-full ring-1 ring-black/5 dark:ring-white/5">
            <div className="p-6">
                <div className="flex items-center gap-3 text-xl font-bold bg-gradient-to-r from-brand to-emerald-400 bg-clip-text text-transparent">
                    <Icon name="bolt" size={24} className="text-brand" />
                    Workflow Engine
                </div>
            </div>

            <nav className="flex-1 px-3 space-y-1">
                <button
                    onClick={() => setActiveTab('users')}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group ${activeTab === 'users'
                        ? 'bg-brand/10 text-brand font-semibold shadow-sm ring-1 ring-brand/20'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--border-muted)]'
                        }`}
                >
                    <Icon
                        name="people"
                        size={20}
                        className={`transition-transform group-hover:scale-110 ${activeTab === 'users' ? 'scale-110' : 'opacity-60'}`}
                    />
                    <span className="text-sm font-bold">Users</span>
                </button>

                <button
                    onClick={() => setActiveTab('nodes')}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group ${activeTab === 'nodes'
                        ? 'bg-brand/10 text-brand font-semibold shadow-sm ring-1 ring-brand/20'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--border-muted)]'
                        }`}
                >
                    <Icon
                        name="build"
                        size={20}
                        className={`transition-transform group-hover:scale-110 ${activeTab === 'nodes' ? 'scale-110' : 'opacity-60'}`}
                    />
                    <span className="text-sm font-bold">Node Types</span>
                </button>

                <button
                    onClick={() => setActiveTab('credentials')}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group ${activeTab === 'credentials'
                        ? 'bg-brand/10 text-brand font-semibold shadow-sm ring-1 ring-brand/20'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--border-muted)]'
                        }`}
                >
                    <Icon
                        name="key"
                        size={20}
                        className={`transition-transform group-hover:scale-110 ${activeTab === 'credentials' ? 'scale-110' : 'opacity-60'}`}
                    />
                    <span className="text-sm font-bold">Credentials</span>
                </button>
            </nav>

            <div className="p-4 border-t border-[var(--border-base)] flex gap-2">
                <button
                    onClick={onLogout}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold text-[var(--text-muted)] border border-[var(--border-base)] hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20 transition-all active:scale-[0.98]"
                >
                    <Icon name="logout" size={18} />
                    Sign Out
                </button>
                <ThemeToggle />
            </div>
        </aside>
    );
};


