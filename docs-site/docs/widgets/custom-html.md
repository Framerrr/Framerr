---
title: Custom HTML
description: Render custom HTML, CSS, and JavaScript on your dashboard.
---

# Custom HTML

A freeform widget that renders your custom HTML and CSS. Use it for custom badges, status indicators, embedded content, or anything else you can build with HTML.

## Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| HTML Content | *(empty)* | Your HTML markup. Supports standard HTML tags. |
| CSS Styles | *(empty)* | Custom CSS to style your HTML. Scoped to this widget — won't affect the rest of the dashboard. |

:::tip Theme Variables
You can use Framerr's CSS variables in your custom CSS for consistent styling:
```css
h1 {
  color: var(--accent);
  font-size: 2rem;
}
```
:::

