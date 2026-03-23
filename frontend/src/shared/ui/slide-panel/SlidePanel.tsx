import React, { useEffect } from 'react';
import { Icon } from '../icon';
import { useHotkeys } from '../../lib/hotkeys/useHotkeys';

interface SlidePanelProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    subtitle?: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
    width?: string;
    headerRightContent?: React.ReactNode;
    onSave?: () => void;
    onSaveAndClose?: () => void;
}

export const SlidePanel: React.FC<SlidePanelProps> = ({
    isOpen,
    onClose,
    title,
    subtitle,
    children,
    footer,
    width = 'w-full max-w-2xl',
    headerRightContent,
    onSave,
    onSaveAndClose
}) => {

    useHotkeys([
        {
            key: 'Escape',
            description: 'Close',
            handler: onClose,
        },
        ...(onSaveAndClose ? [{
            key: 'Enter',
            description: 'Save & Close',
            handler: onSaveAndClose,
        }] : []),
        ...(onSave ? [
            {
                key: 'cmd+s',
                description: 'Save',
                handler: onSave,
            },
            {
                key: 'ctrl+s',
                description: 'Save',
                handler: onSave,
            }
        ] : [])
    ], {
        scopeName: `SlidePanel-${title}`,
        exclusive: true,
        enabled: isOpen,
    });
    // Prevent body scroll when open
    useEffect(() => {
        if (isOpen) {
            document.body.classList.add('overflow-hidden');
        } else {
            document.body.classList.remove('overflow-hidden');
        }
        return () => {
            document.body.classList.remove('overflow-hidden');
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[80] flex justify-end">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 animate-in fade-in duration-300"
                onClick={onClose}
            />

            {/* Panel */}
            <div className={`relative h-full bg-[var(--bg-app)] border-l border-[var(--border-base)] shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 ${width}`}>
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-[var(--border-base)] bg-surface-800/50 backdrop-blur-md">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={onClose}
                            className="p-2 -ml-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--border-muted)] transition-all active:scale-95"
                            title="Close (Esc)"
                        >
                            <Icon name="close" size={24} />
                        </button>
                        <div className="flex flex-col">
                            <h2 className="text-xl font-bold text-[var(--text-main)] tracking-tight">{title}</h2>
                            {subtitle && <p className="text-[10px] text-[var(--text-muted)] font-black uppercase tracking-widest opacity-60 mt-0.5">{subtitle}</p>}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {headerRightContent}
                    </div>
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
