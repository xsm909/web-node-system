import { createPortal } from 'react-dom';
import { type ReactNode, useEffect, useState } from 'react';

interface AppPortalProps {
    children: ReactNode;
    /** Optional target container ID. Defaults to document.body */
    containerId?: string;
}

/**
 * Standard Portal component to render children outside the current DOM hierarchy.
 * Essential for tooltips, modals, and popovers to avoid overflow clipping.
 */
export const AppPortal = ({ children, containerId }: AppPortalProps) => {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    if (!mounted) return null;

    const target = containerId ? document.getElementById(containerId) : document.body;
    if (!target) return null;

    return createPortal(children, target);
};
