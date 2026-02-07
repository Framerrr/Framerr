# GridStack Vendor Info

## Source

- **Library**: GridStack.js
- **Version**: v10.3.1
- **Source**: https://github.com/gridstack/gridstack.js
- **License**: MIT
- **Date Vendored**: 2026-02-03

## Why Vendored?

GridStack is vendored (not installed via npm) to enable:

1. **Touch delay** - Custom delay before touch drag activates (allows scrolling)
2. **Future engine modifications** - Band detection, crack snapping
3. **React integration fixes** - Custom event handling

## Modifications (dnd-kit Pending State Pattern)

### dd-manager.ts
Added state properties for the pending touch pattern:
- `touchDelay` - Delay in ms before drag activates (default 0)
- `touchTolerance` - Max movement in px during delay (default 10)
- `touchInitialX/Y` - Starting touch coordinates
- `touchTimeoutId` - Timer reference for delay
- `touchActivated` - Whether drag has been activated
- `savedTouchEvent` - Original touchstart for mousedown simulation

### dd-touch.ts
Implemented dnd-kit's "Pending Gate" pattern:

**Key Concept**: `preventDefault()` is ONLY called AFTER activation.

1. **touchstart**: Record position, start timer, DON'T preventDefault
2. **Pending period**: Timer running, checking if finger moves
3. **touchmove (during pending)**: If moved >tolerance → cancel (scrolling)
4. **Timer fires**: Activate → simulate mousedown
5. **touchmove (after activation)**: Now call preventDefault, move widget

Helper functions:
- `hasExceededTolerance(e)` - Check if finger moved too far
- `activateDrag()` - Simulate mousedown, set activated flag
- `cancelPendingDrag()` - Clear timer, release touch handling

## Usage

```typescript
import { DDManager } from 'gridstack';

// Configure before GridStack.init()
DDManager.touchDelay = 200;      // 200ms hold required
DDManager.touchTolerance = 10;   // 10px movement cancels
```

## Next Steps: Production Integration

The vendored GridStack with touch delay is ready for production:

1. **Dashboard Integration**: Update `src/shared/grid/` imports
2. **Template Builder Integration**: Same path alias pattern
3. **Adapter Layer**: `buildGridAdapter()` should configure touchDelay

## Updating

To update to a newer version:
1. Clone: `git clone --depth 1 --branch vX.X.X https://github.com/gridstack/gridstack.js.git`
2. Copy `src/*.ts` files to `src/vendor/gridstack/`
3. Copy CSS from `npm:gridstack/dist/` to vendor folder
4. Re-apply modifications (see above)
5. Test thoroughly
