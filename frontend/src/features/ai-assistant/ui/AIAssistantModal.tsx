import React, { useState } from 'react';
import { ComboBox } from '../../../shared/ui/combo-box/ComboBox';
import { ConfirmModal } from '../../../shared/ui/confirm-modal/ConfirmModal';
import type { SelectionGroup } from '../../../shared/ui/selection-list/SelectionList';

interface AIAssistantModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    description: string;
    confirmLabel: string;
    onConfirm: (prompt: string, model: string) => void;
    initialPrompt?: string;
    modelData: Record<string, SelectionGroup>;
}

export const AIAssistantModal: React.FC<AIAssistantModalProps> = ({
    isOpen,
    onClose,
    title,
    description,
    confirmLabel,
    onConfirm,
    initialPrompt = '',
    modelData
}) => {
    const [prompt, setPrompt] = useState(initialPrompt);
    const [selectedModel, setSelectedModel] = useState('gpt-4o');

    // Sync prompt with initialPrompt when modal opens or initialPrompt changes
    React.useEffect(() => {
        if (isOpen) {
            setPrompt(initialPrompt);
        }
    }, [isOpen, initialPrompt]);

    const handleConfirm = () => {
        onConfirm(prompt, selectedModel);
        setPrompt('');
    };

    return (
        <ConfirmModal
            isOpen={isOpen}
            title={title}
            description={description}
            confirmLabel={confirmLabel}
            cancelLabel="Cancel"
            variant="warning"
            onConfirm={handleConfirm}
            onCancel={() => {
                onClose();
                setPrompt('');
            }}
        >
            <div className="mt-6 space-y-4">
                <div className="space-y-2">
                    <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                        AI Prompt
                    </label>
                    <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Describe your requirements..."
                        className="w-full px-4 py-3 rounded-2xl bg-[var(--bg-app)] border border-[var(--border-base)] text-sm focus:outline-none focus:border-brand transition-all resize-none h-32"
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                        AI Model
                    </label>
                    <ComboBox
                        value={selectedModel}
                        label={selectedModel}
                        placeholder="Select AI Model..."
                        data={modelData}
                        onSelect={(item: any) => setSelectedModel(item.id)}
                        className="w-full"
                        icon="smart_toy"
                    />
                </div>
            </div>
        </ConfirmModal>
    );
};
