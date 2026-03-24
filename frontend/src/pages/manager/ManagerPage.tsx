import { useState } from 'react';
import { AppSidebar } from '../../widgets/app-sidebar';
import { Icon } from '../../shared/ui/icon';

export default function ManagerPage() {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    return (
        <div className="fixed inset-0 flex bg-[var(--bg-app)] text-[var(--text-main)] overflow-hidden font-sans">
            <AppSidebar
                title="Manager Workspace"
                headerIcon="bolt"
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
                navItems={[
                    {
                        id: 'dashboard',
                        label: 'Dashboard',
                        icon: 'dashboard',
                        isActive: true,
                        onClick: () => {},
                    }
                ]}
            />

            <main className="flex-1 flex flex-col min-h-0 min-w-0 relative">
                <header className="h-16 border-b border-[var(--border-base)] flex items-center px-8 shrink-0 bg-[var(--bg-app)]/80 backdrop-blur-md sticky top-0 z-30">
                    <button 
                        onClick={() => setIsSidebarOpen(true)}
                        className="p-2 -ml-2 rounded-xl hover:bg-[var(--border-muted)] transition-colors lg:hidden"
                    >
                        <Icon name="menu" size={20} />
                    </button>
                    <div className="flex-1 ml-4 lg:ml-0">
                        <h1 className="text-xl font-bold tracking-tight">Manager Dashboard</h1>
                    </div>
                </header>

                <div className="flex-1 flex items-center justify-center p-8">
                    <div className="max-w-md w-full text-center space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <div className="w-20 h-20 mx-auto rounded-3xl bg-brand/10 flex items-center justify-center border border-brand/20 shadow-xl shadow-brand/5">
                            <Icon name="construction" size={32} className="text-brand" />
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-2xl font-black tracking-tight bg-gradient-to-r from-[var(--text-main)] to-[var(--text-main)]/60 bg-clip-text text-transparent">
                                Under Construction
                            </h2>
                            <p className="text-sm text-[var(--text-muted)] font-medium leading-relaxed opacity-60">
                                The manager workspace is currently being optimized. 
                                All management functionality has been centralized in the Administrator dashboard for this phase.
                            </p>
                        </div>
                        <div className="pt-4">
                            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--border-muted)]/50 border border-[var(--border-base)] text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] opacity-50">
                                <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
                                Coming Soon
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

