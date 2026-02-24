---
sidebar_position: 4
---

# Dashboard Templates

Templates let you create, save, reuse, and share dashboard layouts. A template captures the widgets on your dashboard — their types, positions, and sizes — so you can apply the same layout again later or share it with other users.

## Creating a Template

Go to **Settings → Dashboard → Templates**. There are three ways to create one:

- **Create New Template** — opens an empty builder wizard
- **Save Current Dashboard** — snapshots your current layout as a template
- **Import Template** — loads a `.framerr` file exported from another instance

:::note
Template creation and editing requires a desktop browser. Mobile users can view and apply templates, but the builder is desktop-only.
:::

### The Template Builder

The builder walks through three steps:

1. **Setup** — name (required), category, description, and an option to mark as the default template for new users (admin only)
2. **Build** — a visual grid editor where you add, remove, resize, and reposition widgets, as well as bind specific integrations to widgets
3. **Review** — a live preview of the template with save options

You can save at any point during the process. If you close the builder before finishing, it saves as a **draft** that you can resume later.

### Categories

Templates can be grouped into categories for organization. Admins can create and delete categories from the builder's Setup step. Categories are optional.

## Applying a Template

Click **Apply** on any template card to replace your current dashboard with that template's layout. Before applying, Framerr automatically creates a backup of your existing dashboard.

If you change your mind, use **Revert to Previous Dashboard** to restore your pre-template layout. Only one backup is stored at a time — applying another template overwrites the previous backup.

## Managing Templates

Each template card shows a preview thumbnail, name, category, and available actions:

| Action | Description |
|--------|-------------|
| **Apply** | Replace your dashboard with this template |
| **Edit** | Open the builder to modify the template |
| **Duplicate** | Create a copy you can modify independently |
| **Share / Export** | Share with users (admin) or export as `.framerr` file |
| **Delete** | Remove the template permanently |

Click a template's name to rename it inline. 

## Sharing Templates

Admins can share templates with other users, including automatic widget and integration sharing. Personal content (custom HTML, link URLs) can optionally be included per-widget. See the [Sharing](./sharing#sharing-templates) page for full details on sharing modes, sensitive data handling, and how shared copies work.

## Import & Export

Templates can be exported as `.framerr` files and imported into other Framerr instances. This works for all users, not just admins. By default, exports include only the layout structure — personal widget content can be included optionally. See the [Sharing](./sharing#widget-and-integration-sharing-from-templates) page for details on what's included.

## Shared Template Updates

When an admin updates a shared template, recipients see an **Update** badge on their copy. They can:

- **Sync** — pull the latest version from the admin, replacing their copy
- **Revert** — if they've made local edits, revert back to the original shared version

## Default Templates

Admins can mark a template as the **Default for New Users**. When a new non-admin user logs in for the first time, this template is automatically applied to their dashboard. Only one template can be the default at a time.

## Mobile Layout

Templates support independent mobile layouts. During the Build step, you can toggle between desktop and mobile views and arrange widgets differently for each. The layout mode can be:

- **Linked** — mobile layout is auto-generated from the desktop layout (auto-stacked)
- **Independent** — mobile has its own separate widget arrangement and configuration. Edits made to the mobile widgets do not affect the desktop widgets and vice versa.
