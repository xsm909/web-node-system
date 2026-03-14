import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigationGuardStore } from './store';

/**
 * Registers a component as a navigation blocker if it has unsaved changes.
 */
export const useRegisterBlocker = (
    id: string, 
    isDirty: boolean, 
    onSave: () => Promise<void> | void, 
    onDiscard: () => void
) => {
    const registerBlocker = useNavigationGuardStore(s => s.registerBlocker);
    const unregisterBlocker = useNavigationGuardStore(s => s.unregisterBlocker);

    // Store callbacks in a ref to avoid triggering useEffect loops when they change
    const callbacksRef = useRef({ onSave, onDiscard });
    useEffect(() => {
        callbacksRef.current = { onSave, onDiscard };
    }, [onSave, onDiscard]);

    useEffect(() => {
        registerBlocker({ 
            id, 
            isDirty, 
            onSave: async () => { await callbacksRef.current.onSave(); }, 
            onDiscard: () => callbacksRef.current.onDiscard() 
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, isDirty, registerBlocker]);

    useEffect(() => {
        return () => unregisterBlocker(id);
    }, [id, unregisterBlocker]);
};

/**
 * Hook for parent components to intercept navigation and show a confirmation modal.
 */
export const useNavigationIntercept = () => {
    const getDirtyBlocker = useNavigationGuardStore(s => s.getDirtyBlocker);
    const [pendingNavigate, setPendingNavigate] = useState<(() => void) | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const handleIntercept = useCallback((proceed: () => void) => {
        const activeBlocker = getDirtyBlocker();
        if (activeBlocker) {
            setPendingNavigate(() => proceed);
        } else {
            proceed();
        }
    }, [getDirtyBlocker]);

    const confirmSave = async () => {
        const activeBlocker = getDirtyBlocker();
        if (!activeBlocker || !pendingNavigate) return;
        
        setIsSaving(true);
        try {
            await activeBlocker.onSave();
            const navigate = pendingNavigate;
            setPendingNavigate(null);
            navigate();
        } catch (error) {
            console.error('Failed to save before navigation:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const confirmDiscard = () => {
        const activeBlocker = getDirtyBlocker();
        if (!activeBlocker || !pendingNavigate) return;
        
        activeBlocker.onDiscard();
        const navigate = pendingNavigate;
        setPendingNavigate(null);
        navigate();
    };

    const cancel = () => {
        setPendingNavigate(null);
    };

    return {
        isIntercepted: !!pendingNavigate,
        handleIntercept,
        confirmSave,
        confirmDiscard,
        cancel,
        isSaving,
    };
};
