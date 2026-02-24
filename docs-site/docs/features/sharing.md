---
sidebar_position: 3
---

# Sharing

Framerr's sharing system lets admins control what non-admin users can see. Widgets, integrations, dashboard templates, and service monitors can all be shared individually or in bulk.

Sharing is admin-only. Non-admin users see only what has been shared with them.

## How It Works

Sharing operates on two levels:

1. **Widget access** — which widget *types* a user can see (e.g., Sonarr, Calendar, Downloads)
2. **Integration access** — which integration *instances* a user can use within those widgets

A user needs both. If you share the Sonarr widget with someone but don't share any Sonarr integration instances, the widget won't have data to show.

:::tip
When sharing widgets, Framerr shows you which integrations are compatible and lets you assign them per-user in the same interface.
:::

## Sharing Widgets

1. Go to **Settings → Integrations → Widget Gallery**
2. Click the **Share** button on the widget type you would like to share
3. Select the user(s) or user group(s) you would like to share the widget with
4. For each user, select which integration instances to share with the widget
5. Click **Save Changes**
6. Shared widgets will now appear in the Widget Gallery for the selected users
7. You can manage shared widgets at any time from the Widget Gallery or the Shared Widgets page (Settings → Integrations → Shared Widgets)

### Group Controls

If you've set up [user groups](../configuration/multi-user#user-groups), the sharing interface groups users accordingly. You can:

- **Toggle an entire group** — checks/unchecks all members at once
- **Set integrations for a group** — applies the same integration selection to all group members
- **Override per-user** — expand the group to adjust individual users

### Revoking Access

- **Per-widget**: Click the **Revoke All** button on a widget's card header to remove all shares for that widget, or expand the widget card to remove shares for individual user(s) or group(s)
- **Global**: Use the **Revoke All Shares** button at the top of the Shared Widgets page to clear *everything* — all widget and integration shares across all users

## Sharing Templates

Dashboard templates can be shared when creating or editing them.

1. Go to **Settings → Dashboard → Templates**
2. Create or edit a template
3. Use the **Sharing** dropdown to set visibility:

| Mode | Effect |
|------|--------|
| **Not Shared** | Only the admin who created it can see it |
| **Everyone** | All non-admin users receive a copy |
| **Specific Users** | Selected user(s) or group(s) receive a copy |

When shared, each user gets their own copy of the template. Edits to the original don't affect copies. If edits are made to a template, users with sharing access may update their copy to the latest version. If they have made edits to their copy, they can optionally resync their template to the latest version.

### Widget and Integration Sharing from Templates

All widgets and integrations included in a template are automatically shared with the users who receive the template.

Sensitive integration configuration (API keys, URLs, etc.) is **never** included in shared or exported templates. However, some widgets may contain personal content — custom HTML, link URLs, or similar data. This content is stripped by default, but can be opted in:

- **Internal sharing** — in the template builder, select "Share Links" or "Share HTML" on individual widgets. Flagged widgets will include their content when shared with internal users.
- **External export** — in addition to flagging widgets in the builder, enable **Include Personal Content** in the export modal. The exported `.framerr` file will then include the flagged content.

Templates containing widgets with personal content sharing enabled will display a "**Sensitive**" badge on the template card.

## What Users See

Non-admin users only see:

- Widgets that have been explicitly shared with them
- Integration instances assigned to them
- Templates that were shared (as personal copies)
- Service monitors shared with them

:::info Security
Non-admin users never see integration configuration, API keys, URLs, or connection details. They only see the data that flows through shared widgets — credentials are write-only and are never displayed, passed, or exposed to any user after saving, regardless of role.
:::
