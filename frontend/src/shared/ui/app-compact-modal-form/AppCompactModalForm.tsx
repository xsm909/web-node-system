import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../icon';
import { AppFormButton } from '../app-form-button/AppFormButton';
import { useHotkeys } from '../../lib/hotkeys/useHotkeys';
import { AppLockToggle } from '../app-lock-toggle/AppLockToggle';

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
    error?: string;
    
    // Dirty State Support
    isDirty?: boolean;
    onConfirmSave?: () => void;
    onDiscard?: () => void;
    discardLabel?: string;
    showCancel?: boolean;
    isSimpleDialog?: boolean;

    // Lock Support
    entityId?: string;
    entityType?: string;
    initialLocked?: boolean;
    onLockToggle?: (isLocked: boolean) => void;
    isSaving?: boolean;
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
    error,
    isDirty = false,
    onConfirmSave,
    onDiscard,
    discardLabel = 'Discard Changes',
    showCancel = true,
    isSimpleDialog = false,
    entityId,
    entityType,
    initialLocked = false,
    onLockToggle,
    isSaving = false,
}) => {
    const [showDirtyConfirm, setShowDirtyConfirm] = useState(false);
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
    
    const handleClose = useCallback(() => {
        if (isDirty) {
            setShowDirtyConfirm(true);
        } else {
            onClose();
        }
    }, [isDirty, onClose]);
    
    useHotkeys([
        {
            key: 'enter',
            description: 'Submit',
            enabled: isSimpleDialog || (!noPadding && !!submitLabel && !fullHeight),
            handler: () => onSubmit()
        },
        {
            key: 'cmd+s',
            description: 'Save Changes',
            enabled: !isSimpleDialog,
            handler: (e) => {
                e.preventDefault();
                onSubmit();
            }
        },
        {
            key: 'ctrl+s',
            description: 'Save Changes',
            enabled: !isSimpleDialog,
            handler: (e) => {
                e.preventDefault();
                onSubmit();
            }
        },
        {
            key: 'escape',
            description: 'Close',
            handler: () => handleClose()
        }
    ], { 
        scopeName: `AppCompactModalForm-${title}`, 
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
                            {isDirty && (
                                <div className="flex items-center ml-2">
                                    <div className="w-2 h-2 rounded-full bg-brand animate-pulse shadow-sm shadow-brand/50" title="Unsaved changes" />
                                </div>
                            )}
                        </div>
                        {headerLeftContent && (
                            <div className="flex items-center gap-2">
                                {headerLeftContent}
                            </div>
                        )}
                    </div>
                    
                    <div className="flex items-center gap-3">
                        {entityId && entityType && (
                            <div className="flex items-center gap-2 border-r border-[var(--border-base)] pr-3 mr-1">
                                <AppLockToggle
                                    entityId={entityId}
                                    entityType={entityType}
                                    initialLocked={initialLocked}
                                    onToggle={onLockToggle}
                                    isSaving={isSaving}
                                    isDirty={isDirty}
                                    size={14}
                                />
                            </div>
                        )}
                        {headerRightContent && (
                            <div className="flex items-center gap-2 border-r border-[var(--border-base)] pr-3 mr-1">
                                {headerRightContent}
                            </div>
                        )}
                        <button
                            type="button"
                            onClick={handleClose}
                            className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-black/5 transition-all flex-shrink-0"
                        >
                            <Icon name="close" size={14} />
                        </button>
                    </div>
                </header>

                <div className={`flex-1 flex flex-col min-h-0 ${fullHeight ? 'max-h-none overflow-hidden' : 'max-h-[70vh] overflow-y-auto'} ${noPadding ? '' : 'p-4'}`}>
                    {error && (
                        <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3 animate-in slide-in-from-top-2 duration-300">
                            <Icon name="error" size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
                            <div className="flex flex-col gap-0.5 min-w-0">
                                <span className="text-[10px] font-black uppercase tracking-widest text-red-500 opacity-80">Error occurred</span>
                                <p className="text-xs font-medium text-red-600 leading-relaxed break-words">{error}</p>
                            </div>
                        </div>
                    )}
                    {children}
                </div>

                <div className="px-4 py-2 bg-[var(--bg-alt)] border-t border-[var(--border-base)] flex items-center justify-end gap-2">
                    {onDiscard && (
                        <AppFormButton
                            label={discardLabel}
                            onClick={onDiscard}
                            className="mr-auto text-red-500 hover:bg-red-500/10 font-bold border-red-500/20"
                            withFrame={true}
                        />
                    )}
                    {showCancel && (
                        <AppFormButton
                            label={cancelLabel}
                            onClick={handleClose}
                        />
                    )}
                    <AppFormButton
                        label={submitLabel}
                        isDefault={true}
                        onClick={() => onSubmit()}
                    />
                </div>
            </div>

            <AppCompactModalForm
                isOpen={showDirtyConfirm}
                title="Unsaved Changes"
                onClose={() => setShowDirtyConfirm(false)}
                onSubmit={() => {
                    setShowDirtyConfirm(false);
                    if (onConfirmSave) {
                        onConfirmSave();
                    } else {
                        onSubmit();
                    }
                }}
                onDiscard={() => {
                    setShowDirtyConfirm(false);
                    if (onDiscard) {
                        onDiscard();
                    } else {
                        onClose();
                    }
                }}
                submitLabel="Save and Close"
                discardLabel="Discard Changes"
                cancelLabel="Stay and Edit"
                icon="warning"
                width="max-w-md"
            >
                <div className="py-2">
                    <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                        You have unsaved changes in this constructor. Do you want to save them before leaving?
                    </p>
                </div>
            </AppCompactModalForm>
        </div>
    );

    if (typeof document === 'undefined' || !document.body) return null;
    return createPortal(modalContent, document.body);
};
