import React, { useState, useEffect, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../../features/auth/store';
import { apiClient } from '../../../shared/api/client';
import type { AITask } from '../../../entities/ai-task/model/types';
import { ComboBox } from '../../../shared/ui/combo-box/ComboBox';
import { DataTypeSelect } from '../../../shared/ui/data-type-select';
import type { SelectionGroup } from '../../../shared/ui/selection-list/SelectionList';
import { Icon } from '../../../shared/ui/icon';

interface AITaskEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    task: AITask | null;
    onSave: () => void;
    defaultOwnerId?: string;
    activeClientId?: string | null;
    dataTypes: any[];
}

// Categories fetched dynamically

const MODEL_DATA: Record<string, SelectionGroup> = {
    'Any Model': { id: 'any', name: 'Any Model', icon: 'auto_awesome', selectable: true, items: [], children: {} },
    'GPT-4o': { id: 'gpt-4o', name: 'GPT-4o', icon: 'bolt', selectable: true, items: [], children: {} },
    'Claude 3.5 Sonnet': { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', icon: 'smart_toy', selectable: true, items: [], children: {} },
    'Gemini 1.5 Pro': { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', icon: 'tempest', selectable: true, items: [], children: {} },
};

import { ManagementModal } from '../../../shared/ui/management-modal';

export const AITaskEditModal: React.FC<AITaskEditModalProps> = ({
    isOpen, onClose, task, onSave, defaultOwnerId, activeClientId, dataTypes
}) => {
    const queryClient = useQueryClient();
    const { user } = useAuthStore();
    const isAdmin = user?.role === 'admin';

    const [dataTypeId, setDataTypeId] = useState<string>('');
    const [model, setModel] = useState('');
    const [ownerId, setOwnerId] = useState('');
    const [description, setDescription] = useState('');

    // State for single-line vs multiline task content
    const [singleValue, setSingleValue] = useState<string>('');
    const [multiValues, setMultiValues] = useState<string[]>(['']);

    useEffect(() => {
        if (isOpen) {
            if (task) {
                setOwnerId(task.owner_id || '');
                setDataTypeId(String(task.data_type_id) || '');
                setModel(task.ai_model || 'any');
                setDescription(task.description || '');

                const taskData = task.task || {};

                // For migration backwards compatibility, if it has 'Task' we use it as single value
                // otherwise we use our new 'value' or 'values' standard format
                if (taskData.values && Array.isArray(taskData.values)) {
                    setMultiValues(taskData.values.length > 0 ? taskData.values : ['']);
                    setSingleValue('');
                } else {
                    const single = taskData.value || taskData.Task || '';
                    setSingleValue(single);
                    setMultiValues(['']);
                }
            } else {
                setOwnerId(defaultOwnerId || '');
                setDataTypeId('');
                setModel('any');
                setDescription('');
                setSingleValue('');
                setMultiValues(['']);
            }
        }
    }, [isOpen, task, defaultOwnerId]);

    // Determine current selected data type to see if it's multiline
    const selectedDataType = useMemo(() => {
        if (!dataTypeId) return null;
        return dataTypes.find(dt => String(dt.id) === dataTypeId) || null;
    }, [dataTypeId, dataTypes]);

    const isMultiline = selectedDataType?.config?.multiline === true;

    const mutation = useMutation({
        mutationFn: async () => {
            if (!dataTypeId) throw new Error('Category/Data Type is required');

            // Build task payload
            const taskContent = isMultiline
                ? { values: multiValues.filter(v => v.trim() !== '') }
                : { value: singleValue };

            const payload = {
                owner_id: ownerId,
                data_type_id: parseInt(dataTypeId, 10),
                ai_model: model,
                description: description,
                task: taskContent
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
        onError: (error: any) => {
            console.error('Failed to update AI Task', error);
            const detail = error.response?.data?.detail || error.message;
            alert(`Error saving AI Task: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
        }
    });

    const isEdit = !!task;

    const getModelLabel = (id: string) => {
        return Object.values(MODEL_DATA).find(g => g.id === id)?.name;
    };

    const getModelIcon = (id: string) => {
        return Object.values(MODEL_DATA).find(g => g.id === id)?.icon;
    };

    const addRow = () => {
        setMultiValues([...multiValues, '']);
    };

    const removeRow = (index: number) => {
        const newVals = [...multiValues];
        newVals.splice(index, 1);
        if (newVals.length === 0) newVals.push(''); // keep at least one row
        setMultiValues(newVals);
    };

    const updateRow = (index: number, val: string) => {
        const newVals = [...multiValues];
        newVals[index] = val;
        setMultiValues(newVals);
    };

    return (
        <ManagementModal
            isOpen={isOpen}
            onClose={onClose}
            icon={isEdit ? "bolt" : "add"}
            title={isEdit ? 'Edit AI Task' : 'Create AI Task'}
            description={isEdit ? 'Configure task parameters and content' : 'Create a new automated AI routine'}
            onSave={() => mutation.mutate()}
            saveButtonText={isEdit ? 'Save Changes' : 'Create Task'}
            isSaving={mutation.isPending}
            saveDisabled={mutation.isPending || !dataTypeId}
        >
            <div className={`grid ${isAdmin ? 'grid-cols-2' : 'grid-cols-1'} gap-6`}>
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">Category</label>
                    <DataTypeSelect
                        value={dataTypeId}
                        onChange={(val: string) => setDataTypeId(val)}
                        dataTypes={dataTypes}
                        categoryFilter={(!activeClientId && isAdmin) ? 'AI_Task' : 'AI_question'}
                        valueProp="id"
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

            {isAdmin && (
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">Description</label>
                    <input
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full px-5 py-3 rounded-2xl bg-[var(--bg-app)] border border-[var(--border-base)] text-[var(--text-main)] font-medium focus:ring-2 focus:ring-brand outline-none transition-all"
                        placeholder="Short description of this task..."
                    />
                </div>
            )}

            <div className="space-y-2">
                <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">Task Content</label>

                {isMultiline ? (
                    <div className="space-y-3 bg-[var(--bg-app)] border border-[var(--border-base)] rounded-2xl p-4">
                        {multiValues.map((val, idx) => (
                            <div key={idx} className="flex items-center gap-3">
                                <div className="flex-1">
                                    <input
                                        value={val}
                                        onChange={(e) => updateRow(idx, e.target.value)}
                                        className="w-full px-4 py-2.5 rounded-xl bg-surface-800 border border-[var(--border-base)] text-[var(--text-main)] text-sm focus:ring-2 focus:ring-brand outline-none transition-all"
                                        placeholder={`Row ${idx + 1}...`}
                                    />
                                </div>
                                <button
                                    onClick={() => removeRow(idx)}
                                    className="p-2.5 rounded-xl text-red-500/60 hover:text-red-500 hover:bg-red-500/10 transition-all flex-shrink-0"
                                    title="Remove Row"
                                >
                                    <Icon name="delete" size={18} />
                                </button>
                            </div>
                        ))}

                        <button
                            onClick={addRow}
                            className="mt-2 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-brand hover:bg-brand/10 transition-colors"
                        >
                            <Icon name="add" size={16} />
                            Add Row
                        </button>
                        <p className="text-[10px] text-[var(--text-muted)] italic opacity-60 mt-4">
                            Saved as {"{ \"values\": [\"...\"] }"}
                        </p>
                    </div>
                ) : (
                    <div>
                        <textarea
                            value={singleValue}
                            onChange={(e) => setSingleValue(e.target.value)}
                            rows={6}
                            className="w-full px-5 py-4 rounded-2xl bg-[var(--bg-app)] border border-[var(--border-base)] text-[var(--text-main)] font-medium focus:ring-2 focus:ring-brand outline-none transition-all resize-none font-sans leading-relaxed"
                            placeholder="Describe the task instructions here..."
                        />
                        <p className="text-[10px] text-[var(--text-muted)] italic opacity-60 ml-1 mt-2">
                            Saved as {"{ \"value\": \"...\" }"}
                        </p>
                    </div>
                )}
            </div>
        </ManagementModal>
    );
};
