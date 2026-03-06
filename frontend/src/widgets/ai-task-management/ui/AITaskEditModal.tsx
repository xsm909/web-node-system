import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../../features/auth/store';
import { apiClient } from '../../../shared/api/client';
import type { AITask } from '../../../entities/ai-task/model/types';
import { Icon } from '../../../shared/ui/icon';
import { ComboBox } from '../../../shared/ui/combo-box/ComboBox';
import { DataTypeSelect } from '../../../shared/ui/data-type-select';
import type { SelectionGroup } from '../../../shared/ui/selection-list/SelectionList';

interface AITaskEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    task: AITask | null;
    onSave: () => void;
    defaultOwnerId?: string;
}

// Categories fetched dynamically

const MODEL_DATA: Record<string, SelectionGroup> = {
    'Any Model': { id: 'any', name: 'Any Model', icon: 'auto_awesome', selectable: true, items: [], children: {} },
    'GPT-4o': { id: 'gpt-4o', name: 'GPT-4o', icon: 'bolt', selectable: true, items: [], children: {} },
    'Claude 3.5 Sonnet': { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', icon: 'smart_toy', selectable: true, items: [], children: {} },
    'Gemini 1.5 Pro': { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', icon: 'tempest', selectable: true, items: [], children: {} },
};

export const AITaskEditModal: React.FC<AITaskEditModalProps> = ({ isOpen, onClose, task, onSave, defaultOwnerId }) => {
    const queryClient = useQueryClient();
    const { user } = useAuthStore();
    const isAdmin = user?.role === 'admin';

    const [taskText, setTaskText] = useState('');
    const [category, setCategory] = useState('');
    const [model, setModel] = useState('');
    const [ownerId, setOwnerId] = useState('');



    useEffect(() => {
        if (isOpen) {
            if (task) {
                setTaskText(task.task?.Task || '');
                setCategory(task.category || '');
                setModel(task.ai_model || 'any');
                setOwnerId(task.owner_id || '');
            } else {
                setTaskText('');
                setCategory('');
                setModel('any');
                setOwnerId(defaultOwnerId || '');
            }
        }
    }, [isOpen, task, defaultOwnerId]);

    const mutation = useMutation({
        mutationFn: async () => {
            const payload = {
                owner_id: ownerId,
                category,
                ai_model: model,
                task: { Task: taskText }
            };
            if (task) {
                await apiClient.put(`/ai-tasks/${task.id}`, payload);
            } else {
                await apiClient.post('/ai-tasks/', payload);
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ai-tasks'] });
            onSave();
            onClose();
        },
        onError: (error) => {
            console.error('Failed to update AI Task', error);
        }
    });

    if (!isOpen) return null;

    const isEdit = !!task;

    // Helper to find label for ComboBox

    const getModelLabel = (id: string) => {
        return Object.values(MODEL_DATA).find(g => g.id === id)?.name;
    };

    const getModelIcon = (id: string) => {
        return Object.values(MODEL_DATA).find(g => g.id === id)?.icon;
    };

    return (
        <div className="fixed inset-0 z-[1001] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
            <div className="w-full max-w-2xl bg-surface-800 border border-[var(--border-base)] rounded-[2.5rem] shadow-2xl overflow-hidden ring-1 ring-black/5 dark:ring-white/5 animate-in zoom-in-95 duration-500">
                <header className="px-10 py-8 border-b border-[var(--border-base)] flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-brand/10 flex items-center justify-center text-brand border border-brand/20">
                            <Icon name={isEdit ? "bolt" : "add"} size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-[var(--text-main)] tracking-tight">
                                {isEdit ? 'Edit AI Task' : 'Create AI Task'}
                            </h2>
                            <p className="text-[10px] text-[var(--text-muted)] font-black uppercase tracking-widest opacity-60">
                                {isEdit ? 'Configure task parameters and content' : 'Create a new automated AI routine'}
                            </p>
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
                    {isAdmin && (
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">Owner ID (Client UID)</label>
                            <input
                                value={ownerId}
                                onChange={(e) => setOwnerId(e.target.value)}
                                className="w-full px-5 py-3 rounded-2xl bg-[var(--bg-app)] border border-[var(--border-base)] text-[var(--text-main)] font-medium focus:ring-2 focus:ring-brand outline-none transition-all"
                                placeholder="e.g., common or UUID"
                            />
                        </div>
                    )}

                    <div className={`grid ${isAdmin ? 'grid-cols-2' : 'grid-cols-1'} gap-6`}>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">Category</label>
                            <DataTypeSelect
                                value={category}
                                onChange={(val: string) => setCategory(val)}
                                categoryFilter="AI_question"
                                valueProp="type"
                                className="w-full"
                            />
                        </div>
                        {isAdmin && (
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">AI Model</label>
                                <ComboBox
                                    value={model}
                                    label={getModelLabel(model)}
                                    icon={getModelIcon(model)}
                                    placeholder="Select model..."
                                    data={MODEL_DATA}
                                    onSelect={(item) => setModel(item.id)}
                                    className="w-full"
                                />
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">Task Description (JSON "Task" field)</label>
                        <textarea
                            value={taskText}
                            onChange={(e) => setTaskText(e.target.value)}
                            rows={6}
                            className="w-full px-5 py-4 rounded-2xl bg-[var(--bg-app)] border border-[var(--border-base)] text-[var(--text-main)] font-medium focus:ring-2 focus:ring-brand outline-none transition-all resize-none font-sans leading-relaxed"
                            placeholder="Describe the task instructions here..."
                        />
                        <p className="text-[10px] text-[var(--text-muted)] italic opacity-60 ml-1">
                            This content will be saved as {"{ \"Task\": \"value\" }"} in the database.
                        </p>
                    </div>
                </div>

                <div className="px-10 py-8 bg-[var(--border-muted)]/30 border-t border-[var(--border-base)] flex items-center justify-end gap-4">
                    <button
                        onClick={onClose}
                        className="px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] hover:text-[var(--text-main)] transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => mutation.mutate()}
                        disabled={mutation.isPending}
                        className="px-8 py-3 rounded-2xl bg-brand text-white text-[10px] font-black uppercase tracking-widest shadow-xl shadow-brand/20 hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
                    >
                        {mutation.isPending ? (isEdit ? 'Updating...' : 'Creating...') : (isEdit ? 'Save Changes' : 'Create Task')}
                    </button>
                </div>
            </div>
        </div>
    );
};
