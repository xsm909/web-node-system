import { useEffect, useState } from 'react';
import { useAuthStore } from '../../features/auth/store';
import { apiClient } from '../../shared/api/client';

interface WorkflowResult {
    id: string;
    workflow_name: string;
    status: 'pending' | 'running' | 'success' | 'failed';
    created_at: string;
    result_summary: string;
}

import { ThemeToggle } from '../../shared/ui/theme-toggle/ThemeToggle';

export default function ClientPage() {
    const { logout } = useAuthStore();
    const [results, setResults] = useState<WorkflowResult[]>([]);

    useEffect(() => {
        apiClient.get('/client/results').then((r) => setResults(r.data)).catch(() => { });
    }, []);

    const statusConfig: Record<string, { color: string, bg: string, ring: string }> = {
        pending: { color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-400/10', ring: 'ring-amber-400/20' },
        running: { color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-400/10', ring: 'ring-blue-400/20' },
        success: { color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-400/10', ring: 'ring-emerald-400/20' },
        failed: { color: 'text-red-600 dark:text-red-400', bg: 'bg-red-400/10', ring: 'ring-red-400/20' },
    };

    return (
        <div className="min-h-screen bg-surface-900 text-[var(--text-main)] flex flex-col font-sans selection:bg-brand/30">
            <header className="sticky top-0 z-50 flex items-center justify-between px-8 h-20 bg-surface-900/80 backdrop-blur-md border-b border-[var(--border-base)]">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-brand/10 flex items-center justify-center border border-brand/20 shadow-lg shadow-brand/5">
                        <span className="text-xl">⚡</span>
                    </div>
                    <div>
                        <h1 className="text-lg font-bold tracking-tight">Workflow Engine</h1>
                        <p className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-widest leading-none mt-0.5 opacity-60">Control Center</p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 mr-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Client Portal Active</span>
                    </div>
                    <ThemeToggle />
                    <div className="w-px h-6 bg-[var(--border-base)] mx-1" />
                    <button
                        className="px-5 py-2.5 rounded-xl text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--border-muted)] border border-[var(--border-base)] transition-all active:scale-95"
                        onClick={logout}
                    >
                        Sign Out
                    </button>
                </div>
            </header>

            <main className="flex-1 w-full max-w-7xl mx-auto px-8 py-12">
                <div className="flex items-center justify-between mb-10">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight mb-2">My Workflows</h2>
                        <p className="text-[var(--text-muted)] text-sm font-medium opacity-80">Monitoring your automated processes and result summaries.</p>
                    </div>
                    <button className="px-6 py-3 rounded-2xl bg-brand text-white text-sm font-bold shadow-xl shadow-brand/20 hover:brightness-110 active:scale-95 transition-all">
                        New Execution
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {results.length === 0 && (
                        <div className="col-span-full flex flex-col items-center justify-center py-20 px-4 rounded-3xl border-2 border-dashed border-[var(--border-base)] bg-[var(--border-muted)]/30">
                            <div className="w-16 h-16 rounded-full bg-[var(--border-base)] flex items-center justify-center mb-4">
                                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-muted)] opacity-30">
                                    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                                </svg>
                            </div>
                            <p className="text-[var(--text-muted)] font-medium opacity-60">No workflow results detected yet.</p>
                        </div>
                    )}

                    {results.map((r) => (
                        <div
                            key={r.id}
                            className="group relative flex flex-col bg-surface-800 border border-[var(--border-base)] rounded-3xl p-6 transition-all hover:bg-[var(--border-muted)]/50 hover:shadow-2xl hover:shadow-black/5 dark:hover:shadow-black/40"
                        >
                            <div className="flex items-start justify-between mb-6">
                                <div className="p-3 rounded-2xl bg-[var(--border-muted)] border border-[var(--border-base)] group-hover:bg-brand/10 group-hover:border-brand/20 transition-all">
                                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-muted)] group-hover:text-brand transition-colors opacity-60 group-hover:opacity-100">
                                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                                        <polyline points="14 2 14 8 20 8" />
                                        <line x1="16" y1="13" x2="8" y2="13" />
                                        <line x1="16" y1="17" x2="8" y2="17" />
                                        <polyline points="10 9 9 9 8 9" />
                                    </svg>
                                </div>
                                <span className={`
                                    px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ring-1 ring-inset
                                    ${statusConfig[r.status].color} ${statusConfig[r.status].bg} ${statusConfig[r.status].ring}
                                `}>
                                    {r.status}
                                </span>
                            </div>

                            <h3 className="text-lg font-bold text-[var(--text-main)] mb-2 group-hover:text-brand transition-colors">{r.workflow_name}</h3>
                            <p className="text-sm text-[var(--text-muted)] line-clamp-2 mb-6 flex-1 opacity-80">{r.result_summary || 'No output data recorded for this run.'}</p>

                            <div className="flex items-center justify-between pt-4 border-t border-[var(--border-base)] mt-auto">
                                <div className="flex items-center gap-2">
                                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-muted)] opacity-40">
                                        <circle cx="12" cy="12" r="10" />
                                        <polyline points="12 6 12 12 16 14" />
                                    </svg>
                                    <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-tight opacity-40">
                                        {new Date(r.created_at).toLocaleDateString()}
                                    </span>
                                </div>
                                <button className="text-[10px] font-bold text-brand uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                                    View Details →
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </main>
        </div>
    );
}


