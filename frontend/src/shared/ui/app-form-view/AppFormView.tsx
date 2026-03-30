import React, { useState, useCallback } from 'react';
import { AppHeader } from '../../../widgets/app-header';
import { AppCompactModalForm } from '../app-compact-modal-form/AppCompactModalForm';
import { Icon } from '../icon';
import { AppLockToggle } from '../app-lock-toggle/AppLockToggle';
import { useRegisterBlocker } from '../../lib/navigation-guard/useNavigationGuard';
import { useHotkeys } from '../../lib/hotkeys/useHotkeys';
import { usePinStore } from '../../../features/pinned-tabs/model/store';

import { AppTabs, type AppTab } from '../app-tabs';

export type { AppTab as AppFormTab };

export interface AppFormViewProps {
    title: string;
    parentTitle?: string;
    icon?: string;
    
    tabs?: AppTab[];
    activeTab?: string;
    onTabChange?: (tabId: string) => void;
    
    isDirty: boolean;
    isSaving?: boolean;
    
    onSave: () => void | Promise<void>;
    onCancel: () => void;
    onDiscard?: () => void;
    
    headerRightContent?: React.ReactNode;
    footer?: React.ReactNode;
    children: React.ReactNode;
    
    saveLabel?: string;
    blockerId?: string;
    fullHeight?: boolean;
    noPadding?: boolean;
    allowedShortcuts?: string[];
    
    // Lock Support
    isLocked?: boolean;
    entityId?: string;
    entityType?: string;
    onLockToggle?: (isLocked: boolean) => void;
    error?: string;
    projectId?: string | null;
    isHotkeysEnabled?: boolean;
    hideHeader?: boolean;
}

export const AppFormView: React.FC<AppFormViewProps> = ({
    title,
    parentTitle,
    icon = "device_hub",
    tabs,
    activeTab,
    onTabChange,
    isDirty,
    isSaving,
    onSave,
    onCancel,
    onDiscard,
    headerRightContent,
    footer,
    children,
    saveLabel = 'Save Changes',
    blockerId = 'app-form-view',
    fullHeight = false,
    noPadding = false,
    allowedShortcuts = [],
    isLocked = false,
    entityId,
    entityType,
    onLockToggle,
    error,
    projectId,
    isHotkeysEnabled,
    hideHeader = false
}) => {
    const [showConfirmBack, setShowConfirmBack] = useState(false);
    
    // Pinning Logic
    const { tabs: pinnedTabs, pin, unpin, updateTab } = usePinStore();
    const pinId = entityType && entityId ? `${entityType}:${entityId}` : null;
    const isPinned = pinnedTabs.some(t => t.id === pinId);

    const handlePinToggle = useCallback(() => {
        if (!pinId || !entityType || !entityId) return;
        
        if (isPinned) {
            unpin(pinId);
        } else {
            pin({
                entityType,
                entityId,
                title,
                icon,
                projectId
            });
            // When pinning from the main workspace, go back to the list
            onCancel();
        }
    }, [isPinned, pinId, entityType, entityId, title, icon, pin, unpin, projectId, onCancel]);

    // Memoize metadata to ensure updateTab only finds changes when they're real
    const tabMetadata = React.useMemo(() => ({
        isDirty,
        title,
        icon,
        projectId
    }), [isDirty, title, icon, projectId]);

    // Update pinned tab state (sync with current component props)
    React.useEffect(() => {
        if (pinId && isPinned) {
            updateTab(pinId, tabMetadata);
        }
    }, [isPinned, pinId, updateTab, tabMetadata]);

    // Register this form with the navigation guard
    // For pinned tabs, use the unique pinId as the blockerId to avoid collisions
    const finalBlockerId = isPinned ? (pinId || blockerId) : blockerId;

    useRegisterBlocker(
        finalBlockerId, 
        isPinned ? false : isDirty, 
        onSave, 
        onDiscard || onCancel
    );

    const handleBack = useCallback(() => {
        if (isDirty) {
            setShowConfirmBack(true);
            return;
        }
        
        if (isPinned && pinId) {
            unpin(pinId);
        } else {
            onCancel();
        }
    }, [isDirty, isPinned, pinId, unpin, onCancel]);

    useHotkeys([
        {
            key: 'Escape',
            description: isPinned ? 'Close tab' : 'Back',
            handler: handleBack,
        },
        {
            key: 'cmd+s',
            description: saveLabel,
            handler: onSave,
        },
        {
            key: 'ctrl+s',
            description: saveLabel,
            handler: onSave,
        }
    ], { 
        scopeName: 'Form View',
        exclusive: true,
        exclusiveExceptions: allowedShortcuts,
        enabled: isHotkeysEnabled !== false
    });

    const handleDiscard = () => {
        setShowConfirmBack(false);
        if (isPinned && pinId) {
            unpin(pinId);
        } else if (onDiscard) {
            onDiscard();
        } else {
            onCancel();
        }
    };

    const handleConfirmSave = async () => {
        setShowConfirmBack(false);
        await onSave();
        if (isPinned && pinId) {
            unpin(pinId);
        } else {
            onCancel();
        }
    };

    return (
        <div className="w-full h-full flex flex-col bg-[var(--bg-app)] text-[var(--text-main)] overflow-hidden">
            {!hideHeader && (
                <AppHeader
                    onToggleSidebar={() => {}}
                    isSidebarOpen={false}
                    onBack={handleBack}
                    isDirty={isDirty}
                    isPinned={isPinned}
                    canPin={!!(entityId && entityType)}
                    onPinToggle={handlePinToggle}
                    projectId={projectId}
                    leftContent={
                        <div className="flex items-center gap-3 ml-2 lg:ml-0">
                            {icon && (
                                <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center text-brand">
                                    <Icon name={icon} size={18} />
                                </div>
                            )}
                            <h1 className="text-lg lg:text-xl font-semibold tracking-tight text-[var(--text-main)] opacity-90 truncate flex items-center gap-2">
                                {parentTitle ? (
                                    <div className="flex items-center gap-2">
                                        <span className="opacity-50 hover:opacity-100 cursor-pointer transition-opacity text-sm lg:text-base" onClick={handleBack}>{parentTitle}</span>
                                        <span className="opacity-40 text-sm">/</span>
                                        <span>{title}</span>
                                    </div>
                                ) : (
                                    <span>{title}</span>
                                )}
                                {isLocked && (
                                    <Icon 
                                        name="lock" 
                                        size={16} 
                                        className="text-amber-500 ml-1" 
                                    />
                                )}
                            </h1>
                        </div>
                    }
                    rightContent={
                        <div className="flex items-center gap-3">
                            <AppLockToggle 
                                entityId={entityId}
                                entityType={entityType}
                                initialLocked={isLocked}
                                onToggle={onLockToggle}
                                onSave={onSave}
                                isSaving={isSaving}
                                isDirty={isDirty}
                                saveLabel={saveLabel}
                                className="mr-1"
                            />
                            {headerRightContent}
                        </div>
                    }
                />
            )}

            <div className="flex-1 overflow-hidden flex flex-col">
                {tabs && tabs.length > 0 && activeTab && (
                    <header className="px-10 pt-2 pb-0 border-b border-[var(--border-base)]">
                        <AppTabs 
                            tabs={tabs} 
                            activeTab={activeTab} 
                            onTabChange={(id) => onTabChange && onTabChange(id)} 
                        />
                    </header>
                )}

                <div className={`flex-1 flex flex-col min-h-0 ${fullHeight ? '' : 'overflow-hidden'}`}>
                    <div className={`flex-1 flex flex-col min-h-0 ${noPadding ? '' : 'px-10 pt-3 pb-10'} ${fullHeight ? '' : 'overflow-y-auto custom-scrollbar'}`}>
                        {error && (
                            <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-start gap-4 animate-in slide-in-from-top-2 duration-300">
                                <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500 flex-shrink-0">
                                    <Icon name="error" size={20} />
                                </div>
                                <div className="flex flex-col gap-1 min-w-0 py-0.5">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-red-500 opacity-80">Critical execution error</span>
                                    <p className="text-sm font-medium text-red-600 leading-relaxed break-words">{error}</p>
                                </div>
                            </div>
                        )}
                        {children}
                    </div>

                    <div className={`${footer ? 'px-10 py-6' : 'h-[10px] opacity-50'} bg-[var(--border-muted)]/30 border-t border-[var(--border-base)] flex flex-row items-center gap-4 overflow-hidden transition-all duration-300`}>
                        {footer}
                    </div>
                </div>

                <AppCompactModalForm
                    isOpen={showConfirmBack}
                    title="Unsaved Changes"
                    onSubmit={handleConfirmSave}
                    onClose={() => setShowConfirmBack(false)}
                    onDiscard={handleDiscard}
                    submitLabel="Save Changes"
                    discardLabel="Discard Changes"
                    cancelLabel="Stay and Edit"
                    width="max-w-md"
                    icon="warning"
                >
                    <div className="py-2">
                        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                            You have unsaved changes in this section. Do you want to save them before leaving?
                        </p>
                    </div>
                </AppCompactModalForm>
            </div>
        </div>
    );
};
