---
sidebar_position: 4
---

# Custom Favicon

Replace Framerr's default favicon with your own using a favicon package from [RealFaviconGenerator.net](https://realfavicongenerator.net). This gives you a proper favicon for every platform — browsers, iOS home screen, Android, Windows tiles, and more.

## How to Set Up

### 1. Generate Your Favicon Package

1. Go to [realfavicongenerator.net](https://realfavicongenerator.net)
2. Upload your logo or icon image (a square PNG of at least 512×512px works best)
3. Customize the settings for each platform as desired
4. In **Favicon Generator Options** at the bottom, set the path to `/favicon`
5. Click **Generate your Favicons and HTML code**
6. Download the **Favicon package** (ZIP file) and copy the **HTML code**

:::warning Important
You **must** set the path to `/favicon` in the generator options. If you leave it as the default (`/`), the favicon files won't be found by Framerr.
:::

### 2. Upload to Framerr

1. Go to **Settings → Customization → Favicon**
2. Upload the ZIP file from RealFaviconGenerator
3. Paste the HTML code snippet into the text area
4. Click **Upload Favicon**
5. Refresh the page to see your new favicon

## Managing Your Favicon

Once uploaded, you can:

| Action | How |
|--------|-----|
| **Enable / Disable** | Toggle the switch to temporarily revert to the default Framerr favicon without deleting your upload |
| **Delete** | Click "Delete Custom Favicon" to permanently remove it and restore the default |
| **Replace** | Upload a new ZIP package — it overwrites the previous one |

## Backups

Custom favicon files are automatically included in Framerr [backups](../configuration/backups). When you restore a backup that contains a favicon package, it's restored along with everything else.

:::info Admin Only
Custom favicons are a system-wide setting that affects all users. Only admins can upload, toggle, or delete favicons.
:::
