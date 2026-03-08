import type { Report } from '../../../entities/report/model/types';
import { Icon } from '../../../shared/ui/icon';

interface ReportListProps {
    reports: Report[];
    isAdmin: boolean;
    onCreate: () => void;
    onEdit: (report: Report) => void;
    onView: (report: Report) => void;
}

export function ReportList({ reports, isAdmin, onCreate, onEdit, onView }: ReportListProps) {
    return (
        <div className="flex flex-col h-full bg-[var(--bg-app)]">
            <div className="flex-1 p-8 overflow-y-auto">
                <div className="max-w-7xl mx-auto space-y-6">
                    <div className="flex justify-between items-center mb-8">
                        <div>
                            <h2 className="text-2xl font-bold text-[var(--text-main)] tracking-tight">Reports</h2>
                            <p className="text-sm text-[var(--text-muted)] mt-1">
                                {isAdmin ? 'Manage and create custom reports' : 'View available reports'}
                            </p>
                        </div>
                        {isAdmin && (
                            <button
                                onClick={onCreate}
                                className="flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-xl shadow-lg shadow-brand/20 hover:brightness-110 active:scale-95 transition-all font-bold text-sm"
                            >
                                <Icon name="add" size={18} />
                                Add Report
                            </button>
                        )}
                    </div>

                    {reports.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-12 text-center bg-[var(--border-muted)]/30 rounded-3xl border border-dashed border-[var(--border-base)]">
                            <div className="w-16 h-16 rounded-2xl bg-[var(--border-base)]/50 flex items-center justify-center mb-4">
                                <Icon name="docs" size={32} className="text-[var(--text-muted)] opacity-50" />
                            </div>
                            <h3 className="text-lg font-bold text-[var(--text-main)] mb-2">No Reports Found</h3>
                            <p className="text-sm text-[var(--text-muted)] max-w-sm">
                                {isAdmin ? 'Create your first custom report to get started.' : 'There are no reports available at the moment.'}
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {reports.map(report => (
                                <div
                                    key={report.id}
                                    className="group relative flex flex-col p-6 rounded-2xl bg-[var(--bg-app)] border border-[var(--border-base)] shadow-sm hover:shadow-md transition-all hover:border-[var(--brand)]/30"
                                >
                                    <div className="flex items-start justify-between mb-4 min-w-0">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-10 h-10 rounded-xl bg-brand/10 flex-shrink-0 flex items-center justify-center text-brand">
                                                <Icon name="bar_chart" size={20} />
                                            </div>
                                            <div className="min-w-0">
                                                <h3 className="font-bold text-[var(--text-main)] truncate" title={report.name}>
                                                    {report.name}
                                                </h3>
                                                <span className="text-[10px] uppercase font-black tracking-wider text-[var(--text-muted)] px-2 py-0.5 rounded-full bg-[var(--border-muted)]">
                                                    {report.type}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <p className="text-sm text-[var(--text-muted)] line-clamp-2 mb-6 flex-1">
                                        {report.description || 'No description provided.'}
                                    </p>

                                    <div className="flex gap-2 mt-auto">
                                        <button
                                            onClick={() => onView(report)}
                                            className="flex-1 py-2 px-3 rounded-lg bg-[var(--border-muted)] text-[var(--text-main)] text-sm font-bold hover:bg-[var(--border-base)] transition-colors text-center"
                                        >
                                            Open
                                        </button>
                                        {isAdmin && (
                                            <button
                                                onClick={() => onEdit(report)}
                                                className="px-3 py-2 rounded-lg text-brand hover:bg-brand/10 transition-colors"
                                                title="Edit Report"
                                            >
                                                <Icon name="edit" size={18} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
