import React from 'react';
import type { User } from '../../../entities/user/model/types';

interface AdminUserManagementProps {
    users: User[];
}

export const AdminUserManagement: React.FC<AdminUserManagementProps> = ({ users }) => {
    return (
        <div className="bg-surface-800 rounded-3xl border border-[var(--border-base)] overflow-hidden shadow-2xl shadow-black/5 dark:shadow-black/20 ring-1 ring-black/5 dark:ring-white/5">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-[var(--border-base)] bg-[var(--border-muted)]/30">
                            <th className="px-6 py-4 text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider opacity-60">ID</th>
                            <th className="px-6 py-4 text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider opacity-60">Username</th>
                            <th className="px-6 py-4 text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider opacity-60">Role</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-base)]">
                        {users.map((u) => (
                            <tr key={u.id} className="hover:bg-[var(--border-muted)]/50 transition-colors group">
                                <td className="px-6 py-4 text-sm font-mono text-[var(--text-muted)] opacity-40 group-hover:opacity-60 transition-opacity">
                                    {u.id.slice(0, 8)}...
                                </td>
                                <td className="px-6 py-4 text-sm font-bold text-[var(--text-main)] transition-colors">
                                    {u.username}
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest ring-1 ring-inset ${u.role === 'admin'
                                        ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 ring-indigo-500/20'
                                        : u.role === 'manager'
                                            ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 ring-blue-500/20'
                                            : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20'
                                        }`}>
                                        {u.role}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {users.length === 0 && (
                <div className="p-16 text-center text-[var(--text-muted)] text-sm opacity-40 font-medium">
                    No users detected in the system.
                </div>
            )}
        </div>
    );
};

