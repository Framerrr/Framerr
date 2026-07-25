---
sidebar_position: 1
---

# Dashboard

The dashboard is the main screen you see after logging in — a grid of widgets
tied to your integrations, plus things like clocks, weather, or custom HTML.

You're not limited to one. Create as many dashboards as you need, each with
its own widgets and layout. Your theme, sidebar, and greeting stay consistent
across all of them.

## Multiple Dashboards

Different setups for different jobs — media on one, downloads on another,
a spare for experimenting. Each dashboard keeps its own widgets and layouts.

### Switching Dashboards

- **Desktop:** In the sidebar, hover the current dashboard name and click the
  dropdown to open the list of dashboards or to create a new one.
- **Mobile:** Press and hold the dashboard button on the bottom tab bar, then
  choose a dashboard or create a new one. You can rearrange that bar in
  [Mobile Tab Bar](../customization/mobile-tab-bar).

### Creating a New Dashboard

From the switcher, or from **Settings → Dashboard → General**, start with:

- A blank dashboard
- A copy of the one you're on
- A saved template

### Home

**Home** is the dashboard Framerr opens to. Set any dashboard as Home from
Settings. Turn on **Remember last dashboard** if you'd rather return to the
one you used last.

### Manage Dashboards

Under **Settings → Dashboard → General** you can rename dashboards, set icons,
choose Home, or delete ones you no longer need.

Resetting widgets only clears the dashboard you're currently on.

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
| **Reset Dashboard** | Clear all widgets on the dashboard you're currently on. Cannot be undone |
| **Reset Welcome Tour** | Replay the onboarding walkthrough on your next dashboard visit |
| **Auto-hide Sidebar** | Collapse the sidebar to maximize dashboard space. Hover, peek, and click the sidebar, or swipe to the left edge to reveal it |
| **Fixed Display Mode** *(experimental, per dashboard)* | Full-width layout with square cells and no size limits — useful for a dedicated display; other dashboards stay normal. Widget sizing and content are not optimized and may behave oddly |
| **Mobile Layout** | View current link status and reconnect if independent |
| **Hide Mobile Edit Button** | Remove the edit button from the mobile dashboard |

:::note
**Fixed Display Mode** (experimental) is set per dashboard. It makes that dashboard full-width with square cells and no size limits — useful for a dedicated display — while other dashboards stay normal. Turning it off restores normal sizing rules; existing widgets keep their size until you next resize them. Widget sizing and content are not optimized for this mode and may behave oddly.
:::

## Templates

Dashboard layouts can be saved as reusable templates and shared with other users. See the [Dashboard Templates](./templates) page for details.
