import { create } from 'zustand';
import type { Node, Edge, XYPosition } from 'reactflow';

interface ClipboardState {
    nodes: Node[];
    edges: Edge[];
    center: XYPosition;
    setClipboard: (nodes: Node[], edges: Edge[], center: XYPosition) => void;
    clearClipboard: () => void;
}

export const useClipboardStore = create<ClipboardState>((set) => ({
    nodes: [],
    edges: [],
    center: { x: 0, y: 0 },
    setClipboard: (nodes, edges, center) => set({ nodes, edges, center }),
    clearClipboard: () => set({ nodes: [], edges: [], center: { x: 0, y: 0 } }),
}));
