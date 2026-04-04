import { useState, useMemo, useEffect } from 'react';
import type { ApiRegistry, ApiFunction } from '../../../entities/api-registry/model/types';
import { useQueryClient } from '@tanstack/react-query';
import { AppFormView } from '../../../shared/ui/app-form-view';
import { AppInput } from '../../../shared/ui/app-input';
import { Icon } from '../../../shared/ui/icon';
import { AppRoundButton } from '../../../shared/ui/app-round-button/AppRoundButton';
import { AppCompactModalForm } from '../../../shared/ui/app-compact-modal-form/AppCompactModalForm';
import { ComboBox } from '../../../shared/ui/combo-box/ComboBox';
import { useCredentials } from '../../../entities/credential/api';
import { UI_CONSTANTS } from '../../../shared/ui/constants';
import {
    DndContext,
    closestCorners,
    PointerSensor,
    KeyboardSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
    type DragStartEvent,
    DragOverlay
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';

interface SortableApiFunctionItemProps {
    func: ApiFunction & { _dndId: string };
    index: number;
    isExpanded: boolean;
    onToggleExpand: (id: string) => void;
    onUpdate: (index: number, updates: Partial<ApiFunction>) => void;
    onRemove: (index: number) => void;
}

interface ApiFunctionItemProps {
    func: ApiFunction & { _dndId: string };
    index: number;
    isExpanded: boolean;
    onToggleExpand?: (id: string) => void;
    onUpdate?: (index: number, updates: Partial<ApiFunction>) => void;
    onRemove?: (index: number) => void;
    isOverlay?: boolean;
    isGhost?: boolean;
    sortableProps?: {
        attributes: any;
        listeners: any;
    };
}

function ApiFunctionItem({
    func,
    index,
    isExpanded,
    onToggleExpand,
    onUpdate,
    onRemove,
    isOverlay,
    isGhost,
    sortableProps
}: ApiFunctionItemProps) {
    return (
        <div
            {...(sortableProps?.attributes || {})}
            {...(sortableProps?.listeners || {})}
            className={`flex flex-col gap-3 group animate-in fade-in slide-in-from-left-2 duration-200 
                ${isOverlay
                    ? 'p-4 rounded-xl bg-white/70 border border-brand/30 shadow-2xl ring-1 ring-brand/10 backdrop-blur-[2px] opacity-100 scale-[1.01] z-[100] pointer-events-none cursor-grabbing border-white/40'
                    : isGhost
                        ? 'opacity-0 pointer-events-none'
                        : 'py-5 border-b border-[var(--border-base)]/40 last:border-b-0 cursor-grab active:cursor-grabbing hover:bg-[var(--text-main)]/[0.01]'
                }`}
        >
            {/* Header with Summary and Collapse Toggle */}
            <div className="flex items-center gap-3 pr-2">
                <div className="flex-1 flex items-center gap-4 cursor-pointer min-w-0 py-1" onClick={(e) => {
                    if (!isOverlay) {
                        e.stopPropagation();
                        onToggleExpand?.(func._dndId);
                    }
                }}>
                    <div className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase shrink-0 border tracking-wider ${func.method === 'GET' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                        func.method === 'POST' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                            func.method === 'PUT' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        }`}>
                        {func.method}
                    </div>
                    <span className="font-mono text-xs font-bold text-[var(--text-main)] truncate max-w-[200px]">
                        {func.name || <span className="opacity-40 italic font-normal">unnamed_function</span>}
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)] opacity-60 truncate flex-1 font-mono">
                        {func.path || <span className="italic">no path</span>}
                    </span>
                </div>

                <div className="flex items-center gap-1">
                    {!isOverlay && (
                        <>
                            <AppRoundButton
                                icon="delete"
                                onClick={(e) => { e.stopPropagation(); onRemove?.(index); }}
                                variant="danger"
                                size="small"
                                title="Remove Function"
                                className="opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                            />
                            <AppRoundButton
                                icon={isExpanded ? 'expand_less' : 'expand_more'}
                                onClick={(e) => { e.stopPropagation(); onToggleExpand?.(func._dndId); }}
                                variant="ghost"
                                size="small"
                                title={isExpanded ? "Collapse" : "Expand"}
                                className={`transition-all duration-300 ${isExpanded ? 'bg-[var(--border-base)]' : ''}`}
                            />
                        </>
                    )}
                </div>
            </div>

            {/* Expanded Content */}
            {isExpanded && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300 pointer-events-auto">
                    <div className="grid grid-cols-3 gap-3">
                        <div onPointerDown={(e) => e.stopPropagation()}>
                            <AppInput
                                label="Name"
                                value={func.name}
                                onChange={(val) => onUpdate?.(index, { name: val })}
                                placeholder="get_weather"
                                className={UI_CONSTANTS.CODE_EDITOR_CLASS}
                            />
                        </div>
                        <div className="flex flex-col gap-1.5" onPointerDown={(e) => e.stopPropagation()}>
                            <label className="text-xs font-bold text-[var(--text-main)]">Method</label>
                            <div className="relative group/select">
                                <select
                                    value={func.method}
                                    onChange={(e) => onUpdate?.(index, { method: e.target.value as any })}
                                    className={`${UI_CONSTANTS.FORM_CONTROL_HEIGHT} bg-surface-800 border border-[var(--border-base)] rounded-lg px-2 pr-8 text-[12px] font-mono text-[var(--text-main)] focus:border-brand/50 outline-none w-full appearance-none cursor-pointer hover:bg-surface-700/50 transition-colors`}
                                >
                                    <option value="GET">GET</option>
                                    <option value="POST">POST</option>
                                    <option value="PUT">PUT</option>
                                    <option value="DELETE">DELETE</option>
                                </select>
                                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-muted)] group-hover/select:text-[var(--text-main)] transition-colors">
                                    <Icon name="expand_more" size={16} />
                                </div>
                            </div>
                        </div>
                        <div onPointerDown={(e) => e.stopPropagation()}>
                            <AppInput
                                label="Path"
                                value={func.path}
                                onChange={(val) => onUpdate?.(index, { path: val })}
                                placeholder="/v1/weather"
                                className={UI_CONSTANTS.CODE_EDITOR_CLASS}
                            />
                        </div>
                    </div>

                    <div onPointerDown={(e) => e.stopPropagation()}>
                        <AppInput
                            label="Description (for AI tools)"
                            value={func.description || ''}
                            onChange={(val) => onUpdate?.(index, { description: val })}
                            placeholder="Fetches latest news articles by topic or keyword."
                            className="text-xs"
                        />
                    </div>

                    <div onPointerDown={(e) => e.stopPropagation()}>
                        <AppInput
                            label="Parameters Schema (JSON)"
                            value={typeof func.parameters === 'string' ? func.parameters : JSON.stringify(func.parameters || {}, null, 2)}
                            onChange={(val) => {
                                try {
                                    const parsed = JSON.parse(val);
                                    onUpdate?.(index, { parameters: parsed });
                                } catch (e) {
                                    // If invalid JSON, still update as string for dirty tracking/editing
                                    onUpdate?.(index, { parameters: val } as any);
                                }
                            }}
                            multiline
                            rows={6}
                            placeholder='{ "type": "object", "properties": { "query": { "type": "string" } } }'
                            className={UI_CONSTANTS.CODE_EDITOR_CLASS}
                        />
                        <p className="text-[10px] text-[var(--text-muted)] italic opacity-60 mt-1">
                            Standard JSON Schema for the tool's input parameters. Used by AI agents to understand the API.
                        </p>
                    </div>

                    <div className="mt-1 pt-3 border-t border-[var(--border-base)]/30">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <Icon name="parameters" size={12} className="text-[var(--text-muted)]" />
                                <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Default Parameters</label>
                            </div>
                            <div onPointerDown={(e) => e.stopPropagation()}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const current = func.default_params || [];
                                        onUpdate?.(index, { default_params: [...current, { key: '', value: '' }] });
                                    }}
                                    className="h-6 px-2 rounded-lg bg-brand/10 text-[10px] font-bold text-brand hover:bg-brand/20 transition-all flex items-center gap-1 border border-brand/20"
                                >
                                    <Icon name="add" size={12} />
                                    <span>Add Parameter</span>
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
                            {(func.default_params || []).map((param, pIdx: number) => (
                                <div key={pIdx} className="flex gap-2 items-start animate-in fade-in slide-in-from-top-1 duration-200 bg-surface-900/10 p-1.5 rounded-lg border border-[var(--border-base)]/20" onPointerDown={(e) => e.stopPropagation()}>
                                    <div className="flex-1 flex flex-col gap-1">
                                        <AppInput
                                            value={param.key || ''}
                                            onChange={(val) => {
                                                const newParams = [...(func.default_params || [])];
                                                newParams[pIdx] = { ...newParams[pIdx], key: val };
                                                onUpdate?.(index, { default_params: newParams });
                                            }}
                                            placeholder="Key"
                                            className={UI_CONSTANTS.CODE_EDITOR_CLASS}
                                        />
                                    </div>
                                    <div className="flex-1 flex flex-col gap-1">
                                        <AppInput
                                            value={param.value || ''}
                                            onChange={(val) => {
                                                const newParams = [...(func.default_params || [])];
                                                newParams[pIdx] = { ...newParams[pIdx], value: val };
                                                onUpdate?.(index, { default_params: newParams });
                                            }}
                                            placeholder="Value"
                                            className={UI_CONSTANTS.CODE_EDITOR_CLASS}
                                        />
                                    </div>
                                    <AppRoundButton
                                        icon="close"
                                        onClick={() => {
                                            const newParams = (func.default_params as any[]).filter((_, i) => i !== pIdx);
                                            onUpdate?.(index, { default_params: newParams });
                                        }}
                                        variant="ghost"
                                        size="xs"
                                        title="Remove Parameter"
                                        className="mt-1"
                                    />
                                </div>
                            ))}
                        </div>
                        {(!func.default_params || func.default_params.length === 0) && (
                            <p className="text-[10px] text-[var(--text-muted)] italic opacity-40 py-1 px-1">No default parameters defined for this function.</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

function SortableApiFunctionItem(props: SortableApiFunctionItemProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: props.func._dndId });

    const style = {
        transform: isDragging ? undefined : CSS.Translate.toString(transform),
        transition,
        zIndex: isDragging ? 50 : 0,
    };

    return (
        <div ref={setNodeRef} style={style}>
            <ApiFunctionItem
                {...props}
                isGhost={isDragging}
                sortableProps={{ attributes, listeners }}
            />
        </div>
    );
}

interface ApiRegistryEditorProps {
    api: ApiRegistry | null;
    isSaving: boolean;
    onSave: (data: Partial<ApiRegistry>) => void;
    onCancel: () => void;
    isHotkeysEnabled?: boolean;
}

export function ApiRegistryEditor({ api, isSaving, onSave, onCancel, isHotkeysEnabled }: ApiRegistryEditorProps) {

    const [formData, setFormData] = useState<Partial<ApiRegistry>>(api || {
        name: '',
        base_url: '',
        credential_key: '',
        description: '',
        functions: []
    });

    const { data: credentials = [] } = useCredentials();

    const [functionsList, setFunctionsList] = useState<(ApiFunction & { _dndId: string })[]>(() => {
        return (api?.functions || []).map(f => ({ ...f, _dndId: crypto.randomUUID() }));
    });

    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    const [activeId, setActiveId] = useState<string | null>(null);
    const [isAiHintModalOpen, setIsAiHintModalOpen] = useState(false);
    const [isFillDataModalOpen, setIsFillDataModalOpen] = useState(false);
    const [aiJsonInput, setAiJsonInput] = useState('');
    const [importError, setImportError] = useState<string | null>(null);
    const queryClient = useQueryClient();
    
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 10 },
        }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    useEffect(() => {
        if (api) {
            setFormData(api);
            setFunctionsList(prev => {
                const currentFunctions = api.functions || [];
                const matchedIds = new Set<string>();
                
                return currentFunctions.map(f => {
                    // Find an existing function with same name/path that hasn't been matched yet
                    const existing = prev.find(p => 
                        p.name === f.name && 
                        p.path === f.path && 
                        !matchedIds.has(p._dndId)
                    );
                    
                    const id = existing ? existing._dndId : crypto.randomUUID();
                    matchedIds.add(id);
                    
                    return { 
                        ...f, 
                        _dndId: id 
                    };
                });
            });
        }
    }, [api]);

    const isDirty = useMemo(() => {
        const initialFunctions = api?.functions || [];

        // Helper to normalize function objects for comparison
        const normalize = (f: any) => ({
            name: f.name || '',
            method: f.method || 'GET',
            path: f.path || '',
            description: f.description || '',
            parameters: f.parameters || {},
            default_params: (f.default_params || []).map((p: any) => ({
                key: p.key || '',
                value: p.value || ''
            }))
        });

        const basicFieldsChanged =
            (formData.name || '') !== (api?.name || '') ||
            (formData.base_url || '') !== (api?.base_url || '') ||
            (formData.credential_key || '') !== (api?.credential_key || '') ||
            (formData.description || '') !== (api?.description || '');

        const currentNormalized = functionsList.map(normalize);
        const initialNormalized = initialFunctions.map(normalize);

        const functionsChanged = JSON.stringify(currentNormalized) !== JSON.stringify(initialNormalized);

        return api
            ? (basicFieldsChanged || functionsChanged)
            : (formData.name !== '' || formData.base_url !== '' || formData.credential_key !== '' || functionsList.length > 0);
    }, [formData, functionsList, api]);

    const handleSave = () => {
        onSave({
            ...formData,
            functions: functionsList
                .filter(f => f.name.trim() !== '' && f.path.trim() !== '')
                .map(({ _dndId, ...f }) => f)
        });
    };

    const handleAddFunction = () => {
        const newId = crypto.randomUUID();
        setFunctionsList([...functionsList, {
            name: '',
            method: 'GET',
            path: '',
            description: '',
            parameters: {},
            default_params: [],
            _dndId: newId
        }]);
        toggleExpand(newId);
    };

    const handleFillFunctions = () => {
        try {
            setImportError(null);
            if (!aiJsonInput.trim()) {
                setImportError('Please paste some JSON data.');
                return;
            }

            const data = JSON.parse(aiJsonInput);
            if (!Array.isArray(data)) {
                setImportError('Data must be a JSON array of function objects.');
                return;
            }

            const newFunctions: (ApiFunction & { _dndId: string })[] = [];
            const errors: string[] = [];

            data.forEach((item, idx) => {
                const name = item.name || item.function_name;
                const path = item.path || item.endpoint || item.url;
                const method = (item.method || 'GET').toUpperCase();

                if (!name) errors.push(`Item #${idx + 1} is missing "name"`);
                if (!path) errors.push(`Item #${idx + 1} is missing "path"`);
                
                if (name && path) {
                    newFunctions.push({
                        name,
                        method: method as any,
                        path,
                        description: item.description || '',
                        parameters: item.parameters || item.params || {},
                        default_params: item.default_params || [],
                        _dndId: crypto.randomUUID()
                    });
                }
            });

            if (errors.length > 0) {
                setImportError(`Validation errors:\n${errors.join('\n')}`);
                return;
            }

            // Append new functions
            setFunctionsList([...functionsList, ...newFunctions]);
            setIsFillDataModalOpen(false);
            setAiJsonInput('');
        } catch (e: any) {
            setImportError(`Invalid JSON format: ${e.message}`);
        }
    };

    const handleUpdateFunction = (index: number, updates: Partial<ApiFunction>) => {
        const newList = [...functionsList];
        newList[index] = { ...newList[index], ...updates };
        setFunctionsList(newList);
    };

    const handleRemoveFunction = (index: number) => {
        setFunctionsList(functionsList.filter((_, i) => i !== index));
    };

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            setFunctionsList((items) => {
                const oldIndex = items.findIndex((item) => item._dndId === active.id);
                const newIndex = items.findIndex((item) => item._dndId === over.id);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
        setActiveId(null);
    };

    const handleDragCancel = () => {
        setActiveId(null);
    };

    const toggleExpand = (id: string) => {
        setExpandedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleBulkExpand = (isExpand: boolean) => {
        if (isExpand) {
            setExpandedIds(new Set(functionsList.map(f => f._dndId)));
        } else {
            setExpandedIds(new Set());
        }
    };

    return (
        <AppFormView
            title={api ? (api.name || 'Editing') : 'Add New External API'}
            parentTitle="API Registry"
            icon="api"
            isDirty={isDirty}
            isSaving={isSaving}
            onSave={handleSave}
            onCancel={onCancel}
            saveLabel={api ? "Save API" : "Add API"}
            onLockToggle={(locked) => {
                setFormData(prev => ({ ...prev, is_locked: locked }));
                queryClient.invalidateQueries({ queryKey: ['credentials'] });
            }}
            isHotkeysEnabled={isHotkeysEnabled}
        >
            <div className="max-w-5xl mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-500 px-2 pt-1 pb-2">
                <header className="mb-4">
                    <p className="text-sm text-[var(--text-muted)] mt-1 opacity-60">Register a third-party API service to use its functions in workflows and AI agents.</p>
                </header>
                <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-6 bg-surface-900/10 p-5 rounded-2xl border border-[var(--border-base)]/30 backdrop-blur-[2px]">
                        <AppInput
                            label="API Name"
                            required
                            value={formData.name || ''}
                            onChange={(val) => setFormData({ ...formData, name: val })}
                            placeholder="e.g. weather_service"
                            className={UI_CONSTANTS.CODE_EDITOR_CLASS}
                        />

                        <AppInput
                            label="Base URL"
                            required
                            value={formData.base_url || ''}
                            onChange={(val) => setFormData({ ...formData, base_url: val })}
                            placeholder="https://api.example.com"
                            className={UI_CONSTANTS.CODE_EDITOR_CLASS}
                            actions={[{
                                icon: 'question_here',
                                title: 'AI Prompt Helper',
                                onClick: () => setIsAiHintModalOpen(true)
                            }]}
                        />
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-bold text-[var(--text-main)]">API Credential (Token & Auth Type)</label>
                        <ComboBox
                            value={formData.credential_key || ''}
                            label={formData.credential_key || 'Select Credential'}
                            subLabel={credentials.find(c => c.key === formData.credential_key)?.description || (formData.credential_key ? 'Assigned' : 'Link a secure token')}
                            icon="verified"
                            items={credentials.map(c => ({
                                id: c.key,
                                name: c.key,
                                description: `${c.auth_type?.toUpperCase() || 'HEADER'} • ${c.description || ''}`,
                                icon: 'verified'
                            }))}
                            onSelect={(item) => setFormData({ ...formData, credential_key: item.id })}
                            searchPlaceholder="Search credentials..."
                            className="w-full"
                        />
                        <p className="text-[10px] text-[var(--text-muted)] italic opacity-60">The authentication method (Header vs Query) is defined in the credential settings.</p>
                    </div>

                    <AppInput
                        label="Description"
                        value={formData.description || ''}
                        onChange={(val) => setFormData({ ...formData, description: val })}
                        placeholder="Purpose of this API integration"
                    />

                    <div className="mt-8">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-sm font-bold text-[var(--text-main)]">Function Mapping</h3>
                                <p className="text-[10px] text-[var(--text-muted)] font-black uppercase tracking-widest opacity-60 mt-0.5">
                                    Expose endpoints as callable functions
                                </p>
                            </div>
                            <div className="flex items-center gap-1">
                                {functionsList.length > 0 && (
                                    <>
                                        <AppRoundButton
                                            icon="collapse_all"
                                            onClick={() => handleBulkExpand(false)}
                                            variant="ghost"
                                            size="small"
                                            title="Collapse All"
                                            className="mr-0.5"
                                        />
                                        <AppRoundButton
                                            icon="expand_all"
                                            onClick={() => handleBulkExpand(true)}
                                            variant="ghost"
                                            size="small"
                                            title="Expand All"
                                            className="mr-1.5"
                                        />
                                    </>
                                )}
                                <div className="flex items-center gap-1.5 ml-1">
                                    <AppRoundButton
                                        icon="filldown"
                                        onClick={() => {
                                            setImportError(null);
                                            setIsFillDataModalOpen(true);
                                        }}
                                        variant="outline"
                                        size="small"
                                        title="Import from AI (JSON)"
                                    />
                                    <AppRoundButton
                                        icon="add"
                                        onClick={handleAddFunction}
                                        variant="brand"
                                        size="small"
                                        title="Add Function manualmente"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className={`space-y-0 min-h-[100px] ${activeId ? 'select-none' : ''}`}>
                            {functionsList.length === 0 ? (
                                <div className="h-24 flex flex-col items-center justify-center text-[var(--text-muted)] bg-surface-900/5 rounded-2xl border border-dashed border-[var(--border-base)] animate-in fade-in duration-500">
                                    <Icon name="api" size={24} className="opacity-20 mb-2" />
                                    <p className="italic text-xs opacity-50">No functions mapped.</p>
                                    <p className="text-[10px] opacity-30 mt-1 uppercase tracking-tight">Click + to add your first function</p>
                                </div>
                            ) : (
                                <DndContext
                                    sensors={sensors}
                                    collisionDetection={closestCorners}
                                    onDragStart={handleDragStart}
                                    onDragEnd={handleDragEnd}
                                    onDragCancel={handleDragCancel}
                                    modifiers={[restrictToVerticalAxis]}
                                >
                                    <SortableContext
                                        items={functionsList.map(f => f._dndId)}
                                        strategy={verticalListSortingStrategy}
                                    >
                                        <div className="space-y-0">
                                            {functionsList.map((func, index) => (
                                                <SortableApiFunctionItem
                                                    key={func._dndId}
                                                    func={func}
                                                    index={index}
                                                    isExpanded={expandedIds.has(func._dndId)}
                                                    onToggleExpand={toggleExpand}
                                                    onUpdate={handleUpdateFunction}
                                                    onRemove={handleRemoveFunction}
                                                />
                                            ))}
                                        </div>
                                    </SortableContext>
                                    <DragOverlay modifiers={[restrictToVerticalAxis]}>
                                        {activeId ? (
                                            <ApiFunctionItem
                                                func={functionsList.find(f => f._dndId === activeId)!}
                                                index={functionsList.findIndex(f => f._dndId === activeId)}
                                                isExpanded={expandedIds.has(activeId)}
                                                isOverlay
                                            />
                                        ) : null}
                                    </DragOverlay>
                                </DndContext>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* AI Prompt Modal */}
            <AppCompactModalForm
                isOpen={isAiHintModalOpen}
                onClose={() => setIsAiHintModalOpen(false)}
                title="AI Integration Hint"
                icon="question_here"
                submitLabel="I understand"
                showCancel={false}
                onSubmit={() => setIsAiHintModalOpen(false)}
                width="max-w-2xl"
            >
                <div className="space-y-4 py-2">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-brand opacity-80">AI System Hint</label>
                        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                            Copy this prompt and send it to your AI assistant. It explicitly instructs the AI to generate a <span className="text-brand font-bold">JSON Array</span> of endpoints for <span className="text-[var(--text-main)] font-mono font-bold tracking-tight">{formData.base_url || 'this documentation'}</span>.
                        </p>
                    </div>

                    <div className="p-4 rounded-xl bg-surface-900/20 border border-[var(--border-base)]/50 relative group">
                        <pre className="text-[11px] font-mono text-[var(--text-main)] leading-relaxed whitespace-pre-wrap break-words">
{`Act as an API Integration Expert.
I am building a workflow system and I need to register the endpoints for the API located at: ${formData.base_url || 'provided URL'}.

Please provide a JSON object which is a SINGLE ARRAY of function definitions.
Each object in the array MUST follow this format:
{
  "name": "get_markets",  // Must be snake_case, e.g. get_{entity_name}
  "method": "GET",        // GET, POST, PUT, or DELETE
  "path": "/v1/markets",  // The relative path is MANDATORY
  "description": "Clear description of what this endpoint provides",
  "parameters": {         // Use standard JSON Schema for input parameters
    "type": "object",
    "properties": {
      "limit": { "type": "number", "description": "max results" }
    }
  }
}

Important Rules:
1. The response MUST be a VALID JSON ARRAY ( [ ... ] ).
2. Do not include any explanations, only the JSON array.
3. Every function MUST have a "path".`}
                        </pre>
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <AppRoundButton
                                icon="content_copy"
                                size="small"
                                variant="ghost"
                                title="Copy Prompt"
                                onClick={() => {
                                    const prompt = `Act as an API Integration Expert.\nI am building a workflow system and I need to register the endpoints for the API located at: ${formData.base_url || 'provided URL'}.\n\nPlease provide a JSON object which is a SINGLE ARRAY of function definitions.\nEach object in the array MUST follow this format:\n{\n  "name": "get_markets",  // Must be snake_case, e.g. get_{entity_name}\n  "method": "GET",\n  "path": "/v1/markets",  // The relative path is MANDATORY\n  "description": "Clear description of what this endpoint provides",\n  "parameters": {\n    "type": "object",\n    "properties": {\n      "limit": { "type": "number", "description": "max results" }\n    }\n  }\n}\n\nImportant Rules:\n1. The response MUST be a VALID JSON ARRAY ( [ ... ] ).\n2. Do not include any explanations, only the JSON array.\n3. Every function MUST have a "path".`;
                                    navigator.clipboard.writeText(prompt);
                                }}
                            />
                        </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 rounded-xl bg-brand/5 border border-brand/10 translate-y-1">
                        <Icon name="lightbulb_circle" size={16} className="text-brand shrink-0 mt-0.5" />
                        <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                            Once the AI gives you the JSON, click the <Icon name="filldown" size={10} className="inline-block" /> button next to "Function Mapping" to paste and import it.
                        </p>
                    </div>
                </div>
            </AppCompactModalForm>

            {/* Data Import Modal */}
            <AppCompactModalForm
                isOpen={isFillDataModalOpen}
                onClose={() => setIsFillDataModalOpen(false)}
                title="Import Functions from AI"
                icon="filldown"
                submitLabel="Fill Functions"
                onSubmit={handleFillFunctions}
                error={importError || undefined}
                width="max-w-3xl"
            >
                <div className="space-y-4 py-2">
                    <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                            <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Paste AI Response</label>
                            <span className="text-[10px] font-black uppercase tracking-widest text-brand">Required Format: JSON Array [ ]</span>
                        </div>
                        <AppInput
                            value={aiJsonInput}
                            onChange={setAiJsonInput}
                            multiline
                            rows={15}
                            placeholder='[ { "name": "get_markets", "method": "GET", "path": "/markets", ... } ]'
                            className={UI_CONSTANTS.CODE_EDITOR_CLASS}
                            autoFocus
                        />
                    </div>
                    
                    <div className="p-3 rounded-xl bg-surface-900/10 border border-[var(--border-base)]/30 flex items-start gap-3">
                        <Icon name="info" size={14} className="text-[var(--text-muted)] mt-0.5 shrink-0" />
                        <div className="flex flex-col gap-0.5">
                           <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-tight">Import Logic</span>
                           <p className="text-[10px] text-[var(--text-muted)] opacity-60 leading-relaxed">
                               This tool will parse your JSON and append any valid function definitions found to the current list. 
                               We also try to normalize fields like "endpoint" to "path" automatically.
                           </p>
                        </div>
                    </div>
                </div>
            </AppCompactModalForm>
        </AppFormView>
    );
}
