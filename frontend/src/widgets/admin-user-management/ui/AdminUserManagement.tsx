import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    useReactTable,
    getCoreRowModel,
    flexRender,
    createColumnHelper,
} from '@tanstack/react-table';
import { apiClient } from '../../../shared/api/client';
import type { User } from '../../../entities/user/model/types';
import { UserEditModal } from './UserEditModal';

const columnHelper = createColumnHelper<User>();

export const AdminUserManagement: React.FC = () => {
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const { data: users = [], isLoading, refetch } = useQuery({
        queryKey: ['admin-users'],
        queryFn: async () => {
            const response = await apiClient.get<User[]>('/admin/users');
            return response.data;
        },
    });

    const columns = useMemo(() => [
        columnHelper.accessor('id', {
            header: 'ID',
            cell: info => (
                <span className="font-mono text-[var(--text-muted)] opacity-40 group-hover:opacity-60 transition-opacity">
                    {info.getValue().slice(0, 8)}...
                </span>
            ),
        }),
        columnHelper.accessor('username', {
            header: 'Username',
            cell: info => <span className="font-bold text-[var(--text-main)]">{info.getValue()}</span>,
        }),
        columnHelper.accessor('role', {
            header: 'Role',
            cell: info => {
                const role = info.getValue();
                return (
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest ring-1 ring-inset ${role === 'admin'
                        ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 ring-indigo-500/20'
                        : role === 'manager'
                            ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 ring-blue-500/20'
                            : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20'
                        }`}>
                        {role}
                    </span>
                );
            },
        }),
        columnHelper.display({
            id: 'assignedManager',
            header: 'Assigned Manager',
            cell: info => {
                const user = info.row.original;
                return user.role === 'client' ? (
                    user.assigned_managers?.[0]?.username || (
                        <span className="text-[10px] font-black uppercase tracking-widest opacity-30 italic">Unassigned</span>
                    )
                ) : (
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-10">—</span>
                );
            },
        }),
    ], []);

    const table = useReactTable({
        data: users,
        columns,
        getCoreRowModel: getCoreRowModel(),
    });

    const handleRowClick = (user: User) => {
        setSelectedUser(user);
        setIsModalOpen(true);
    };

    if (isLoading && users.length === 0) {
        return (
            <div className="flex justify-center items-center h-64 bg-surface-800 rounded-3xl border border-[var(--border-base)] shadow-2xl shadow-black/5 dark:shadow-black/20 ring-1 ring-black/5 dark:ring-white/5">
                <div className="w-8 h-8 rounded-full border-2 border-[var(--border-base)] border-t-brand animate-spin" />
            </div>
        );
    }

    return (
        <>
            <div className="bg-surface-800 rounded-3xl border border-[var(--border-base)] overflow-hidden shadow-2xl shadow-black/5 dark:shadow-black/20 ring-1 ring-black/5 dark:ring-white/5">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            {table.getHeaderGroups().map(headerGroup => (
                                <tr key={headerGroup.id} className="border-b border-[var(--border-base)] bg-[var(--border-muted)]/30">
                                    {headerGroup.headers.map(header => (
                                        <th key={header.id} className="px-6 py-4 text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider opacity-60">
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(
                                                    header.column.columnDef.header,
                                                    header.getContext()
                                                )}
                                        </th>
                                    ))}
                                </tr>
                            ))}
                        </thead>
                        <tbody className="divide-y divide-[var(--border-base)]">
                            {table.getRowModel().rows.map(row => (
                                <tr
                                    key={row.id}
                                    className="hover:bg-[var(--border-muted)]/50 transition-colors group cursor-pointer"
                                    onClick={() => handleRowClick(row.original)}
                                >
                                    {row.getVisibleCells().map(cell => (
                                        <td key={cell.id} className="px-6 py-4 text-sm">
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </td>
                                    ))}
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

            <UserEditModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                user={selectedUser}
                onSave={refetch}
            />
        </>
    );
};

