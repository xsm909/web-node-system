import type { ReactNode } from 'react';
import { Sidebar } from '../../../shared/ui/sidebar';
import { Icon } from '../../../shared/ui/icon';
import { ThemeToggle } from '../../../shared/ui/theme-toggle/ThemeToggle';
import { useAuthStore } from '../../../features/auth/store';
import { useMemo } from 'react';
import { type SelectionItem, type SelectionGroup } from '../../../shared/ui/selection-list';
import { ComboBox } from '../../../shared/ui/combo-box';
import { useClientStore } from '../../../features/workflow-management/model/clientStore';

export interface NavItem {
    id: string;
    label: string;
    icon: string;
    isActive: boolean;
    onClick: () => void;
}

interface AppSidebarProps {
    title: ReactNode;
    headerIcon?: string;
    navItems?: NavItem[];
    customContent?: ReactNode;
    isOpen?: boolean;
    onClose?: () => void;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
    title,
    headerIcon = 'bolt',
    navItems = [],
    customContent,
    isOpen = true,
    onClose,
}) => {
    const { user, logout } = useAuthStore();
    const { activeClientId, assignedUsers, setActiveClientId } = useClientStore();

    const activeClient = useMemo(() =>
        assignedUsers.find(u => u.id === activeClientId),
        [assignedUsers, activeClientId]
    );

    const selectionData = useMemo(() => {
        const data: Record<string, SelectionGroup> = {};

        assignedUsers.forEach(u => {
            data[u.username] = {
                id: u.id,
                name: u.username,
                items: [],
                children: {}
            };
        });

        return data;
    }, [assignedUsers]);

    const handleSelect = (item: SelectionItem) => {
        setActiveClientId(item.id === 'all' ? null : item.id);
    };

    return (
        <Sidebar
            className="w-72"
            isOpen={isOpen}
            onClose={onClose}
            header={
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-brand/10 flex items-center justify-center border border-brand/20 shadow-lg shadow-brand/5">
                            <Icon name={headerIcon} size={20} className="text-brand" />
                        </div>
                        <div className="text-xl font-black tracking-tight bg-gradient-to-r from-brand to-brand/60 bg-clip-text text-transparent">
                            {title}
                        </div>
                    </div>
                    {onClose && (
                        <button
                            className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--border-muted)] lg:hidden"
                            onClick={onClose}
                        >
                            <Icon name="close" size={20} />
                        </button>
                    )}
                </div>
            }
            content={
                <>
                    <div className="mb-6">
                        <div className="px-3 py-2 text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest opacity-50">Active Client</div>
                        <ComboBox
                            variant="sidebar"
                            value={activeClientId || 'all'}
                            label={activeClient?.username || 'Not selected'}
                            icon={activeClient ? 'person' : 'group'}
                            data={selectionData}
                            onSelect={handleSelect}
                            searchPlaceholder="Find client..."
                        />
                    </div>

                    {navItems.length > 0 && (
                        <nav className="space-y-1 mb-6">
                            {navItems.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={item.onClick}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group ${item.isActive
                                        ? 'bg-brand/10 text-brand font-semibold shadow-sm ring-1 ring-brand/20'
                                        : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--border-muted)]'
                                        }`}
                                >
                                    <Icon
                                        name={item.icon}
                                        size={20}
                                        className={`transition-transform group-hover:scale-110 ${item.isActive ? 'scale-110' : 'opacity-60'}`}
                                    />
                                    <span className="text-sm font-bold">{item.label}</span>
                                </button>
                            ))}
                        </nav>
                    )}
                    {customContent}
                </>
            }
            footer={
                <div className="space-y-4">
                    {user && (
                        <div className="flex items-center gap-3 px-3">
                            <div className="w-10 h-10 rounded-2xl bg-brand/10 flex items-center justify-center text-brand font-black text-xs border border-brand/20">
                                {user.username?.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-xs font-bold text-[var(--text-main)] truncate">{user.username}</div>
                                <div className="text-[10px] text-[var(--text-muted)] font-black uppercase tracking-wider truncate opacity-60">
                                    {user.role}
                                </div>
                            </div>
                        </div>
                    )}
                    <div className="flex gap-2">
                        <button
                            className="flex-1 px-4 py-3 rounded-2xl text-xs font-bold text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 border border-[var(--border-base)] hover:border-red-500/20 transition-all flex items-center justify-center gap-2 active:scale-95"
                            onClick={logout}
                        >
                            <Icon name="signout" size={16} />
                            <span>Sign Out</span>
                        </button>
                        <ThemeToggle />
                    </div>
                </div>
            }
        />
    );
};
