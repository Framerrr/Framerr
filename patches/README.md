# Dependency Patches

This directory contains patches applied via `patch-package` to fix bugs in dependencies before official fixes are released.

---

## react-grid-layout+1.5.2.patch

**Issue:** Left-Resize Anchor Drift  
**Bug:** When resizing widgets from the left edge (w, sw, nw handles), the right edge drifts instead of staying anchored.  
**Root Cause:** The `resizeWest` function in `utils.js` incorrectly calculated the new left position.

### Technical Details

**Original buggy code:**
```javascript
const left = currentSize.left - (width - currentSize.width);
// This incorrectly moves the widget left as it grows
```

**Fixed code (from PR #2166):**
```javascript
const left = currentSize.left + currentSize.width - width;
// This preserves the right edge position

if (left < 0) {
  return { height, width: currentSize.left + currentSize.width, top, left: 0 };
}
```

### References
- **PR:** https://github.com/react-grid-layout/react-grid-layout/pull/2166
- **Commit:** `824bef86a45eb4e0e85e563681768d047e79cdc3`
- **Merged:** December 5, 2025

### When to Remove This Patch

**Check if RGL >= 1.5.4 includes PR #2166:**

1. Check the [RGL CHANGELOG](https://github.com/react-grid-layout/react-grid-layout/blob/master/CHANGELOG.md)
2. Verify PR #2166 is mentioned in the release notes
3. If included, update RGL:
   ```bash
   npm update react-grid-layout
   ```
4. Delete this patch file
5. Clear Vite cache:
   ```bash
   Remove-Item -Recurse -Force node_modules\.vite
   ```
6. Test left-side resizing still works correctly
7. Remove `patch-package` if no other patches remain:
   ```bash
   npm uninstall patch-package
   # Also remove "postinstall": "patch-package" from package.json
   ```

### Important Notes

- **Vite Cache:** After modifying patches, always clear `.vite/deps/` or Vite will use stale pre-bundled code
- **Both Files Patched:** The patch modifies both `lib/utils.js` (Flow source) and `build/utils.js` (transpiled) because Vite uses the `build/` version
