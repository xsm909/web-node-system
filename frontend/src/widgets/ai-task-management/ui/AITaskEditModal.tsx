import React, { useState, useEffect, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../../features/auth/store';
import { apiClient } from '../../../shared/api/client';
import type { AITask } from '../../../entities/ai-task/model/types';
import { ComboBox } from '../../../shared/ui/combo-box/ComboBox';
import { DataTypeSelect } from '../../../shared/ui/data-type-select';
import { Icon } from '../../../shared/ui/icon';
import { ManagementModal } from '../../../shared/ui/management-modal';
import { AIAssistantButton } from '../../../features/ai-assistant/ui/AIAssistantButton';
import { AppInput } from '../../../shared/ui/app-input';
import { FormField } from '../../../shared/ui/form-field';

import type { SelectionGroup } from '../../../shared/ui/selection-list/SelectionList';

interface AITaskEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    task: AITask | null;
    onSave: () => void;
    defaultOwnerId?: string;
    categoryFilter: string | string[];
    dataTypes: any[];
}

export const AITaskEditModal: React.FC<AITaskEditModalProps> = ({
    isOpen, onClose, task, onSave, defaultOwnerId, categoryFilter, dataTypes
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

    // Determine current selected data type
    const selectedDataType = useMemo(() => {
        if (!dataTypeId) return null;
        return dataTypes.find(dt => String(dt.id) === dataTypeId) || null;
    }, [dataTypeId, dataTypes]);

    // Generate dynamic model data from ALL DataTypes in 'AI' category, grouped by provider
    const modelData = useMemo(() => {
        const data: Record<string, SelectionGroup> = {
            'any': { id: 'any', name: 'Any Model', icon: 'auto_awesome', selectable: true, items: [], children: {} }
        };

        // Find all data types in category 'AI'
        const aiTypes = dataTypes.filter(dt => dt.category === 'AI');

        aiTypes.forEach(dt => {
            const providerName = dt.config?.Caption || dt.config?.caption || dt.type;
            const models = Array.isArray(dt.config?.subselect) ? dt.config.subselect : [];

            if (models.length > 0) {
                // Create a group for the provider if it doesn't exist
                if (!data[providerName]) {
                    data[providerName] = {
                        id: dt.type, // using type as ID for the group
                        name: providerName,
                        icon: dt.config?.icon || 'smart_toy',
                        selectable: false,
                        items: [],
                        children: {}
                    };
                }

                // Add models as items within the provider group
                models.forEach((m: string) => {
                    data[providerName].items.push({
                        id: m,
                        name: m,
                        icon: 'bolt',
                        selectable: true
                    });
                });
            }
        });

        return data;
    }, [dataTypes]);

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
        if (id === 'any') return 'Any Model';
        // Look in top-level and items within groups
        for (const group of Object.values(modelData)) {
            if (group.id === id) return group.name;
            const item = group.items.find(i => i.id === id);
            if (item) return item.name;
        }
        return id;
    };

    const getModelIcon = (id: string) => {
        if (id === 'any') return 'auto_awesome';
        for (const group of Object.values(modelData)) {
            if (group.id === id) return group.icon;
            const item = group.items.find(i => i.id === id);
            if (item) return item.icon;
        }
        return 'bolt';
    };

    const addRow = () => {
        setMultiValues([...multiValues, '']);
    };

    const removeRow = (index: number) => {
        const newVals = [...multiValues];
        newVals.splice(index, 1);
        if (newVals.length === 0) newVals.push('');
        setMultiValues(newVals);
    };

    const isAnalyticsCategory = selectedDataType?.type === 'Analytics';
    const showAiAssistant = isAdmin && isAnalyticsCategory;

    const updateRow = (index: number, val: string) => {
        const newVals = [...multiValues];
        newVals[index] = val;
        setMultiValues(newVals);
    };

    const handleAiResult = (result: any) => {
        if (result && typeof result === 'object') {
            if (result.values && Array.isArray(result.values)) {
                setMultiValues(result.values.length > 0 ? result.values : ['']);
                setSingleValue('');
            } else if (result.value) {
                setSingleValue(result.value);
                setMultiValues(['']);
            }
        }
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

            <div className={isAdmin ? "grid grid-cols-1 md:grid-cols-2 gap-6" : "space-y-6"}>
                <FormField label="Category">
                    <DataTypeSelect
                        value={dataTypeId}
                        onChange={(val: string) => setDataTypeId(val)}
                        dataTypes={dataTypes}
                        categoryFilter={categoryFilter}
                        valueProp="id"
                        className="w-full"
                    />
                </FormField>
                {isAdmin && (
                    <FormField label="AI Model">
                        <ComboBox
                            value={model}
                            label={getModelLabel(model)}
                            icon={getModelIcon(model)}
                            placeholder="Select model..."
                            data={modelData}
                            onSelect={(item) => setModel(item.id)}
                            className="w-full"
                        />
                    </FormField>
                )}
            </div>

            {isAdmin && (
                <AppInput
                    label="Description"
                    value={description}
                    onChange={setDescription}
                    placeholder="Short description of this task..."
                />
            )}


            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">Task Content</label>
                    {showAiAssistant && (
                        <AIAssistantButton
                            hintType="task_analytics"
                            onResult={handleAiResult}
                            label="Task Assistant"
                            isEmpty={!singleValue && (multiValues.length === 1 && !multiValues[0])}
                            context={!singleValue && (multiValues.length === 1 && !multiValues[0]) ? null : {
                                existing_task: isMultiline ? { values: multiValues } : { value: singleValue }
                            }}
                            modelData={modelData}
                        />
                    )}
                </div>

                {isMultiline ? (
                    <div className="space-y-3 bg-[var(--bg-app)] border border-[var(--border-base)] rounded-2xl p-4">
                        {multiValues.map((val, idx) => (
                            <div key={idx} className="flex items-center gap-3">
                                <div className="flex-1">
                                    <input
                                        type="text"
                                        value={val}
                                        onChange={(e) => updateRow(idx, e.target.value)}
                                        placeholder={`Step ${idx + 1}`}
                                        className="flex-1 bg-transparent text-sm focus:outline-none placeholder:opacity-30"
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
                            className="mt-2 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest text-brand hover:bg-brand/10 transition-colors"
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
                        <AppInput
                            label=""
                            multiline
                            rows={6}
                            value={singleValue}
                            onChange={setSingleValue}
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
