import io
import matplotlib.pyplot as plt
import matplotlib as mpl
from typing import List, Dict, Any, Union, Optional
import pandas as pd

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
    buf = io.StringIO()
    fig.savefig(buf, format='svg', bbox_inches='tight')
    plt.close(fig)
    return buf.getvalue()

def _to_df(data: Any) -> pd.DataFrame:
    """Helper to convert various input types to a DataFrame."""
    if isinstance(data, pd.DataFrame):
        return data
    if isinstance(data, list):
        return pd.DataFrame(data)
    if isinstance(data, dict):
        # If it's a dict of lists, or just a dict representing one row
        try:
            return pd.DataFrame(data)
        except:
            return pd.DataFrame([data])
    return pd.DataFrame(data)

# --- High-Level Charting Functions ---

def bar(data, x, y, title=None, color=None, theme="business") -> str:
    """Generates a professional bar chart."""
    apply_corporate_style()
    df = _to_df(data)
    
    fig, ax = plt.subplots(figsize=(8, 4))
    
    # Simple bar chart
    bars = ax.bar(df[x].astype(str), df[y], color=color or CORP_COLORS[0], width=0.6)
    
    if title:
        ax.set_title(title, pad=20)
    
    ax.set_xlabel(str(x))
    ax.set_ylabel(str(y))
    
    # Tight layout and export
    return fig_to_svg(fig)

def line(data, x, y, title=None, markers=True, theme="business") -> str:
    """Generates a professional line chart."""
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

def scatter(data, x, y, title=None, theme="business") -> str:
    """Generates a professional scatter plot."""
    apply_corporate_style()
    df = _to_df(data)
    
    fig, ax = plt.subplots(figsize=(8, 4))
    
    ax.scatter(df[x], df[y], alpha=0.6, color=CORP_COLORS[0], edgecolors='white')
    
    if title:
        ax.set_title(title, pad=20)
    
    ax.set_xlabel(str(x))
    ax.set_ylabel(str(y))
    
    return fig_to_svg(fig)
