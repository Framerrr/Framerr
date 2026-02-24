---
sidebar_position: 3
---

# CSS Variables Reference

Framerr's theming system exposes CSS custom properties (variables) that adapt to the user's selected theme. Use these in the **Custom HTML widget** or any custom styling to ensure your content matches the dashboard's look and feel.

## Usage

Reference any variable with `var()` in your CSS:

```html
<style>
  .my-card {
    background: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 16px;
  }
  .my-card .label {
    color: var(--text-secondary);
    font-size: 0.85rem;
  }
  .my-card .value {
    color: var(--accent);
    font-size: 1.5rem;
    font-weight: bold;
  }
</style>

<div class="my-card">
  <div class="label">Server Uptime</div>
  <div class="value">99.9%</div>
</div>
```

This card automatically adapts to any theme — dark, light, or custom — without hardcoding colors.

---

## Backgrounds

| Variable | Purpose | Example (Dark Pro) |
|----------|---------|-------------------|
| `--bg-primary` | Page background | `#0a0e1a` |
| `--bg-secondary` | Card/panel surfaces | `#151922` |
| `--bg-tertiary` | Inputs, buttons, elevated elements | `#1f2937` |
| `--bg-hover` | Hover state for interactive elements | `#374151` |
| `--bg-overlay` | Floating elements (toasts, dropdowns) | `#1a2030` |

## Text

| Variable | Purpose | Example (Dark Pro) |
|----------|---------|-------------------|
| `--text-primary` | Headings and body text | `#f1f5f9` |
| `--text-secondary` | Labels, descriptions, secondary info | `#94a3b8` |
| `--text-tertiary` | Hints, timestamps, muted content | `#64748b` |

## Accent Colors

| Variable | Purpose | Example (Dark Pro) |
|----------|---------|-------------------|
| `--accent` | Primary accent — buttons, links, active states | `#3b82f6` |
| `--accent-hover` | Accent hover state | `#2563eb` |
| `--accent-light` | Light accent for subtle highlights | `#60a5fa` |
| `--accent-secondary` | Secondary accent color | `#06b6d4` |

## Borders

| Variable | Purpose | Example (Dark Pro) |
|----------|---------|-------------------|
| `--border` | Standard dividers and outlines | `#374151` |
| `--border-light` | Subtle separators | `#1f2937` |
| `--border-accent` | Accent-colored borders | `rgba(59, 130, 246, 0.3)` |

## Status Colors

Status colors are consistent across most themes.

| Variable | Purpose | Example |
|----------|---------|---------|
| `--success` | Completed, online, healthy | `#10b981` |
| `--warning` | Caution, in-progress | `#f59e0b` |
| `--error` | Errors, offline, destructive | `#ef4444` |
| `--info` | Informational messages | `#3b82f6` |

## Shadows

| Variable | Purpose |
|----------|---------|
| `--shadow-sm` | Small, subtle shadow |
| `--shadow-md` | Medium card shadow |
| `--shadow-lg` | Large elevated shadow |
| `--shadow-xl` | Extra-large shadow |
| `--shadow-card` | Default widget card shadow |
| `--shadow-glow` | Accent-colored glow effect |

## Gradients

| Variable | Purpose |
|----------|---------|
| `--gradient-primary` | Accent gradient (e.g., `linear-gradient(135deg, #3b82f6, #06b6d4)`) |
| `--gradient-primary-soft` | Subtle version with low opacity |
| `--gradient-card-hover` | Card hover highlight |
| `--gradient-text` | For gradient text effects |

## Glassmorphism

These power the frosted-glass effect used throughout Framerr. Disabled when the user enables **Flatten UI**.

| Variable | Purpose |
|----------|---------|
| `--glass-start` | Glass gradient start color |
| `--glass-end` | Glass gradient end color |
| `--glass-bg` | Glass overlay background |
| `--border-glass` | Glass panel border |

## Typography & Layout

These are defined globally and do not change per theme.

| Variable | Value |
|----------|-------|
| `--font-primary` | System font stack (`-apple-system, 'Segoe UI', 'Inter', sans-serif`) |
| `--font-mono` | Monospace font stack (`'Fira Code', 'SF Mono', monospace`) |
| `--transition-fast` | `150ms ease` |
| `--transition-base` | `200ms ease` |
| `--transition-slow` | `300ms ease` |

---

## Available Themes

Each built-in theme defines its own values for all variables above:

| Theme | Style |
|-------|-------|
| **Dark Pro** | Deep slate with blue accents (default) |
| **Light** | Clean white with blue accents |
| **Nord** | Arctic color palette |
| **Catppuccin** | Mocha-flavored pastels |
| **Dracula** | Purple and pink accents |
| **Noir** | True black with silver steel |
| **Nebula** | Cosmic purple with cyan |
| **Custom** | User-defined colors |

When a user selects **Custom** theme, their chosen colors override the core variables. Your Custom HTML widget automatically adapts.

---

## Tips

- **Always use variables** instead of hardcoded colors — your content will look correct in every theme, including custom user themes.
- **Use `--bg-secondary`** as your card background, not `--bg-primary` — primary is the page background behind everything.
- **Status colors** (`--success`, `--warning`, `--error`, `--info`) are the safest for semantic coloring since they stay consistent across themes.
- **Test in Light theme** — if your custom HTML looks good in both Dark Pro and Light, it will work everywhere.
