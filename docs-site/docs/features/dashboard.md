---
sidebar_position: 1
---

# Dashboard

The dashboard is the main screen you see after logging in. It's a responsive grid of widgets — each one connected to an integration or displaying standalone content like clocks, weather, or custom HTML.

## Layout Grid

Framerr uses a responsive 24-column grid on desktop that collapses to 4 columns on mobile. Widgets snap to the grid and can be resized and repositioned freely in edit mode.

The grid adapts automatically when the browser resizes. On mobile, widgets stack vertically by default unless you've configured an independent mobile layout.

## Edit Mode

Click the **pencil icon** in the dashboard header (or swipe up on the mobile tab bar) to enter edit mode. A floating toolbar appears with:

| Control | Action |
|---------|--------|
| **Cancel** | Discard all changes and exit edit mode |
| **Undo / Redo** | Step through your edit history |
| **Layout Status** | Shows whether mobile is linked or independent |
| **Add** | Open the Widget Catalog to add new widgets |
| **Save** | Persist your layout changes |

While in edit mode:

- **Drag** widgets to rearrange them (long-press to drag on mobile)
- **Resize** using the handle in the bottom-right corner of each widget
- **Configure** a widget by clicking the gear icon on its card
- **Duplicate** or **delete** widgets from the card's action menu

Changes are not saved until you click **Save**. Closing edit mode without saving discards all edits.

### Adding Widgets

Click **Add** in the edit toolbar to open the Widget Catalog. The catalog shows all widget types you have access to. Select a widget to add it to your dashboard — it will appear at the top of the grid. Optionally, drag widget cards directly from the catalog to the grid. 

- Each widget can be configured after adding it
- Click the gear icon on the widget card to open its configuration menu
- Choose from three options: 
    - **Edit** - Edit the widget's title, bound integration, and widget-specific options
    - **Resize** - Manually resize/reposition the widget
    - **Delete** - Delete the widget

## Mobile Layout

Framerr maintains separate layouts for desktop and mobile. By default, the two are **linked** — changes on desktop automatically update the mobile layout and all widget configurations are shared. If you rearrange widgets on mobile while in edit mode, the layout **unlinks** and becomes independent.

:::tip
Changing widget configurations (integrations, widget specific configuration, etc.) will **not** unlink desktop and mobile layouts. Resizing, moving, or adding/removing widgets from mobile **will** unlink the layouts.
:::

| Mode | Behavior |
|------|----------|
| **Linked** | Mobile layout auto-generates from desktop |
| **Independent** | Mobile has its own widget arrangement. Desktop and mobile edits don't affect each other |

The current mode is shown in the edit toolbar. If you're in independent mode and want to resync, click **Relink** in the edit toolbar, or go to **Settings → Dashboard → General → Mobile → Reconnect to Desktop**.

:::caution
Reconnecting replaces your custom mobile layout with the current desktop layout. Any mobile-only specific widgets will be removed.
:::

### Hide Mobile Edit Button

If you prefer a cleaner mobile interface, you can hide the edit button from **Settings → Dashboard → General → Mobile**. You can still enter edit mode by swiping up on the bottom tab bar and pressing "Edit Dashboard".

## Header & Greeting

The dashboard header displays a greeting and an optional tagline. Both are configured in **Settings → Customization**.

**Greeting modes:**

- **Auto** — Framerr displays a greeting based on factors like time of day and day of week. You can customize the tone (casual, playful, motivational, etc.) from the available options.
- **Custom** — Set your own greeting text
- **Hidden** — Disable the header entirely for a full-height widget-only view

**Tagline:** An optional subtitle below the greeting. Set any text you like, or leave it disabled.

## Dashboard Settings

Dashboard management options are found in **Settings → Dashboard → General**:

| Setting | Description |
|---------|-------------|
| **Reset Dashboard** | Remove all widgets from both desktop and mobile layouts. Cannot be undone |
| **Reset Welcome Tour** | Replay the onboarding walkthrough on your next dashboard visit |
| **Auto-hide Sidebar** | Collapse the sidebar to maximize dashboard space. Hover, peek, and click the sidebar, or swipe to the left edge to reveal it |
| **Square Cells** *(experimental)* | Make grid cell height match width, creating square proportions that scale with window size. Not all widgets internal layouts support this option. |
| **Mobile Layout** | View current link status and reconnect if independent |
| **Hide Mobile Edit Button** | Remove the edit button from the mobile dashboard |

## Templates

Dashboard layouts can be saved as reusable templates and shared with other users. See the [Dashboard Templates](./templates) page for details.
