declare module '@json-editor/json-editor' {
    export class JSONEditor {
        constructor(element: HTMLElement, options: any);
        on(event: string, callback: () => void): void;
        off(event: string, callback: () => void): void;
        getValue(): any;
        setValue(value: any): void;
        validate(): any[];
        destroy(): void;
        disable(): void;
        enable(): void;
    }
}
