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
                className="relative w-full max-w-sm bg-surface-800 border border-white/10 rounded-3xl p-8 shadow-2xl ring-1 ring-white/5 animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"
                onClick={(e) => e.stopPropagation()}
            >
                <h2 className="text-xl font-bold text-white mb-2 tracking-tight">{title}</h2>
                <p className="text-sm text-white/40 leading-relaxed mb-8">{description}</p>

                <div className="flex items-center gap-3">
                    <button
                        className="flex-1 px-4 py-3 rounded-2xl text-sm font-semibold text-white/60 hover:text-white hover:bg-white/5 border border-white/5 transition-all"
                        onClick={onCancel}
                    >
                        {cancelLabel}
                    </button>
                    <button
                        className="flex-1 px-4 py-3 rounded-2xl text-sm font-semibold bg-red-500 hover:bg-red-400 text-white shadow-lg shadow-red-500/20 transition-all active:scale-[0.98]"
                        onClick={onConfirm}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};

