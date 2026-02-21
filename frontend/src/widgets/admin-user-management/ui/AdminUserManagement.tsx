import React from 'react';
import type { User } from '../../../entities/user/model/types';

interface AdminUserManagementProps {
    users: User[];
}

export const AdminUserManagement: React.FC<AdminUserManagementProps> = ({ users }) => {
    return (
        <div className="bg-surface-800 rounded-2xl border border-white/5 overflow-hidden shadow-sm ring-1 ring-white/5">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-white/5 bg-white/[0.02]">
                            <th className="px-6 py-4 text-[11px] font-semibold text-white/40 uppercase tracking-wider">ID</th>
                            <th className="px-6 py-4 text-[11px] font-semibold text-white/40 uppercase tracking-wider">Username</th>
                            <th className="px-6 py-4 text-[11px] font-semibold text-white/40 uppercase tracking-wider">Role</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {users.map((u) => (
                            <tr key={u.id} className="hover:bg-white/[0.02] transition-colors group">
                                <td className="px-6 py-4 text-sm font-mono text-white/30 group-hover:text-white/50 transition-colors">
                                    {u.id.slice(0, 8)}...
                                </td>
                                <td className="px-6 py-4 text-sm font-medium text-white/80 group-hover:text-white transition-colors">
                                    {u.username}
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset ${u.role === 'admin'
                                            ? 'bg-purple-500/10 text-purple-400 ring-purple-500/20'
                                            : u.role === 'manager'
                                                ? 'bg-blue-500/10 text-blue-400 ring-blue-500/20'
                                                : 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20'
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
                <div className="p-12 text-center text-white/30 text-sm">
                    No users found.
                </div>
            )}
        </div>
    );
};
