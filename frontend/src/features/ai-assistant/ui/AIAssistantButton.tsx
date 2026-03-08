import React, { useState } from 'react';
import { Icon } from '../../../shared/ui/icon';
import { ComboBox } from '../../../shared/ui/combo-box/ComboBox';
import type { SelectionGroup } from '../../../shared/ui/selection-list/SelectionList';
import { AIAssistantModal } from './AIAssistantModal';
import { generateAIContent } from '../api';

interface AIAssistantButtonProps {
    hintType: string;
    onResult: (result: any) => void;
    context?: any;
    isEmpty?: boolean;
    label?: string;
    modelData: Record<string, SelectionGroup>;
}

export const AIAssistantButton: React.FC<AIAssistantButtonProps> = ({
    hintType,
    onResult,
    context,
    isEmpty = true,
    label = "AI Assistant",
    modelData
}) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [mode, setMode] = useState<'generate' | 'modify'>('generate');

    const handleConfirm = async (prompt: string, model: string) => {
        setIsGenerating(true);
        setIsModalOpen(false);

        try {
            const data = await generateAIContent({
                prompt,
                hint_type: hintType,
                model,
                is_modify: mode === 'modify',
                context
            });
            onResult(data.result);
        } catch (error) {
            console.error('AI Generation failed', error);
            alert('AI Generation failed');
        } finally {
            setIsGenerating(false);
        }
    };

    const aiMenuData: Record<string, SelectionGroup> = {
        items: {
            id: 'ai_menu',
            name: 'AI Actions',
            items: [
                { id: 'modify', name: 'Modify', icon: 'edit' },
                { id: 're-generate', name: 'RE-Generate', icon: 'refresh' },
            ],
            children: {},
            selectable: false
        }
    };

    return (
        <div className="flex items-center">
            {isEmpty ? (
                <button
                    onClick={() => {
                        setMode('generate');
                        setIsModalOpen(true);
                    }}
                    disabled={isGenerating}
                    className="flex items-center gap-2 px-3 py-1.5 bg-brand text-white rounded-lg shadow-md shadow-brand/10 hover:brightness-110 active:scale-95 transition-all font-bold text-[10px] uppercase tracking-wider disabled:opacity-50 disabled:pointer-events-none"
                >
                    <Icon name="bolt" size={12} />
                    {isGenerating ? 'Generating...' : label}
                </button>
            ) : (
                <ComboBox
                    data={aiMenuData}
                    onSelect={(item: any) => {
                        setMode(item.id === 'modify' ? 'modify' : 'generate');
                        setIsModalOpen(true);
                    }}
                    label={label}
                    icon="bolt"
                    variant="brand"
                    className="!py-0"
                />
            )}

            <AIAssistantModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={mode === 'modify' ? `Modify ${label}` : `AI ${label}`}
                description={mode === 'modify'
                    ? `Describe how you want to modify the current ${label.toLowerCase()}.`
                    : `Describe the ${label.toLowerCase()} you want to create.`
                }
                confirmLabel={mode === 'modify' ? "Modify" : "Generate"}
                onConfirm={handleConfirm}
                modelData={modelData}
            />
        </div>
    );
};
