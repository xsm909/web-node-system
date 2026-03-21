import { useEffect, useId, useRef } from 'react';
import { useHotkeysContext, GLOBAL_SCOPE_ID, type Hotkey } from './HotkeysContext';

interface UseHotkeysOptions {
    scopeName?: string; // If provided, creates a new scope when the component mounts
    enabled?: boolean;  // If false, the scope and hotkeys are not registered
    exclusive?: boolean;
    exclusiveExceptions?: string[];
}

export const useHotkeys = (hotkeys: Hotkey[], options?: UseHotkeysOptions) => {
    const { addScope, removeScope, addHotkeyToScope, removeHotkeyFromScope } = useHotkeysContext();
    const componentId = useId();
    
    // Determine the scope ID to use: either a fresh one for this component, or the global one
    const scopeId = options?.scopeName ? `scope-${componentId}` : GLOBAL_SCOPE_ID;
    
    // We use refs to keep track of latest hotkeys array without causing re-registrations
    const hotkeysRef = useRef(hotkeys);
    hotkeysRef.current = hotkeys;

    useEffect(() => {
        const isEnabled = options?.enabled !== false;
        
        if (!isEnabled) return;

        // If a new scope is requested, register it first
        if (options?.scopeName) {
            addScope({
                id: scopeId,
                name: options.scopeName,
                exclusive: options.exclusive,
                exclusiveExceptions: options.exclusiveExceptions,
                hotkeys: []
            });
        }

        return () => {
            if (options?.scopeName) {
                // If we created a scope, just remove the whole scope
                removeScope(scopeId);
            } else {
                // Otherwise, individually remove the hotkeys from global scope
                hotkeysRef.current.forEach(hk => {
                    removeHotkeyFromScope(scopeId, hk.key);
                });
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [addScope, removeScope, addHotkeyToScope, removeHotkeyFromScope, scopeId, options?.scopeName, options?.enabled]); // intentional: run once on mount or when scope setup/enabled changes

    const hotkeysStringified = JSON.stringify(hotkeys.map(hk => ({
        key: hk.key,
        enabled: hk.enabled,
        description: hk.description
    })));

    useEffect(() => {
        if (options?.enabled === false) return;

        hotkeysRef.current.forEach(hk => {
            const wrappedHotkey: Hotkey = {
                key: hk.key,
                get description() { return hotkeysRef.current.find(h => h.key.toLowerCase() === hk.key.toLowerCase())?.description || hk.description; },
                get preventDefault() { return hotkeysRef.current.find(h => h.key.toLowerCase() === hk.key.toLowerCase())?.preventDefault; },
                get stopPropagation() { return hotkeysRef.current.find(h => h.key.toLowerCase() === hk.key.toLowerCase())?.stopPropagation; },
                get enabled() { return hotkeysRef.current.find(h => h.key.toLowerCase() === hk.key.toLowerCase())?.enabled; },
                handler: (e) => {
                    const latestHk = hotkeysRef.current.find(h => h.key.toLowerCase() === hk.key.toLowerCase());
                    if (latestHk && latestHk.enabled !== false) {
                        latestHk.handler(e);
                    }
                }
            };
            addHotkeyToScope(scopeId, wrappedHotkey);
        });
    }, [hotkeysStringified, scopeId, options?.enabled, addHotkeyToScope]);
};
