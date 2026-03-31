import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';

export interface Hotkey {
    key: string;            // e.g. 'Escape', 'F4', 'ctrl+s' or 'mod+s' (we will match e.key usually)
    description: string;
    handler: (e: KeyboardEvent) => void;
    preventDefault?: boolean;
    stopPropagation?: boolean;
    enabled?: boolean;      // If false, this hotkey is ignored
}

export interface HotkeyScope {
    id: string;
    name?: string;
    level: number;       // Higher level = higher priority (e.g. 0=global, 10=page, 20=modal)
    exclusive?: boolean; // If true, stops hotkey propagation down the stack
    exclusiveExceptions?: string[]; // Keys allowed to propagate even if exclusive is true
    hotkeys: Hotkey[];
    registrationIndex: number; // Used for stable sorting within the same level
}

export const HOTKEY_LEVEL = {
    GLOBAL: 0,
    PAGE: 10,
    FRAGMENT: 15,
    MODAL: 20,
    OVERLAY: 30
};

export interface HotkeysActions {
    addScope: (scope: Omit<HotkeyScope, 'registrationIndex'>) => void;
    removeScope: (id: string) => void;
    addHotkeyToScope: (scopeId: string, hotkey: Hotkey) => void;
    removeHotkeyFromScope: (scopeId: string, key: string) => void;
}

const HotkeysStateContext = createContext<HotkeyScope[] | undefined>(undefined);
const HotkeysActionsContext = createContext<HotkeysActions | undefined>(undefined);

export const useHotkeysState = () => {
    const context = useContext(HotkeysStateContext);
    if (!context) {
        throw new Error('useHotkeysState must be used within a HotkeysProvider');
    }
    return context;
};

export const useHotkeysActions = () => {
    const context = useContext(HotkeysActionsContext);
    if (!context) {
        throw new Error('useHotkeysActions must be used within a HotkeysProvider');
    }
    return context;
};

// Global base scope ID
export const GLOBAL_SCOPE_ID = 'global';

export const HotkeysProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [scopes, setScopes] = useState<HotkeyScope[]>([
        { id: GLOBAL_SCOPE_ID, name: 'Global', level: HOTKEY_LEVEL.GLOBAL, hotkeys: [], registrationIndex: 0 }
    ]);
    const registrationCounter = React.useRef(1);
    const scopesRef = React.useRef<HotkeyScope[]>(scopes);

    // Keep ref in sync for keydown listener
    useEffect(() => {
        scopesRef.current = scopes;
    }, [scopes]);

    const addScope = useCallback((scope: Omit<HotkeyScope, 'registrationIndex'>) => {
        setScopes(prev => {
            if (prev.find(s => s.id === scope.id)) return prev;
            
            const newScope: HotkeyScope = {
                ...scope,
                registrationIndex: registrationCounter.current++
            };

            const updated = [...prev, newScope].sort((a, b) => {
                if (a.level !== b.level) return a.level - b.level;
                return a.registrationIndex - b.registrationIndex;
            });
            
            return updated;
        });
    }, []);

    const removeScope = useCallback((id: string) => {
        if (id === GLOBAL_SCOPE_ID) return; // Never remove global scope
        setScopes(prev => prev.filter(s => s.id !== id));
    }, []);

    const addHotkeyToScope = useCallback((scopeId: string, hotkey: Hotkey) => {
        setScopes(prev => prev.map(scope => {
            if (scope.id !== scopeId) return scope;
            const updatedHotkeys = [...scope.hotkeys.filter(h => h.key.toLowerCase() !== hotkey.key.toLowerCase()), hotkey];
            return { ...scope, hotkeys: updatedHotkeys };
        }));
    }, []);

    const removeHotkeyFromScope = useCallback((scopeId: string, key: string) => {
        setScopes(prev => prev.map(scope => {
            if (scope.id !== scopeId) return scope;
            return {
                ...scope,
                hotkeys: scope.hotkeys.filter(h => h.key.toLowerCase() !== key.toLowerCase())
            };
        }));
    }, []);

    // Global Keydown Listener
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const currentScopes = scopesRef.current;
            const target = e.target as HTMLElement;
            const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;
            
            // Normalize key
            let pressedKey = e.key;
            const isMod = e.ctrlKey || e.metaKey || e.altKey;

            if (e.ctrlKey && !e.metaKey && e.key.toLowerCase() !== 'control') pressedKey = `ctrl+${e.key.toLowerCase()}`;
            if (e.metaKey && !e.ctrlKey && e.key.toLowerCase() !== 'meta') pressedKey = `cmd+${e.key.toLowerCase()}`;
            if (e.ctrlKey && e.metaKey) pressedKey = `ctrl+cmd+${e.key.toLowerCase()}`;
            
            const lowerPressedKey = pressedKey.toLowerCase();
            
            // Iterate scopes from top (priority) to bottom
            for (let i = currentScopes.length - 1; i >= 0; i--) {
                const scope = currentScopes[i];
                const matchedHotkey = scope.hotkeys.find(h => h.key.toLowerCase() === lowerPressedKey && h.enabled !== false);
                
                if (matchedHotkey) {
                    // PROTECTION RULES FOR TYPING
                    if (isTyping) {
                        // 1. Always allow Escape, F-keys even when typing
                        const isSystemKey = lowerPressedKey === 'escape' || /^f\d+$/.test(lowerPressedKey);
                        
                        // 2. Allow modifiers (Ctrl/Cmd/Alt) shortcuts
                        const hasModifier = isMod;

                        // 3. Block single character keys, Backspace, Delete, Enter, Arrows, Space
                        const isEditingKey = 
                            lowerPressedKey === 'backspace' || 
                            lowerPressedKey === 'delete' || 
                            lowerPressedKey === 'enter' || 
                            lowerPressedKey === ' ' || 
                            lowerPressedKey === 'space' ||
                            lowerPressedKey.startsWith('arrow') ||
                            lowerPressedKey === 'tab' ||
                            lowerPressedKey === 'home' ||
                            lowerPressedKey === 'end' ||
                            lowerPressedKey === 'pageup' ||
                            lowerPressedKey === 'pagedown' ||
                            (lowerPressedKey.length === 1 && !hasModifier);

                        if (isEditingKey && !isSystemKey && !hasModifier) {
                            return; // Let standard browser/input behavior work
                        }
                    }

                    if (matchedHotkey.preventDefault !== false) {
                        e.preventDefault();
                    }
                    if (matchedHotkey.stopPropagation !== false) {
                        e.stopPropagation();
                    }
                    matchedHotkey.handler(e);
                    return; // Stop processing further scopes
                }
                
                // Exclusive logic
                if (scope.exclusive) {
                    const isGlobalShortcut = 
                        /^f\d+$/.test(lowerPressedKey) || 
                        lowerPressedKey.includes('cmd+s') || 
                        lowerPressedKey.includes('ctrl+s') ||
                        lowerPressedKey === 'escape';

                    const isException = scope.exclusiveExceptions?.some(
                        exc => exc.toLowerCase() === lowerPressedKey
                    );

                    if (isGlobalShortcut && !isException) {
                        if (!isTyping || (lowerPressedKey !== 'enter' && lowerPressedKey !== 'backspace')) {
                            e.preventDefault();
                            e.stopPropagation();
                        }
                    }
                    if (!isException) {
                        return; // Stop processing further scopes
                    }
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown, { capture: true });
        return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
    }, []); // Empty deps: listener is stable and uses scopesRef

    const actions = useMemo(() => ({ 
        addScope, 
        removeScope, 
        addHotkeyToScope, 
        removeHotkeyFromScope 
    }), [addScope, removeScope, addHotkeyToScope, removeHotkeyFromScope]);

    return (
        <HotkeysActionsContext.Provider value={actions}>
            <HotkeysStateContext.Provider value={scopes}>
                {children}
            </HotkeysStateContext.Provider>
        </HotkeysActionsContext.Provider>
    );
};

