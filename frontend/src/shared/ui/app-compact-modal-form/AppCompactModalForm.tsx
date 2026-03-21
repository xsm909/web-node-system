import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../icon';
import { useHotkeys } from '../../lib/hotkeys/useHotkeys';

interface AppCompactModalFormProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    icon?: string;
    children: React.ReactNode;
    onSubmit: (e?: React.FormEvent) => void;
    submitLabel?: string;
    cancelLabel?: string;
    className?: string;
    width?: string;
    fullHeight?: boolean;
    noPadding?: boolean;
    headerLeftContent?: React.ReactNode;
    headerRightContent?: React.ReactNode;
    allowedShortcuts?: string[];
}

export const AppCompactModalForm: React.FC<AppCompactModalFormProps> = ({
    isOpen,
    onClose,
    title,
    icon,
    children,
    onSubmit,
    submitLabel = 'OK',
    cancelLabel = 'Cancel',
    className = '',
    width = 'max-w-lg',
    fullHeight = false,
    noPadding = false,
    headerLeftContent,
    headerRightContent,
    allowedShortcuts = [],
}) => {
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const modalRef = useRef<HTMLDivElement>(null);

    // Reset position when opening
    useEffect(() => {
        if (isOpen) {
            setPosition({ x: 0, y: 0 });
        }
    }, [isOpen]);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        // Only drag if clicking the header itself or its children (except the close button)
        if ((e.target as HTMLElement).closest('button')) return;
        
        setIsDragging(true);
        setDragStart({
            x: e.clientX - position.x,
            y: e.clientY - position.y
        });
    }, [position]);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging) return;
            
            setPosition({
                x: e.clientX - dragStart.x,
                y: e.clientY - dragStart.y
            });
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, dragStart]);

    useHotkeys([
        {
            key: 'Escape',
            description: 'Close Modal',
            handler: () => onClose(),
        },
        {
            key: 'Enter',
            description: submitLabel,
            preventDefault: false, // Let handler decide
            handler: (e) => {
                const active = document.activeElement;
                if (active?.tagName !== 'BUTTON' && active?.tagName !== 'TEXTAREA') {
                    e.preventDefault();
                    onSubmit();
                }
            }
        }
    ], { 
        scopeName: 'Modal', 
        enabled: isOpen,
        exclusive: true,
        exclusiveExceptions: allowedShortcuts 
    });

    if (!isOpen) return null;

    const modalContent = (
        <div 
            className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/20 backdrop-blur-none animate-in fade-in duration-200"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) e.stopPropagation();
            }}
        >
            <div 
                ref={modalRef}
                role="dialog"
                style={{ 
                    transform: `translate(${position.x}px, ${position.y}px)`,
                    transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                    ...(fullHeight ? { height: '90vh' } : {})
                }}
                className={`w-full ${width} bg-[var(--bg-app)] border border-[var(--border-base)] rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 pointer-events-auto ${className}`}
            >
                <header 
                    onMouseDown={handleMouseDown}
                    className={`px-4 py-2 bg-[var(--bg-alt)] border-b border-[var(--border-base)] flex items-center justify-between select-none cursor-move ${isDragging ? 'cursor-grabbing' : ''}`}
                >
                    <div className="flex items-center gap-4 flex-1">
                        <div className="flex items-center gap-2">
                            {icon && <Icon name={icon} size={14} className="text-brand" />}
                            <h3 className="text-[10px] font-normal uppercase tracking-wider text-[var(--text-main)] whitespace-nowrap">
                                {title}
                            </h3>
                        </div>
                        {headerLeftContent && (
                            <div className="flex items-center gap-2">
                                {headerLeftContent}
                            </div>
                        )}
                    </div>
                    
                    <div className="flex items-center gap-3">
                        {headerRightContent && (
                            <div className="flex items-center gap-2 border-r border-[var(--border-base)] pr-3 mr-1">
                                {headerRightContent}
                            </div>
                        )}
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-black/5 transition-all flex-shrink-0"
                        >
                            <Icon name="close" size={14} />
                        </button>
                    </div>
                </header>

                <div className={`flex-1 flex flex-col min-h-0 ${fullHeight ? 'max-h-none overflow-hidden' : 'max-h-[70vh] overflow-y-auto'} ${noPadding ? '' : 'p-4'}`}>
                    {children}
                </div>

                <div className="px-4 py-2 bg-[var(--bg-alt)] border-t border-[var(--border-base)] flex items-center justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-3 py-1 rounded-lg text-[10px] font-normal border border-[var(--border-base)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-black/5 transition-all"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        onClick={() => onSubmit()}
                        className="px-4 py-1 rounded-lg bg-brand text-white text-[10px] font-normal hover:opacity-90 active:scale-95 transition-all shadow-sm"
                    >
                        {submitLabel}
                    </button>
                </div>
            </div>
        </div>
    );

    if (typeof document === 'undefined') return null;
    return createPortal(modalContent, document.body);
};
