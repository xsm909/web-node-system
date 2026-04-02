import { useState, useMemo, useEffect } from 'react';
import type { ApiRegistry, ApiFunction } from '../../../entities/api-registry/model/types';
import { AppFormView } from '../../../shared/ui/app-form-view';
import { AppInput } from '../../../shared/ui/app-input';
import { Icon } from '../../../shared/ui/icon';
import { AppRoundButton } from '../../../shared/ui/app-round-button/AppRoundButton';
import { ComboBox } from '../../../shared/ui/combo-box/ComboBox';
import { useCredentials } from '../../../entities/credential/api';
import { UI_CONSTANTS } from '../../../shared/ui/constants';

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

    const [functionsList, setFunctionsList] = useState<ApiFunction[]>(() => {
        return api?.functions || [];
    });

    useEffect(() => {
        if (api) {
            setFormData(api);
            setFunctionsList(api.functions || []);
        }
    }, [api]);

    const isDirty = useMemo(() => {
        const initialFunctions = api?.functions || [];
        
        return api 
            ? (formData.name !== api.name || 
               formData.base_url !== api.base_url || 
               formData.credential_key !== api.credential_key || 
               formData.description !== api.description ||
               JSON.stringify(functionsList) !== JSON.stringify(initialFunctions))
            : (formData.name !== '' || formData.base_url !== '' || formData.credential_key !== '' || functionsList.length > 0);
    }, [formData, functionsList, api]);

    const handleSave = () => {
        onSave({ 
            ...formData, 
            functions: functionsList.filter(f => f.name.trim() !== '' && f.path.trim() !== '')
        });
    };

    const handleAddFunction = () => {
        setFunctionsList([...functionsList, { name: '', method: 'GET', path: '', description: '' }]);
    };

    const handleUpdateFunction = (index: number, updates: Partial<ApiFunction>) => {
        const newList = [...functionsList];
        newList[index] = { ...newList[index], ...updates };
        setFunctionsList(newList);
    };

    const handleRemoveFunction = (index: number) => {
        setFunctionsList(functionsList.filter((_, i) => i !== index));
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
                            <AppRoundButton
                                icon="add"
                                onClick={handleAddFunction}
                                variant="brand"
                                size="small"
                                title="Add Function"
                            />
                        </div>

                        <div className="space-y-3 bg-surface-800/30 p-4 rounded-2xl border border-[var(--border-base)] min-h-[100px]">
                            {functionsList.length === 0 ? (
                                <div className="h-16 flex items-center justify-center text-[var(--text-muted)] italic text-xs opacity-50">
                                    No functions mapped. Click + to add your first function.
                                </div>
                            ) : (
                                functionsList.map((func, index) => (
                                    <div key={index} className="flex flex-col gap-3 p-4 rounded-xl bg-surface-900/50 border border-[var(--border-base)] group animate-in fade-in slide-in-from-left-2 duration-200">
                                        <div className="flex items-center gap-3">
                                            <div className="flex-1 grid grid-cols-3 gap-3">
                                                <AppInput
                                                    label="Name"
                                                    value={func.name}
                                                    onChange={(val) => handleUpdateFunction(index, { name: val })}
                                                    placeholder="get_weather"
                                                    className={UI_CONSTANTS.CODE_EDITOR_CLASS}
                                                />
                                                <div className="flex flex-col gap-1">
                                                    <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Method</label>
                                                    <select
                                                        value={func.method}
                                                        onChange={(e) => handleUpdateFunction(index, { method: e.target.value as any })}
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
                                                    onChange={(val) => handleUpdateFunction(index, { path: val })}
                                                    placeholder="/v1/weather"
                                                    className={UI_CONSTANTS.CODE_EDITOR_CLASS}
                                                />
                                            </div>
                                            <button
                                                onClick={() => handleRemoveFunction(index)}
                                                className="mt-4 p-2 rounded-lg text-red-400 opacity-0 group-hover:opacity-100 hover:bg-red-500/10 transition-all"
                                                title="Remove Function"
                                            >
                                                <Icon name="delete" size={16} />
                                            </button>
                                        </div>
                                        <AppInput
                                            label="Description (for AI tools)"
                                            value={func.description || ''}
                                            onChange={(val) => handleUpdateFunction(index, { description: val })}
                                            placeholder="Fetches current weather for a city"
                                            className="text-xs"
                                        />
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </AppFormView>
    );
}
