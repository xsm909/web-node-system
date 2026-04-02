import { useState, useMemo, useEffect } from 'react';
import type { ApiRegistry, ApiFunction } from '../../../entities/api-registry/model/types';
import { AppFormView } from '../../../shared/ui/app-form-view';
import { AppInput } from '../../../shared/ui/app-input';
import { Icon } from '../../../shared/ui/icon';
import { AppRoundButton } from '../../../shared/ui/app-round-button/AppRoundButton';
import { ComboBox } from '../../../shared/ui/combo-box/ComboBox';
import { useCredentials } from '../../../entities/credential/api';
import { UI_CONSTANTS } from '../../../shared/ui/constants';
import { 
    DndContext, 
    closestCenter, 
    KeyboardSensor, 
    PointerSensor, 
    useSensor, 
    useSensors, 
    type DragEndEvent 
} from '@dnd-kit/core';
import { 
    arrayMove, 
    SortableContext, 
    sortableKeyboardCoordinates, 
    verticalListSortingStrategy, 
    useSortable 
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableApiFunctionItemProps {
    func: ApiFunction & { _dndId: string };
    index: number;
    isExpanded: boolean;
    onToggleExpand: (id: string) => void;
    onUpdate: (index: number, updates: Partial<ApiFunction>) => void;
    onRemove: (index: number) => void;
}

function SortableApiFunctionItem({ func, index, isExpanded, onToggleExpand, onUpdate, onRemove }: SortableApiFunctionItemProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: func._dndId });

    const style = {
        transform: CSS.Translate.toString(transform),
        transition,
        zIndex: isDragging ? 50 : 0,
        opacity: isDragging ? 0.6 : 1,
    };

    return (
        <div 
            ref={setNodeRef} 
            style={style}
            className={`flex flex-col gap-3 p-4 rounded-xl bg-surface-900/40 backdrop-blur-sm border border-[var(--border-base)] group animate-in fade-in slide-in-from-left-2 duration-200 ${isDragging ? 'shadow-2xl ring-2 ring-brand/50 bg-surface-800/80' : 'hover:border-brand/30'}`}
        >
            {/* Header with Drag Handle, Summary, and Collapse Toggle */}
            <div className="flex items-center gap-3">
                <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors">
                    <Icon name="drag_indicator" size={16} />
                </div>
                
                <div className="flex-1 flex items-center gap-4 cursor-pointer min-w-0" onClick={() => onToggleExpand(func._dndId)}>
                    <div className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase shrink-0 border tracking-wider ${
                        func.method === 'GET' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
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
                    <AppRoundButton
                        icon="delete"
                        onClick={(e) => { e.stopPropagation(); onRemove(index); }}
                        variant="danger"
                        size="small"
                        title="Remove Function"
                        className="opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    />
                    <AppRoundButton
                        icon={isExpanded ? 'expand_less' : 'expand_more'}
                        onClick={(e) => { e.stopPropagation(); onToggleExpand(func._dndId); }}
                        variant="ghost"
                        size="small"
                        title={isExpanded ? "Collapse" : "Expand"}
                        className={`transition-all duration-300 ${isExpanded ? 'bg-[var(--border-base)]' : ''}`}
                    />
                </div>
            </div>

            {/* Expanded Content */}
            {isExpanded && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="grid grid-cols-3 gap-3">
                        <AppInput
                            label="Name"
                            value={func.name}
                            onChange={(val) => onUpdate(index, { name: val })}
                            placeholder="get_weather"
                            className={UI_CONSTANTS.CODE_EDITOR_CLASS}
                        />
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Method</label>
                            <select
                                value={func.method}
                                onChange={(e) => onUpdate(index, { method: e.target.value as any })}
                                className={`bg-surface-800 border border-[var(--border-base)] rounded-lg px-2 text-xs focus:border-brand/50 outline-none h-8`}
                            >
                                <option value="GET">GET</option>
                                <option value="POST">POST</option>
                                <option value="PUT">PUT</option>
                                <option value="DELETE">DELETE</option>
                            </select>
                        </div>
                        <AppInput
                            label="Path"
                            value={func.path}
                            onChange={(val) => onUpdate(index, { path: val })}
                            placeholder="/v1/weather"
                            className={UI_CONSTANTS.CODE_EDITOR_CLASS}
                        />
                    </div>
                    
                    <AppInput
                        label="Description (for AI tools)"
                        value={func.description || ''}
                        onChange={(val) => onUpdate(index, { description: val })}
                        placeholder="Fetches current weather for a city"
                        className="text-xs mb-1"
                    />
                    
                    <div className="mt-1 pt-3 border-t border-[var(--border-base)]/30">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <Icon name="parameters" size={12} className="text-[var(--text-muted)]" />
                                <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Default Parameters</label>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    const current = func.default_params || [];
                                    onUpdate(index, { default_params: [...current, { key: '', value: '' }] });
                                }}
                                className="h-6 px-2 rounded-lg bg-brand/10 text-[10px] font-bold text-brand hover:bg-brand/20 transition-all flex items-center gap-1 border border-brand/20"
                            >
                                <Icon name="add" size={12} />
                                <span>Add Parameter</span>
                            </button>
                        </div>
                        
                        <div className="space-y-2">
                            {(func.default_params || []).map((param, pIdx: number) => (
                                <div key={pIdx} className="flex gap-2 items-start animate-in fade-in slide-in-from-top-1 duration-200">
                                    <div className="flex-1">
                                        <AppInput
                                            value={param.key || ''}
                                            onChange={(val) => {
                                                const newParams = [...(func.default_params || [])];
                                                newParams[pIdx] = { ...newParams[pIdx], key: val };
                                                onUpdate(index, { default_params: newParams });
                                            }}
                                            placeholder="Param name (e.g. format)"
                                            className={UI_CONSTANTS.CODE_EDITOR_CLASS}
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <AppInput
                                            value={param.value || ''}
                                            onChange={(val) => {
                                                const newParams = [...(func.default_params || [])];
                                                newParams[pIdx] = { ...newParams[pIdx], value: val };
                                                onUpdate(index, { default_params: newParams });
                                            }}
                                            placeholder="Value (e.g. json)"
                                            className={UI_CONSTANTS.CODE_EDITOR_CLASS}
                                        />
                                    </div>
                                    <AppRoundButton
                                        icon="close"
                                        onClick={() => {
                                            const newParams = (func.default_params as any[]).filter((_, i) => i !== pIdx);
                                            onUpdate(index, { default_params: newParams });
                                        }}
                                        variant="danger"
                                        size="xs"
                                        title="Remove Parameter"
                                        className="mt-1"
                                    />
                                </div>
                            ))}
                            {(!func.default_params || func.default_params.length === 0) && (
                                <p className="text-[10px] text-[var(--text-muted)] italic opacity-40 py-1 px-1">No default parameters defined for this function.</p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

interface ApiRegistryEditorProps {
    api: ApiRegistry | null;
    isSaving: boolean;
    onSave: (data: Partial<ApiRegistry>) => void;
    onCancel: () => void;
}

export function ApiRegistryEditor({ api, isSaving, onSave, onCancel }: ApiRegistryEditorProps) {

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

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    useEffect(() => {
        if (api) {
            setFormData(api);
            setFunctionsList((api.functions || []).map(f => ({ ...f, _dndId: crypto.randomUUID() })));
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
            functions: functionsList.filter(f => f.name.trim() !== '' && f.path.trim() !== '')
        });
    };

    const handleAddFunction = () => {
        const newId = crypto.randomUUID();
        setFunctionsList([...functionsList, { 
            name: '', 
            method: 'GET', 
            path: '', 
            description: '', 
            default_params: [], 
            _dndId: newId 
        }]);
        toggleExpand(newId);
    };

    const handleUpdateFunction = (index: number, updates: Partial<ApiFunction>) => {
        const newList = [...functionsList];
        newList[index] = { ...newList[index], ...updates };
        setFunctionsList(newList);
    };

    const handleRemoveFunction = (index: number) => {
        setFunctionsList(functionsList.filter((_, i) => i !== index));
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
    };

    const toggleExpand = (id: string) => {
        setExpandedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
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
            entityId={api?.id}
            entityType="api_registry"
        >
            <div className="max-w-5xl mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-500 px-2 pt-1 pb-2">
                <header className="mb-4">
                    <p className="text-sm text-[var(--text-muted)] mt-1 opacity-60">Register a third-party API service to use its functions in workflows and AI agents.</p>
                </header>
                <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-6">
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
                            placeholder="http://localhost:8018"
                            className={UI_CONSTANTS.CODE_EDITOR_CLASS}
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
                                            onClick={() => setExpandedIds(new Set())}
                                            variant="ghost"
                                            size="small"
                                            title="Collapse All"
                                            className="mr-0.5"
                                        />
                                        <AppRoundButton
                                            icon="expand_all"
                                            onClick={() => setExpandedIds(new Set(functionsList.map(f => f._dndId)))}
                                            variant="ghost"
                                            size="small"
                                            title="Expand All"
                                            className="mr-1.5"
                                        />
                                    </>
                                )}
                                <AppRoundButton
                                    icon="add"
                                    onClick={handleAddFunction}
                                    variant="brand"
                                    size="small"
                                    title="Add Function"
                                />
                            </div>
                        </div>

                        <div className="space-y-3 bg-surface-900/20 backdrop-blur-[2px] p-4 rounded-2xl border border-[var(--border-base)] min-h-[100px]">
                            {functionsList.length === 0 ? (
                                <div className="h-16 flex items-center justify-center text-[var(--text-muted)] italic text-xs opacity-50">
                                    No functions mapped. Click + to add your first function.
                                </div>
                            ) : (
                                <DndContext 
                                    sensors={sensors} 
                                    collisionDetection={closestCenter} 
                                    onDragEnd={handleDragEnd}
                                >
                                    <SortableContext 
                                        items={functionsList.map(f => f._dndId)} 
                                        strategy={verticalListSortingStrategy}
                                    >
                                        <div className="space-y-3">
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
                                </DndContext>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </AppFormView>
    );
}
