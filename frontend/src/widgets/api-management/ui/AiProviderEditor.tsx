import { useState, useMemo, useEffect } from 'react';
import type { AiProvider, AiProviderModel } from '../../../entities/ai-provider/model/types';
import { AppFormView } from '../../../shared/ui/app-form-view';
import { AppInput } from '../../../shared/ui/app-input';
import { Icon } from '../../../shared/ui/icon';
import { AppRoundButton } from '../../../shared/ui/app-round-button/AppRoundButton';
import { ComboBox } from '../../../shared/ui/combo-box/ComboBox';
import { useCredentials } from '../../../entities/credential/api';
import { UI_CONSTANTS } from '../../../shared/ui/constants';

interface AiProviderEditorProps {
    provider: AiProvider | null;
    isSaving: boolean;
    onSave: (data: Partial<AiProvider>) => void;
    onCancel: () => void;
    isHotkeysEnabled?: boolean;
}

export function AiProviderEditor({ provider, isSaving, onSave, onCancel, isHotkeysEnabled }: AiProviderEditorProps) {
    const { data: credentials = [] } = useCredentials();

    const [formData, setFormData] = useState<Partial<AiProvider>>(provider || {
        key: '',
        models: { models: [] },
        api_key: '',
        base_url: '',
        description: ''
    });

    // Extract models list from the required structure { "models": [] }
    const [modelsList, setModelsList] = useState<AiProviderModel[]>(() => {
        if (provider?.models && typeof provider.models === 'object' && Array.isArray(provider.models.models)) {
            return provider.models.models.map(m => typeof m === 'string' ? { name: m } : m);
        }
        return [];
    });

    // Sync local state when provider prop changes (e.g. after save)
    useEffect(() => {
        if (provider) {
            setFormData(provider);
            if (provider.models && typeof provider.models === 'object' && Array.isArray(provider.models.models)) {
                setModelsList(provider.models.models.map(m => typeof m === 'string' ? { name: m } : m));
            } else {
                setModelsList([]);
            }
        }
    }, [provider]);

    const isDirty = useMemo(() => {
        const initialModels = provider?.models && typeof provider.models === 'object' && Array.isArray(provider.models.models) 
            ? provider.models.models.map(m => typeof m === 'string' ? { name: m } : m)
            : [];
        
        return provider 
            ? (formData.key !== provider.key || 
               formData.api_key !== provider.api_key || 
               formData.base_url !== provider.base_url ||
               formData.description !== provider.description ||
               JSON.stringify(modelsList) !== JSON.stringify(initialModels))
            : (formData.key !== '' || formData.api_key !== '' || formData.base_url !== '' || formData.description !== '' || modelsList.length > 0);
    }, [formData, modelsList, provider]);

    const handleSave = () => {
        onSave({ 
            ...formData, 
            description: formData.description || null,
            api_key: formData.api_key || null,
            base_url: formData.base_url || undefined,
            models: { models: modelsList.filter(m => m.name.trim() !== '') }
        });
    };

    const handleAddModel = () => {
        setModelsList([...modelsList, { name: '', base_url: '' }]);
    };

    const handleUpdateModel = (index: number, field: keyof AiProviderModel, value: string) => {
        const newList = [...modelsList];
        newList[index] = { ...newList[index], [field]: value };
        setModelsList(newList);
    };

    const handleRemoveModel = (index: number) => {
        setModelsList(modelsList.filter((_, i) => i !== index));
    };

    const credentialItems = useMemo(() => credentials.map(c => ({
        id: c.key,
        name: c.key,
        description: c.description || undefined,
        icon: 'key'
    })), [credentials]);

    const selectedCredential = credentials.find(c => c.key === formData.api_key);

    return (
        <AppFormView
            title={provider ? (provider.key || 'Editing') : 'Add New AI Provider'}
            parentTitle="AI Providers"
            icon="hive"
            isDirty={isDirty}
            isSaving={isSaving}
            onSave={handleSave}
            onCancel={onCancel}
            saveLabel={provider ? "Save Provider" : "Add Provider"}
            entityId={provider?.id}
            entityType="ai_providers"
            isHotkeysEnabled={isHotkeysEnabled}
        >
            <div className="max-w-5xl mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-500 px-2 pt-1 pb-2">
                <header className="mb-4">
                    <p className="text-sm text-[var(--text-muted)] mt-1 opacity-60">Configure an integration with an AI model provider.</p>
                </header>
                <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                        <AppInput
                            label="Provider Key"
                            required
                            value={formData.key || ''}
                            onChange={(val) => setFormData({ ...formData, key: val })}
                            placeholder="e.g. local_openai"
                            className={UI_CONSTANTS.CODE_EDITOR_CLASS}
                        />
                        
                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-bold text-[var(--text-main)]">API Key (Credential)</label>
                            <ComboBox
                                value={formData.api_key || ''}
                                label={selectedCredential?.key || formData.api_key || 'Select Credential'}
                                subLabel={selectedCredential?.description || (formData.api_key ? 'Manual key' : 'Assign a secure token')}
                                icon="key"
                                items={credentialItems}
                                onSelect={(item) => setFormData({ ...formData, api_key: item.id })}
                                searchPlaceholder="Search credentials..."
                                className="w-full"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <AppInput
                            label="Base URL"
                            value={formData.base_url || ''}
                            onChange={(val) => setFormData({ ...formData, base_url: val })}
                            placeholder="e.g. http://localhost:1234/v1"
                            className={UI_CONSTANTS.CODE_EDITOR_CLASS}
                        />
                        <AppInput
                            label="Description"
                            value={formData.description || ''}
                            onChange={(val) => setFormData({ ...formData, description: val })}
                            placeholder="Short purpose note"
                        />
                    </div>
                    
                    <div className="mt-8">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-sm font-bold text-[var(--text-main)]">Models List</h3>
                                <p className="text-[10px] text-[var(--text-muted)] font-black uppercase tracking-widest opacity-60 mt-0.5">
                                    Define available models and optional individual API endpoints
                                </p>
                            </div>
                            <AppRoundButton
                                icon="add"
                                onClick={handleAddModel}
                                variant="brand"
                                size="small"
                                title="Add Model"
                            />
                        </div>

                        <div className="space-y-3 bg-surface-800/30 p-4 rounded-2xl border border-[var(--border-base)] min-h-[100px]">
                            {modelsList.length === 0 ? (
                                <div className="h-16 flex items-center justify-center text-[var(--text-muted)] italic text-xs opacity-50">
                                    No models added. Click + to add your first model.
                                </div>
                            ) : (
                                modelsList.map((model, index) => (
                                    <div key={index} className="flex items-center gap-3 group animate-in fade-in slide-in-from-left-2 duration-200">
                                        <div className="flex-[2]">
                                            <AppInput
                                                value={model.name}
                                                onChange={(val) => handleUpdateModel(index, 'name', val)}
                                                placeholder="Model name (e.g. assistant)"
                                                className={UI_CONSTANTS.CODE_EDITOR_CLASS}
                                            />
                                        </div>
                                        <div className="flex-[3]">
                                            <AppInput
                                                value={model.base_url || ''}
                                                onChange={(val) => handleUpdateModel(index, 'base_url', val)}
                                                placeholder="API URL Override (optional)"
                                                className={UI_CONSTANTS.CODE_EDITOR_CLASS}
                                            />
                                        </div>
                                        <button
                                            onClick={() => handleRemoveModel(index)}
                                            className="p-2 rounded-xl text-red-400 opacity-0 group-hover:opacity-100 hover:bg-red-500/10 transition-all"
                                            title="Remove Model"
                                        >
                                            <Icon name="delete" size={18} />
                                        </button>
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


