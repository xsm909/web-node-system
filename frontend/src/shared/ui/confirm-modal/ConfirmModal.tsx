import React from 'react';

interface ConfirmModalProps {
    isOpen: boolean;
    title: string;
    description: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
    onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
    isOpen,
    title,
    description,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    onConfirm,
    onCancel,
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
                onClick={onCancel}
            />

            <div
                className="relative w-full max-w-sm bg-surface-800 border border-[var(--border-base)] rounded-[2rem] p-10 shadow-2xl shadow-black/40 ring-1 ring-black/5 dark:ring-white/5 animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="w-16 h-16 rounded-3xl bg-red-500/10 flex items-center justify-center mb-6 border border-red-500/20">
                    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-red-500">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                        <line x1="12" y1="9" x2="12" y2="13"></line>
                        <line x1="12" y1="17" x2="12.01" y2="17"></line>
                    </svg>
                </div>

                <h2 className="text-2xl font-black text-[var(--text-main)] mb-3 tracking-tight">{title}</h2>
                <p className="text-sm text-[var(--text-muted)] leading-relaxed mb-10 opacity-70 font-medium">{description}</p>

                <div className="flex items-center gap-3">
                    <button
                        className="flex-1 px-4 py-4 rounded-2xl text-xs font-bold text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--border-muted)] border border-[var(--border-base)] transition-all uppercase tracking-widest active:scale-95"
                        onClick={onCancel}
                    >
                        {cancelLabel}
                    </button>
                    <button
                        className="flex-1 px-4 py-4 rounded-2xl text-xs font-bold bg-red-500 hover:brightness-110 text-white shadow-xl shadow-red-500/20 transition-all active:scale-95 uppercase tracking-widest"
                        onClick={onConfirm}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>

        </div>
    );
};

