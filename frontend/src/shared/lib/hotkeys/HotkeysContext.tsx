import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

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
    exclusive?: boolean; // If true, stops hotkey propagation down the stack
    exclusiveExceptions?: string[]; // Keys allowed to propagate even if exclusive is true
    hotkeys: Hotkey[];
}

interface HotkeysContextState {
    scopes: HotkeyScope[];
    addScope: (scope: HotkeyScope) => void;
    removeScope: (id: string) => void;
    addHotkeyToScope: (scopeId: string, hotkey: Hotkey) => void;
    removeHotkeyFromScope: (scopeId: string, key: string) => void;
}

const HotkeysContext = createContext<HotkeysContextState | undefined>(undefined);

export const useHotkeysContext = () => {
    const context = useContext(HotkeysContext);
    if (!context) {
        throw new Error('useHotkeysContext must be used within a HotkeysProvider');
    }
    return context;
};

// Global base scope ID
export const GLOBAL_SCOPE_ID = 'global';

export const HotkeysProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [scopes, setScopes] = useState<HotkeyScope[]>([
        { id: GLOBAL_SCOPE_ID, name: 'Global', hotkeys: [] }
    ]);

    const addScope = useCallback((scope: HotkeyScope) => {
        setScopes(prev => {
            if (prev.find(s => s.id === scope.id)) return prev;
            return [...prev, scope];
        });
    }, []);

    const removeScope = useCallback((id: string) => {
        if (id === GLOBAL_SCOPE_ID) return; // Never remove global scope
        setScopes(prev => prev.filter(s => s.id !== id));
    }, []);

    const addHotkeyToScope = useCallback((scopeId: string, hotkey: Hotkey) => {
        setScopes(prev => prev.map(scope => {
            if (scope.id !== scopeId) return scope;
            // Filter out existing hotkey with same key to avoid duplicates
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
            // Do not naturally intercept if we are typing in an input/textarea
            // UNLESS it's a specific global hotkey like Escape, F4, F5, F9, ctrl+s, etc.
            // Specifically, standard keys (letters) without modifiers are usually typing.
            const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName) || (e.target as HTMLElement).isContentEditable;
            
            // Normalize key
            let pressedKey = e.key;
            if (e.ctrlKey && !e.metaKey && e.key.toLowerCase() !== 'control') pressedKey = `ctrl+${e.key.toLowerCase()}`;
            if (e.metaKey && !e.ctrlKey && e.key.toLowerCase() !== 'meta') pressedKey = `cmd+${e.key.toLowerCase()}`;
            if (e.ctrlKey && e.metaKey) pressedKey = `ctrl+cmd+${e.key.toLowerCase()}`;
            
            const lowerPressedKey = pressedKey.toLowerCase();
            
            // Iterate scopes from top (most recent) to bottom
            for (let i = scopes.length - 1; i >= 0; i--) {
                const scope = scopes[i];
                const matchedHotkey = scope.hotkeys.find(h => h.key.toLowerCase() === lowerPressedKey && h.enabled !== false);
                
                if (matchedHotkey) {
                    // If we are typing and the hotkey is a standard text editing shortcut or Enter in a textarea, skip
                    if (isTyping) {
                        const isClipboardShortcut = ['cmd+c', 'ctrl+c', 'cmd+v', 'ctrl+v', 'cmd+x', 'ctrl+x', 'cmd+z', 'ctrl+z', 'cmd+a', 'ctrl+a'].includes(lowerPressedKey);
                        if (isClipboardShortcut || (lowerPressedKey === 'enter' && (e.target as HTMLElement).tagName === 'TEXTAREA')) {
                            continue; // skip this match and let standard behavior work
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
                
                // If the scope is exclusive and we didn't match, we stop propagation 
                // for commonly intercepted shortcuts to prevent parent actions
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
                        e.preventDefault();
                        e.stopPropagation();
                    }
                    if (!isException) {
                        return; // Stop processing further scopes
                    }
                }
            }
        };

        // Use capture phase to ensure we intercept before other possibly rogue listeners
        window.addEventListener('keydown', handleKeyDown, { capture: true });
        return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
    }, [scopes]);

    return (
        <HotkeysContext.Provider value={{ scopes, addScope, removeScope, addHotkeyToScope, removeHotkeyFromScope }}>
            {children}
        </HotkeysContext.Provider>
    );
};
