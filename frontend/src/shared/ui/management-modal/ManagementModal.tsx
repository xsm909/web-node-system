import React from 'react';
import { Icon } from '../icon';

interface ManagementModalProps {
    isOpen: boolean;
    onClose: () => void;
    icon: string;
    title: string;
    description: string;
    children: React.ReactNode;
    onSave: () => void;
    saveButtonText?: string;
    isSaving?: boolean;
    saveDisabled?: boolean;
    headerRightContent?: React.ReactNode;
}

export const ManagementModal: React.FC<ManagementModalProps> = ({
    isOpen,
    onClose,
    icon,
    title,
    description,
    children,
    onSave,
    saveButtonText = 'Save',
    isSaving = false,
    saveDisabled = false,
    headerRightContent,
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[1001] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
            <div className="w-full max-w-2xl bg-surface-800 border border-[var(--border-base)] rounded-[2.5rem] shadow-2xl overflow-hidden ring-1 ring-black/5 dark:ring-white/5 animate-in zoom-in-95 duration-500 max-h-[90vh] flex flex-col">
                <header className="px-10 py-8 border-b border-[var(--border-base)] flex flex-shrink-0 items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-brand/10 flex items-center justify-center text-brand border border-brand/20">
                            <Icon name={icon} size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-[var(--text-main)] tracking-tight">
                                {title}
                            </h2>
                            <p className="text-[10px] text-[var(--text-muted)] font-black uppercase tracking-widest opacity-60">
                                {description}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        {headerRightContent}
                        <button
                            onClick={onClose}
                            className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--border-muted)] transition-all"
                        >
                            <Icon name="close" size={20} />
                        </button>
                    </div>
                </header>

                <div className="p-10 space-y-8 overflow-y-auto flex-1">
                    {children}
                </div>

                <div className="px-10 py-8 bg-[var(--border-muted)]/30 border-t border-[var(--border-base)] flex flex-shrink-0 items-center justify-end gap-4">
                    <button
                        onClick={onClose}
                        className="px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] hover:text-[var(--text-main)] transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onSave}
                        disabled={isSaving || saveDisabled}
                        className="px-8 py-3 rounded-2xl bg-brand text-white text-[10px] font-black uppercase tracking-widest shadow-xl shadow-brand/20 hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
                    >
                        {saveButtonText}
                    </button>
                </div>
            </div>
        </div>
    );
};
