import { useState, useEffect } from 'react';
import { AppFormView } from '../../../shared/ui/app-form-view';
import { AppInput, AppFormFieldRect } from '../../../shared/ui/app-input';
import { UI_CONSTANTS } from '../../../shared/ui/constants';
import { 
    useCredentials,
    useCreateCredential, 
    useUpdateCredential 
} from '../../../entities/credential/api';
import { useQueryClient } from '@tanstack/react-query';
import { useProjectStore } from '../../../features/projects/store';
import type { Credential } from '../../../entities/credential/model/types';

interface CredentialEditorProps {
    credentialId?: string | null;
    isSaving?: boolean;
    onSaveSuccess?: (cred: Credential) => void;
    onCancel: () => void;
}

export const CredentialEditor = ({ credentialId, onSaveSuccess, onCancel }: CredentialEditorProps) => {
    const { baseProject } = useProjectStore();
    const { data: credentials = [] } = useCredentials(baseProject?.id);
    const queryClient = useQueryClient();

    const createMutation = useCreateCredential();
    const updateMutation = useUpdateCredential();

    const [formData, setFormData] = useState<Partial<Credential>>({
        key: '',
        value: '',
        type: 'api',
        description: '',
        expired: false
    });
    const [initialFormState, setInitialFormState] = useState<Partial<Credential>>({
        key: '', value: '', type: 'api', description: '', expired: false
    });

    useEffect(() => {
        if (credentialId && credentials.length > 0) {
            const cred = credentials.find(c => c.id === credentialId);
            if (cred) {
                setFormData(cred);
                setInitialFormState(cred);
            }
        } else if (!credentialId) {
            const empty = { key: '', value: '', type: 'api', description: '', expired: false };
            setFormData(empty);
            setInitialFormState(empty);
        }
    }, [credentialId, credentials]);

    const handleSave = async () => {
        try {
            let savedCred: Credential;
            const payload = {
                ...formData,
                description: formData.description || null
            };
            
            if (credentialId && credentialId !== 'new') {
                savedCred = await updateMutation.mutateAsync({ id: credentialId, data: payload });
            } else {
                savedCred = await createMutation.mutateAsync(payload);
            }
            
            setInitialFormState(savedCred);
            setFormData(savedCred);
            onSaveSuccess?.(savedCred);
        } catch {
            alert('Failed to save credential');
        }
    };

    const isDirty = formData.key !== initialFormState.key ||
                    formData.value !== initialFormState.value ||
                    formData.type !== initialFormState.type ||
                    formData.description !== initialFormState.description ||
                    formData.expired !== initialFormState.expired;

    const isSaving = createMutation.isPending || updateMutation.isPending;

    return (
        <AppFormView
            title={credentialId && credentialId !== 'new' ? (formData.key || 'Editing') : 'Add New Credential'}
            parentTitle="API Credentials"
            icon="verified"
            isDirty={isDirty}
            isSaving={isSaving}
            onSave={handleSave}
            onCancel={onCancel}
            saveLabel={credentialId && credentialId !== 'new' ? "Save Credential" : "Add Credential"}
            entityId={credentialId && credentialId !== 'new' ? credentialId : undefined}
            entityType="credentials"
            isLocked={!!formData.is_locked}
            onLockToggle={(locked) => {
                setFormData(prev => ({ ...prev, is_locked: locked }));
                queryClient.invalidateQueries({ queryKey: ['credentials'] });
            }}
        >
            <div className="max-w-5xl mx-auto w-full h-full animate-in fade-in slide-in-from-bottom-4 duration-500 px-2 pt-1 pb-2">
                <header className="mb-8">
                    <p className="text-sm text-[var(--text-muted)] mt-1 opacity-60">Configure your system-wide security keys and tokens.</p>
                </header>
                <div className="space-y-6">
                    <AppInput
                        label="Key Name"
                        required
                        value={formData.key || ''}
                        onChange={(val) => setFormData({ ...formData, key: val })}
                        placeholder="e.g. GEMINI_API_KEY"
                        className="font-mono font-bold"
                        disabled={!!formData.is_locked}
                    />
                    <AppInput
                        label="Value"
                        required
                        multiline
                        rows={4}
                        value={formData.value || ''}
                        onChange={(val) => setFormData({ ...formData, value: val })}
                        placeholder="Paste secret value here..."
                        className="font-mono font-bold"
                        disabled={!!formData.is_locked}
                    />
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-1.5">
                            <label className="text-sm font-bold text-[var(--text-main)]">Type</label>
                            <AppFormFieldRect disabled={!!formData.is_locked} className={UI_CONSTANTS.FORM_CONTROL_HEIGHT}>
                                <select
                                    value={formData.type}
                                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                    className="w-full bg-transparent outline-none h-full text-xs font-normal cursor-pointer"
                                    disabled={!!formData.is_locked}
                                >
                                    <option value="ai">AI / LLM Service</option>
                                    <option value="db">Database Accessory</option>
                                    <option value="telegram">Telegram Bot</option>
                                    <option value="api">Generic API Endpoint</option>
                                </select>
                            </AppFormFieldRect>
                        </div>
                        <AppInput
                            label="Description"
                            value={formData.description || ''}
                            onChange={(val) => setFormData({ ...formData, description: val })}
                            placeholder="Short purpose note"
                            disabled={!!formData.is_locked}
                        />
                    </div>
                    <div className="flex items-center gap-3 p-4 bg-[var(--bg-app-alt)] border border-[var(--border-base)] rounded-lg">
                        <input
                            type="checkbox"
                            disabled={!!formData.is_locked}
                            id="expired_checkbox"
                            checked={!!formData.expired}
                            onChange={(e) => setFormData({ ...formData, expired: e.target.checked })}
                            className="w-4 h-4 rounded border-[var(--border-base)] bg-[var(--bg-app)] text-[var(--brand-main)] focus:ring-[var(--brand-main)] cursor-pointer"
                        />
                        <label htmlFor="expired_checkbox" className="flex flex-col cursor-pointer">
                            <span className="text-sm font-bold text-[var(--text-main)]">Mark as Expired</span>
                            <span className="text-xs text-[var(--text-muted)] opacity-60">This key will be moved to the expired sub-tab and hidden from active selectors.</span>
                        </label>
                    </div>
                </div>
            </div>
        </AppFormView>
    );
};
