import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../shared/api/client';
import type { User } from '../../../entities/user/model/types';
import { Icon } from '../../../shared/ui/icon';
import { ComboBox } from '../../../shared/ui/combo-box';
import type { SelectionGroup } from '../../../shared/ui/selection-list';

interface UserEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: User | null;
    onSave: () => void;
}

export const UserEditModal: React.FC<UserEditModalProps> = ({ isOpen, onClose, user, onSave }) => {
    const queryClient = useQueryClient();
    const [selectedManagerId, setSelectedManagerId] = useState<string>('');

    const { data: managers = [] } = useQuery({
        queryKey: ['admin-managers'],
        queryFn: async () => {
            const response = await apiClient.get<User[]>('/admin/managers');
            return response.data;
        },
        enabled: isOpen && user?.role === 'client',
    });

    useEffect(() => {
        if (isOpen && user?.role === 'client') {
            const currentManager = user.assigned_managers?.[0];
            setSelectedManagerId(currentManager?.id || '');
        }
    }, [isOpen, user]);

    const managersData: Record<string, SelectionGroup> = useMemo(() => {
        const data: Record<string, SelectionGroup> = {};
        managers.forEach(m => {
            data[m.username] = {
                id: m.id,
                name: m.username,
                selectable: true,
                icon: 'person',
                items: [],
                children: {}
            };
        });
        return data;
    }, [managers]);

    const mutation = useMutation({
        mutationFn: async () => {
            if (!user) return;
            const currentManagerId = user.assigned_managers?.[0]?.id;

            // If manager changed
            if (selectedManagerId !== currentManagerId) {
                // Remove old if exists
                if (currentManagerId) {
                    await apiClient.delete(`/admin/users/manager-assignment/${currentManagerId}/${user.id}`);
                }
                // Add new if selected
                if (selectedManagerId) {
                    await apiClient.post(`/admin/users/${selectedManagerId}/assign/${user.id}`);
                }
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-users'] });
            onSave();
            onClose();
        },
        onError: (error) => {
            console.error('Failed to save manager assignment', error);
        }
    });

    if (!isOpen || !user) return null;

    const handleSave = () => {
        mutation.mutate();
    };

    const selectedManager = managers.find(m => m.id === selectedManagerId);

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
            <div className="w-full max-w-lg bg-surface-800 border border-[var(--border-base)] rounded-[2.5rem] shadow-[0_0_100px_rgba(0,0,0,0.5)] overflow-hidden ring-1 ring-black/5 dark:ring-white/5 animate-in zoom-in-95 slide-in-from-bottom-8 duration-500 ease-out">
                <header className="px-10 py-8 border-b border-[var(--border-base)] flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-brand/10 flex items-center justify-center text-brand border border-brand/20">
                            <Icon name="person" size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-[var(--text-main)] tracking-tight">User Details</h2>
                            <p className="text-[10px] text-[var(--text-muted)] font-black uppercase tracking-widest opacity-60">Manage permissions & roles</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--border-muted)] transition-all"
                    >
                        <Icon name="close" size={20} />
                    </button>
                </header>

                <div className="p-10 space-y-8">
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">Username</label>
                            <div className="px-5 py-3 rounded-2xl bg-[var(--bg-app)] border border-[var(--border-base)] text-[var(--text-main)] font-bold">
                                {user.username}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">Role</label>
                            <div className="px-5 py-3 rounded-2xl bg-[var(--bg-app)] border border-[var(--border-base)]">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest ring-1 ring-inset ${user.role === 'admin'
                                    ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 ring-indigo-500/20'
                                    : user.role === 'manager'
                                        ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 ring-blue-500/20'
                                        : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20'
                                    }`}>
                                    {user.role}
                                </span>
                            </div>
                        </div>
                    </div>

                    {user.role === 'client' && (
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">Responsible Manager</label>
                            <ComboBox
                                value={selectedManagerId}
                                label={selectedManager?.username || 'Select Manager...'}
                                placeholder="Select Manager..."
                                data={managersData}
                                onSelect={(item) => setSelectedManagerId(item.id)}
                                variant="primary"
                                className="w-full"
                                config={{ groupActions: [] }}
                            />
                            {selectedManagerId && (
                                <button
                                    onClick={() => setSelectedManagerId('')}
                                    className="text-[10px] font-bold text-red-500/60 hover:text-red-500 uppercase tracking-widest transition-colors ml-1"
                                >
                                    Clear Assignment
                                </button>
                            )}
                        </div>
                    )}
                </div>

                <div className="px-10 py-8 bg-[var(--border-muted)]/30 border-t border-[var(--border-base)] flex items-center justify-end gap-4">
                    <button
                        onClick={onClose}
                        className="px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] hover:text-[var(--text-main)] transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={mutation.isPending}
                        className="px-8 py-3 rounded-2xl bg-brand text-white text-[10px] font-black uppercase tracking-widest shadow-xl shadow-brand/20 hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none"
                    >
                        {mutation.isPending ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
};
