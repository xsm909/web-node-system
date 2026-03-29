import { usePinStore } from '../model/store';
import { useCallback } from 'react';

export const usePinnedNavigation = () => {
    const tabs = usePinStore((state) => state.tabs);
    const focus = usePinStore((state) => state.focus);

    /**
     * Checks if the entity is already pinned.
     * If so, switches focus to the pinned tab and does NOT execute the fallback.
     * If not, executes the fallback (which usually opens the entity in the navigation stack).
     */
    const openOrFocus = useCallback(
        (entityType: string, entityId: string, fallbackOpen: () => void) => {
            const id = `${entityType}:${entityId}`;
            const isPinned = tabs.some((t) => t.id === id);

            if (isPinned) {
                focus(id);
            } else {
                fallbackOpen();
            }
        },
        [tabs, focus]
    );

    return { openOrFocus };
};
