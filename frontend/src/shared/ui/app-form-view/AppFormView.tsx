import React, { useState } from 'react';
import { AppHeader } from '../../../widgets/app-header';
import { ConfirmModal } from '../confirm-modal';
import { Icon } from '../icon';

export interface AppFormTab {
    id: string;
    label: string;
}

export interface AppFormViewProps {
    title: string;
    parentTitle?: string;
    icon?: string;
    
    tabs?: AppFormTab[];
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
    saveLabel = 'Save Changes'
}) => {
    const [showConfirmBack, setShowConfirmBack] = useState(false);

    const handleBack = () => {
        if (isDirty) {
            setShowConfirmBack(true);
        } else {
            onCancel();
        }
    };

    const handleDiscard = () => {
        setShowConfirmBack(false);
        if (onDiscard) {
            onDiscard();
        } else {
            onCancel();
        }
    };

    return (
        <div className="w-full h-full flex flex-col bg-[var(--bg-app)] text-[var(--text-main)] overflow-hidden">
            <AppHeader
                onToggleSidebar={() => {}}
                isSidebarOpen={false}
                onBack={handleBack}
                leftContent={
                    <div className="flex items-center gap-3 ml-2 lg:ml-0">
                        {icon && (
                            <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center text-brand">
                                <Icon name={icon} size={18} />
                            </div>
                        )}
                        <h1 className="text-lg lg:text-xl font-semibold tracking-tight text-[var(--text-main)] opacity-90 truncate">
                            {parentTitle ? (
                                <div className="flex items-center gap-2">
                                    <span className="opacity-50 hover:opacity-100 cursor-pointer transition-opacity text-sm lg:text-base" onClick={handleBack}>{parentTitle}</span>
                                    <span className="opacity-40 text-sm">/</span>
                                    <span>{title}</span>
                                </div>
                            ) : (
                                <span>{title}</span>
                            )}
                        </h1>
                    </div>
                }
                rightContent={
                    <div className="flex items-center gap-3">
                        {headerRightContent}
                        <button
                            type="button"
                            onClick={onSave}
                            disabled={isSaving}
                            className={`flex items-center justify-center w-10 h-10 rounded-full bg-brand text-white hover:brightness-110 transition-all shadow-lg shadow-brand/20 active:scale-95 shrink-0 ${isSaving ? 'opacity-70 pointer-events-none' : ''}`}
                            title={saveLabel}
                        >
                            <Icon name={isSaving ? 'sync' : 'save'} size={20} className={isSaving ? 'animate-spin' : ''} />
                        </button>
                    </div>
                }
            />

            <div className="flex-1 overflow-hidden flex flex-col">
                {tabs && tabs.length > 0 && (
                    <header className="px-10 pt-6 pb-0 border-b border-[var(--border-base)]">
                        <div className="flex gap-2">
                            {tabs.map(tab => (
                                <button
                                    key={tab.id}
                                    type="button"
                                    className={`px-8 py-3 text-xs font-black uppercase tracking-widest transition-all border-b-2 rounded-t-xl ${activeTab === tab.id
                                        ? 'text-brand border-brand bg-brand/5'
                                        : 'text-[var(--text-muted)] border-transparent hover:text-[var(--text-main)] hover:bg-[var(--border-muted)] opacity-60 hover:opacity-100'
                                        }`}
                                    onClick={() => onTabChange && onTabChange(tab.id)}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </header>
                )}

                <div className="flex-1 overflow-hidden flex flex-col">
                    <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
                        {children}
                    </div>

                    <div className={`${footer ? 'px-10 py-6' : 'h-[10px] opacity-50'} bg-[var(--border-muted)]/30 border-t border-[var(--border-base)] flex flex-row items-center gap-4 overflow-hidden transition-all duration-300`}>
                        {footer}
                    </div>
                </div>

                <ConfirmModal
                    isOpen={showConfirmBack}
                    title="Unsaved Changes"
                    description="You have unsaved changes. Do you want to save them before leaving?"
                    confirmLabel="Save Changes"
                    cancelLabel="Stay and Edit"
                    variant="warning"
                    onConfirm={async () => {
                        setShowConfirmBack(false);
                        await onSave();
                        onCancel();
                    }}
                    onCancel={() => setShowConfirmBack(false)}
                >
                     <div className="mt-2">
                         <button
                             type="button"
                             className="w-full px-4 py-3 rounded-2xl text-xs font-bold text-red-500 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-all uppercase tracking-widest active:scale-95"
                             onClick={handleDiscard}
                         >
                             Discard Changes
                         </button>
                     </div>
                </ConfirmModal>
            </div>
        </div>
    );
};
