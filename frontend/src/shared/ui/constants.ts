/**
 * Standard heights for UI elements to ensure consistency across the platform.
 */
export const UI_CONSTANTS = {
    /** Standard height for input fields, selects, and buttons in forms. */
    FORM_CONTROL_HEIGHT: 'h-[28px]',

    /** Numeric height in pixels for calculations (e.g. for absolute positioning). */
    FORM_CONTROL_HEIGHT_PX: 32,

    /** Vertical padding for form controls when not using fixed height. */
    FORM_CONTROL_PY: 'py-0.5',

    /** Horizontal padding for form controls. */
    FORM_CONTROL_PX: 'px-3',

    /** Debug background color to identify elements using constants. Change to 'bg-red-500/20' for testing. 
     * or bg-transparent
    */
    DEBUG_BG: 'bg-transparent',

    /** Default brand color (Strictly Neutral Gray / Neutral 600) */
    BRAND: '#4a435aff',
    /** Default brand hover color (Neutral 700) */
    BRAND_HOVER: '#404040',
    /** Default brand color for dark mode (Neutral 400) */
    BRAND_DARK: '#a3a3a3',
    /** Default brand hover color for dark mode (Neutral 300) */
    BRAND_HOVER_DARK: '#d4d4d4ff',

    /** Standard class for code editors to ensure consistent font and size. */
    CODE_EDITOR_CLASS: 'font-mono text-[13px] leading-relaxed',

    /** Table: Vertical padding for headers. */
    TABLE_HEADER_PY: 'py-1.5',
    /** Table: Vertical padding for standard rows. */
    TABLE_ROW_PY: 'py-1',
    /** Table: Horizontal padding for cells. */
    TABLE_CELL_PX: 'px-4',
    /** Table: Standard font class for data cells (thin and compact). */
    TABLE_FONT_CLASS: 'text-[13px] font-light leading-snug',
};
