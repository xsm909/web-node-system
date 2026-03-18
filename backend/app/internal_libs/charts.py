import io
from typing import List, Dict, Any, Union, Optional

# Try to import heavy dependencies
try:
    import matplotlib.pyplot as plt
    import matplotlib as mpl
    mpl.use('Agg') # Use non-interactive backend
    import pandas as pd
    import numpy as np
    CHART_LIBS_INSTALLED = True
except Exception as e:
    # Catch any exception to prevent backend crash
    print(f"WARNING: Charts library disabled. Reason: {e}")
    CHART_LIBS_INSTALLED = False

# --- Standard Corporate Theme Configuration ---
CORP_COLORS = [
    '#3b82f6', # Blue 500
    '#f43f5e', # Rose 500
    '#10b981', # Emerald 500
    '#f59e0b', # Amber 500
    '#8b5cf6', # Violet 500
    '#06b6d4', # Cyan 500
    '#64748b', # Slate 500
]

def apply_corporate_style():
    """Applies a clean, modern business style to Matplotlib."""
    if not CHART_LIBS_INSTALLED:
        return
    plt.style.use('bmh') # Base style
    mpl.rcParams['axes.facecolor'] = 'white'
    mpl.rcParams['figure.facecolor'] = 'white'
    mpl.rcParams['axes.edgecolor'] = '#e2e8f0' # Slate 200
    mpl.rcParams['axes.grid'] = True
    mpl.rcParams['grid.alpha'] = 0.3
    mpl.rcParams['grid.color'] = '#cbd5e1' # Slate 300
    mpl.rcParams['axes.labelcolor'] = '#1e293b' # Slate 800
    mpl.rcParams['xtick.color'] = '#64748b' # Slate 500
    mpl.rcParams['ytick.color'] = '#64748b'
    mpl.rcParams['axes.spines.top'] = False
    mpl.rcParams['axes.spines.right'] = False
    mpl.rcParams['font.size'] = 10
    mpl.rcParams['axes.titlesize'] = 12
    mpl.rcParams['axes.titleweight'] = 'bold'
    mpl.rcParams['axes.prop_cycle'] = mpl.cycler(color=CORP_COLORS)

def fig_to_svg(fig) -> str:
    """Converts a Matplotlib figure to a sanitized SVG string."""
    if not CHART_LIBS_INSTALLED:
        return ""
    buf = io.StringIO()
    fig.savefig(buf, format='svg', bbox_inches='tight')
    plt.close(fig)
    return buf.getvalue()

def _to_df(data: Any) -> Any:
    """Helper to convert various input types to a DataFrame if pandas is available."""
    if not CHART_LIBS_INSTALLED:
        return data
        
    if isinstance(data, pd.DataFrame):
        return data
    if isinstance(data, list):
        return pd.DataFrame(data)
    if isinstance(data, dict):
        try:
            return pd.DataFrame(data)
        except:
            return pd.DataFrame([data])
    return pd.DataFrame(data)

def _get_error_svg(msg: str) -> str:
    """Returns a simple SVG with an error message."""
    return f"""<svg width="400" height="100" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#fee2e2" />
        <text x="50%" y="50%" font-family="sans-serif" font-size="12" fill="#b91c1c" text-anchor="middle" dominant-baseline="middle">
            {msg}
        </text>
    </svg>"""

# --- High-Level Charting Functions ---

def bar(data, x, y, title=None, color=None, stacked=False, theme="business") -> str:
    """Generates a professional vertical bar chart. y can be a single column or a list."""
    if not CHART_LIBS_INSTALLED:
        return _get_error_svg("Libraries 'matplotlib' or 'pandas' are not installed.")
        
    apply_corporate_style()
    df = _to_df(data)
    y_cols = [y] if isinstance(y, str) else y
    
    fig, ax = plt.subplots(figsize=(8, 4))
    
    if stacked and len(y_cols) > 1:
        bottom = None
        for i, col in enumerate(y_cols):
            ax.bar(df[x].astype(str), df[col], label=col, bottom=bottom)
            if bottom is None:
                bottom = df[col].copy()
            else:
                bottom += df[col]
        ax.legend()
    else:
        for i, col in enumerate(y_cols):
            # If multiple but not stacked, they will overlap; use grouped bars in future or just first
            ax.bar(df[x].astype(str), df[col], label=col if len(y_cols)>1 else None, 
                   color=color if len(y_cols)==1 else None)
        if len(y_cols) > 1: ax.legend()
    
    if title: ax.set_title(title, pad=20)
    ax.set_xlabel(str(x))
    ax.set_ylabel(str(y_cols[0]) if len(y_cols)==1 else "Value")
    
    return fig_to_svg(fig)

def barh(data, x, y, title=None, color=None, stacked=False, theme="business") -> str:
    """Generates a professional horizontal bar chart."""
    if not CHART_LIBS_INSTALLED:
        return _get_error_svg("Libraries 'matplotlib' or 'pandas' are not installed.")
        
    apply_corporate_style()
    df = _to_df(data)
    y_cols = [y] if isinstance(y, str) else y
    
    h = max(4, len(df) * 0.4)
    fig, ax = plt.subplots(figsize=(8, h))
    
    if stacked and len(y_cols) > 1:
        left = None
        for i, col in enumerate(y_cols):
            ax.barh(df[x].astype(str), df[col], label=col, left=left)
            if left is None:
                left = df[col].copy()
            else:
                left += df[col]
        ax.legend()
    else:
        for i, col in enumerate(y_cols):
            ax.barh(df[x].astype(str), df[col], label=col if len(y_cols)>1 else None,
                    color=color if len(y_cols)==1 else None)
        if len(y_cols) > 1: ax.legend()
    
    if title: ax.set_title(title, pad=20)
    ax.set_xlabel(str(y_cols[0]) if len(y_cols)==1 else "Value")
    ax.set_ylabel(str(x))
    ax.invert_yaxis()
    
    return fig_to_svg(fig)

def area(data, x, y, title=None, stacked=False, theme="business") -> str:
    """Generates a professional area chart."""
    if not CHART_LIBS_INSTALLED:
        return _get_error_svg("Libraries 'matplotlib' or 'pandas' are not installed.")
        
    apply_corporate_style()
    df = _to_df(data)
    y_cols = [y] if isinstance(y, str) else y
    
    fig, ax = plt.subplots(figsize=(8, 4))
    
    if stacked and len(y_cols) > 1:
        ax.stackplot(df[x].astype(str), [df[c] for c in y_cols], labels=y_cols, alpha=0.8)
        ax.legend()
    else:
        for i, col in enumerate(y_cols):
            ax.fill_between(df[x].astype(str), df[col], alpha=0.3, color=CORP_COLORS[i % len(CORP_COLORS)])
            ax.plot(df[x].astype(str), df[col], color=CORP_COLORS[i % len(CORP_COLORS)], label=col if len(y_cols)>1 else None)
        if len(y_cols) > 1: ax.legend()
        
    if title: ax.set_title(title, pad=20)
    ax.set_xlabel(str(x))
    return fig_to_svg(fig)

def histogram(data, col, bins=20, title=None, theme="business") -> str:
    """Generates a distribution histogram."""
    if not CHART_LIBS_INSTALLED:
        return _get_error_svg("Libraries 'matplotlib' or 'pandas' are not installed.")
        
    apply_corporate_style()
    df = _to_df(data)
    
    fig, ax = plt.subplots(figsize=(8, 4))
    ax.hist(df[col].dropna(), bins=bins, color=CORP_COLORS[0], edgecolor='white', alpha=0.8)
    
    if title: ax.set_title(title, pad=20)
    ax.set_xlabel(str(col))
    ax.set_ylabel("Frequency")
    return fig_to_svg(fig)

def line(data, x, y, title=None, markers=True, theme="business") -> str:
    """Generates a professional line chart."""
    if not CHART_LIBS_INSTALLED:
        return _get_error_svg("Libraries 'matplotlib' or 'pandas' are not installed.")

    apply_corporate_style()
    df = _to_df(data)
    
    fig, ax = plt.subplots(figsize=(8, 4))
    
    ax.plot(df[x].astype(str), df[y], marker='o' if markers else None, 
            linewidth=2, color=CORP_COLORS[0])
    
    if title:
        ax.set_title(title, pad=20)
    
    ax.set_xlabel(str(x))
    ax.set_ylabel(str(y))
    
    return fig_to_svg(fig)

def pie(data, labels, values, title=None, theme="business") -> str:
    """Generates a professional pie chart."""
    if not CHART_LIBS_INSTALLED:
        return _get_error_svg("Libraries 'matplotlib' or 'pandas' are not installed.")

    apply_corporate_style()
    df = _to_df(data)
    
    fig, ax = plt.subplots(figsize=(6, 6))
    
    patches, texts, autotexts = ax.pie(
        df[values], 
        labels=df[labels].astype(str), 
        autopct='%1.1f%%',
        colors=CORP_COLORS,
        startangle=140,
        pctdistance=0.85
    )
    
    # Make a donut
    centre_circle = plt.Circle((0,0), 0.70, fc='white')
    fig.gca().add_artist(centre_circle)
    
    if title:
        ax.set_title(title, pad=20)
    
    plt.tight_layout()
    return fig_to_svg(fig)

def radar(data, labels, values, title=None, theme="business") -> str:
    """Generates a professional radar (spider) chart."""
    if not CHART_LIBS_INSTALLED:
        return _get_error_svg("Libraries 'matplotlib' or 'pandas' are not installed.")
        
    apply_corporate_style()
    df = _to_df(data)
    
    categories = df[labels].astype(str).tolist()
    N = len(categories)
    
    angles = [n / float(N) * 2 * np.pi for n in range(N)]
    # Close the loop safely
    angles.append(angles[0])
    
    fig, ax = plt.subplots(figsize=(6, 6), subplot_kw=dict(polar=True))
    
    val_cols = [values] if isinstance(values, str) else values
    
    for i, col in enumerate(val_cols):
        vals = df[col].values.flatten().tolist()
        vals.append(vals[0]) # Close the loop
        ax.plot(angles, vals, linewidth=2, linestyle='solid', label=col if len(val_cols)>1 else None)
        ax.fill(angles, vals, alpha=0.1)
        
    ax.set_theta_offset(np.pi / 2)
    ax.set_theta_direction(-1)
    plt.xticks(angles[:-1], categories)
    
    if title: ax.set_title(title, pad=30)
    if len(val_cols) > 1: ax.legend(loc='upper right', bbox_to_anchor=(0.1, 0.1))
    
    return fig_to_svg(fig)

def heatmap(data, x, y, values, title=None, theme="business") -> str:
    """Generates a correlation or density heatmap."""
    if not CHART_LIBS_INSTALLED:
        return _get_error_svg("Libraries 'matplotlib' or 'pandas' are not installed.")
        
    apply_corporate_style()
    df = _to_df(data)
    
    pivot = df.pivot(index=y, columns=x, values=values)
    
    fig, ax = plt.subplots(figsize=(8, 6))
    im = ax.imshow(pivot, cmap='Blues')
    
    ax.set_xticks(np.arange(len(pivot.columns)))
    ax.set_yticks(np.arange(len(pivot.index)))
    ax.set_xticklabels(pivot.columns)
    ax.set_yticklabels(pivot.index)
    
    plt.setp(ax.get_xticklabels(), rotation=45, ha="right", rotation_mode="anchor")
    
    for i in range(len(pivot.index)):
        for j in range(len(pivot.columns)):
            ax.text(j, i, pivot.iloc[i, j], ha="center", va="center", color="black")
            
    if title: ax.set_title(title, pad=20)
    fig.colorbar(im, ax=ax)
    plt.tight_layout()
    return fig_to_svg(fig)

def boxplot(data, y, x=None, title=None) -> str:
    """Generates a statistical boxplot."""
    if not CHART_LIBS_INSTALLED:
        return _get_error_svg("Libraries 'matplotlib' or 'pandas' are not installed.")
        
    apply_corporate_style()
    df = _to_df(data)
    
    fig, ax = plt.subplots(figsize=(8, 4))
    
    if x:
        groups = df[x].unique()
        plot_data = [df[df[x] == g][y].dropna() for g in groups]
        ax.boxplot(plot_data, labels=groups)
        ax.set_xlabel(str(x))
    else:
        y_cols = [y] if isinstance(y, str) else y
        ax.boxplot([df[c].dropna() for c in y_cols], labels=y_cols)
        
    if title: ax.set_title(title, pad=20)
    ax.set_ylabel(str(y) if isinstance(y, str) else "Value")
    return fig_to_svg(fig)

def scatter(data, x, y, size=None, title=None) -> str:
    """Generates a professional scatter/bubble plot."""
    if not CHART_LIBS_INSTALLED:
        return _get_error_svg("Libraries 'matplotlib' or 'pandas' are not installed.")
    apply_corporate_style()
    df = _to_df(data)
    
    fig, ax = plt.subplots(figsize=(8, 4))
    
    if size and size in df.columns:
        # Scale relative size, ensure we don't divide by zero
        s_max = df[size].max()
        s = (df[size] / s_max * 500) if s_max > 0 else 50
    else:
        s = 50
    
    ax.scatter(df[x], df[y], s=s, alpha=0.6, color=CORP_COLORS[0], edgecolors='white')
    
    if title: ax.set_title(title, pad=20)
    ax.set_xlabel(str(x))
    ax.set_ylabel(str(y))
    return fig_to_svg(fig)

def waterfall(data, labels, values, title=None) -> str:
    """Generates a waterfall chart."""
    if not CHART_LIBS_INSTALLED:
        return _get_error_svg("Libraries 'matplotlib' or 'pandas' are not installed.")
    apply_corporate_style()
    df = _to_df(data)
    
    net = df[values].values
    running_total = np.cumsum(net)
    base = np.zeros(len(net))
    base[1:] = running_total[:-1]
    
    fig, ax = plt.subplots(figsize=(8, 5))
    colors = ['#10b981' if x >= 0 else '#f43f5e' for x in net]
    ax.bar(df[labels].astype(str), net, bottom=base, color=colors)
    
    for i in range(len(net) - 1):
        ax.plot([i, i + 1], [running_total[i], running_total[i]], color='#94a3b8', ls='--', lw=1)
        
    if title: ax.set_title(title, pad=20)
    return fig_to_svg(fig)

def gauge(value, title=None, min_val=0, max_val=100) -> str:
    """Generates a semi-circular gauge using a pie chart trick."""
    if not CHART_LIBS_INSTALLED:
        return _get_error_svg("Libraries 'matplotlib' or 'pandas' are not installed.")
    apply_corporate_style()
    
    # We use a pie chart where the bottom half (180 degrees) is white/hidden
    # Top half represents the range [min_val, max_val]
    val_norm = max(0, min(1, (value - min_val) / (max_val - min_val)))
    
    fig, ax = plt.subplots(figsize=(6, 3))
    
    # Pie slices: [Current Value, Remaining to Max, Bottom half (hidden)]
    sizes = [val_norm * 180, (1 - val_norm) * 180, 180]
    colors = [CORP_COLORS[0], '#f1f5f9', 'white']
    
    ax.pie(sizes, colors=colors, startangle=180, counterclock=True)
    
    # Donut hole
    centre_circle = plt.Circle((0,0), 0.75, fc='white')
    ax.add_artist(centre_circle)
    
    ax.axis('equal')
    if title: ax.text(0, -0.1, f"{title}: {value}", ha='center', va='top', fontsize=12, fontweight='bold')
    
    return fig_to_svg(fig)

def funnel(data, labels, values, title=None) -> str:
    """Generates a funnel chart."""
    if not CHART_LIBS_INSTALLED:
        return _get_error_svg("Libraries 'matplotlib' or 'pandas' are not installed.")
    apply_corporate_style()
    df = _to_df(data).sort_values(values, ascending=False)
    
    fig, ax = plt.subplots(figsize=(8, 6))
    y = np.arange(len(df))
    widths = df[values].values
    offset = (widths.max() - widths) / 2
    
    ax.barh(y, widths, left=offset, color=CORP_COLORS, height=0.8)
    ax.set_yticks(y)
    ax.set_yticklabels(df[labels].astype(str))
    ax.invert_yaxis()
    ax.axis('off')
    
    for i, val in enumerate(widths):
        ax.text(widths.max()/2, i, f"{val}", ha='center', va='center', color='white', weight='bold')
    if title: ax.set_title(title, pad=20)
    return fig_to_svg(fig)

def gantt(data, task, start, end, title=None) -> str:
    """Generates a Gantt chart."""
    if not CHART_LIBS_INSTALLED:
        return _get_error_svg("Libraries 'matplotlib' or 'pandas' are not installed.")
    apply_corporate_style()
    df = _to_df(data)
    df[start] = pd.to_datetime(df[start])
    df[end] = pd.to_datetime(df[end])
    df['dur'] = (df[end] - df[start]).dt.days
    
    fig, ax = plt.subplots(figsize=(10, 5))
    ax.barh(df[task].astype(str), df['dur'], left=df[start], color=CORP_COLORS[0])
    ax.invert_yaxis()
    if title: ax.set_title(title, pad=20)
    return fig_to_svg(fig)

def violin(data, y, x=None, title=None) -> str:
    """Generates a violin plot."""
    if not CHART_LIBS_INSTALLED:
        return _get_error_svg("Libraries 'matplotlib' or 'pandas' are not installed.")
    apply_corporate_style()
    df = _to_df(data)
    fig, ax = plt.subplots(figsize=(8, 4))
    
    if x:
        groups = df[x].unique()
        plot_data = [df[df[x] == g][y].dropna() for g in groups]
        parts = ax.violinplot(plot_data, showmedians=True)
        ax.set_xticks(range(1, len(groups)+1))
        ax.set_xticklabels(groups)
    else:
        parts = ax.violinplot(df[y].dropna(), showmedians=True)
        
    for pc in parts['bodies']:
        pc.set_facecolor(CORP_COLORS[0])
        pc.set_edgecolor('black')
    if title: ax.set_title(title, pad=20)
    return fig_to_svg(fig)
