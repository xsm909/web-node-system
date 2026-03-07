import React from 'react';

export type ConfirmModalVariant = 'danger' | 'warning' | 'success';

interface ConfirmModalProps {
    isOpen: boolean;
    title: string;
    description: string;
    confirmLabel?: string;
    cancelLabel?: string;
    showCancel?: boolean;
    variant?: ConfirmModalVariant;
    children?: React.ReactNode;
    onConfirm: () => void;
    onCancel: () => void;
}

const variantStyles: Record<ConfirmModalVariant, {
    iconBg: string;
    iconColor: string;
    iconBorder: string;
    buttonBg: string;
    buttonShadow: string;
    icon: React.ReactNode;
}> = {
    danger: {
        iconBg: 'bg-red-500/10',
        iconColor: 'text-red-500',
        iconBorder: 'border-red-500/20',
        buttonBg: 'bg-red-500 hover:brightness-110',
        buttonShadow: 'shadow-red-500/20',
        icon: (
            <>
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </>
        ),
    },
    warning: {
        iconBg: 'bg-amber-500/10',
        iconColor: 'text-amber-500',
        iconBorder: 'border-amber-500/20',
        buttonBg: 'bg-amber-500 hover:brightness-110',
        buttonShadow: 'shadow-amber-500/20',
        icon: (
            <>
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </>
        ),
    },
    success: {
        iconBg: 'bg-emerald-500/10',
        iconColor: 'text-emerald-500',
        iconBorder: 'border-emerald-500/20',
        buttonBg: 'bg-emerald-500 hover:brightness-110',
        buttonShadow: 'shadow-emerald-500/20',
        icon: (
            <>
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </>
        ),
    }
};

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
    isOpen,
    title,
    description,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    showCancel = true,
    variant = 'danger',
    children,
    onConfirm,
    onCancel,
}) => {
    if (!isOpen) return null;

    const styles = variantStyles[variant];

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
                <div className={`w-16 h-16 rounded-3xl ${styles.iconBg} flex items-center justify-center mb-6 border ${styles.iconBorder}`}>
                    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={styles.iconColor}>
                        {styles.icon}
                    </svg>
                </div>

                <h2 className="text-2xl font-black text-[var(--text-main)] mb-3 tracking-tight">{title}</h2>
                <p className="text-sm text-[var(--text-muted)] leading-relaxed mb-6 opacity-70 font-medium">{description}</p>

                {children && <div className="mb-8">{children}</div>}

                <div className="flex items-center gap-3">
                    {showCancel && (
                        <button
                            className="flex-1 px-4 py-4 rounded-2xl text-xs font-bold text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--border-muted)] border border-[var(--border-base)] transition-all uppercase tracking-widest active:scale-95"
                            onClick={onCancel}
                        >
                            {cancelLabel}
                        </button>
                    )}
                    <button
                        className={`flex-1 px-4 py-4 rounded-2xl text-xs font-bold text-white shadow-xl transition-all active:scale-95 uppercase tracking-widest ${styles.buttonBg} ${styles.buttonShadow}`}
                        onClick={onConfirm}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>

        </div>
    );
};

