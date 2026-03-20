import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Icon } from '../icon';

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

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;

            // Z-index check to handle nested modals: only the top-most one should catch the event
            const modals = Array.from(document.querySelectorAll('.fixed.inset-0.z-\\[2000\\], .fixed.inset-0.z-\\[1000\\], .fixed.inset-0.z-\\[3000\\]')) as HTMLElement[];
            if (modals.length > 0) {
                // Find the highest visible z-index
                const highestZ = Math.max(...modals.map(m => parseInt(getComputedStyle(m).zIndex) || 0));
                // Extract our z-index from the direct element if possible, or from modalRef
                const ourZ = modalRef.current ? parseInt(getComputedStyle(modalRef.current.parentElement!).zIndex) || 0 : 0;
                
                if (ourZ < highestZ) return;
            }

            if (e.key === 'Enter') {
                // Check if any element is focused and it's not a button or textarea
                const active = document.activeElement;
                if (active?.tagName !== 'BUTTON' && active?.tagName !== 'TEXTAREA') {
                    e.preventDefault();
                    e.stopPropagation();
                    onSubmit();
                }
            } else if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                onClose();
            }
        };

        // Use capture phase to ensure we intercept before global shortcuts, 
        // but the z-index check ensures we only handle it if we're top-most.
        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [isOpen, onSubmit, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/5 backdrop-blur-none animate-in fade-in duration-200 pointer-events-none">
            <div 
                ref={modalRef}
                style={{ 
                    transform: `translate(${position.x}px, ${position.y}px)`,
                    transition: isDragging ? 'none' : 'transform 0.1s ease-out'
                }}
                className={`w-full ${width} bg-[var(--bg-app)] border border-[var(--border-base)] rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 pointer-events-auto ${className}`}
            >
                <header 
                    onMouseDown={handleMouseDown}
                    className={`px-4 py-2 bg-[var(--bg-alt)] border-b border-[var(--border-base)] flex items-center justify-between select-none cursor-move ${isDragging ? 'cursor-grabbing' : ''}`}
                >
                    <div className="flex items-center gap-2">
                        {icon && <Icon name={icon} size={14} className="text-brand" />}
                        <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-main)]">
                            {title}
                        </h3>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-black/5 transition-all"
                    >
                        <Icon name="close" size={14} />
                    </button>
                </header>

                <div className="p-4 overflow-y-auto max-h-[70vh]">
                    {children}
                </div>

                <div className="px-4 py-2 bg-[var(--bg-alt)] border-t border-[var(--border-base)] flex items-center justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-3 py-1 rounded-lg text-[10px] font-bold border border-[var(--border-base)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-black/5 transition-all"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        onClick={() => onSubmit()}
                        className="px-4 py-1 rounded-lg bg-brand text-white text-[10px] font-bold hover:opacity-90 active:scale-95 transition-all shadow-sm"
                    >
                        {submitLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};
