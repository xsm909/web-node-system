import React, { useEffect } from 'react';
import { Icon } from '../icon';

interface SlidePanelProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    subtitle?: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
    width?: string;
}

export const SlidePanel: React.FC<SlidePanelProps> = ({
    isOpen,
    onClose,
    title,
    subtitle,
    children,
    footer,
    width = 'w-full max-w-2xl'
}) => {
    // Prevent body scroll when open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[3000] flex justify-end">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300"
                onClick={onClose}
            />

            {/* Panel */}
            <div className={`relative h-full bg-[var(--bg-app)] border-l border-[var(--border-base)] shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 ${width}`}>
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-[var(--border-base)] bg-surface-800/50 backdrop-blur-md">
                    <div className="flex flex-col">
                        <h2 className="text-xl font-bold text-[var(--text-main)] tracking-tight">{title}</h2>
                        {subtitle && <p className="text-[10px] text-[var(--text-muted)] font-black uppercase tracking-widest opacity-60 mt-0.5">{subtitle}</p>}
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 mr-[-8px] rounded-xl text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--border-muted)] transition-all active:scale-95"
                    >
                        <Icon name="close" size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-surface-800/20">
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {children}
                    </div>
                </div>

                {/* Footer */}
                {footer && (
                    <div className="p-6 border-t border-[var(--border-base)] bg-surface-800/50 backdrop-blur-md">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
};
