# Grid Core — Library-Agnostic Layout Engine

> **Purpose:** Provides all layout operations, types, and components independent of any specific grid library. React-Grid-Layout (RGL) specifics are isolated in `../adapter/`.

---

## Quick Start

```tsx
import {
    // Component
    FramerrGridCore,
    
    // Hooks
    useLayoutHistory,
    useTouchGestures,
    
    // Operations
    addWidget,
    deleteWidget,
    updateWidgetConfig,
    
    // Types
    type FramerrWidget,
    type GridPolicy,
    type LayoutEvent,
} from '@/shared/grid/core';
```

---

## File Structure

| File | Purpose |
|------|---------|
| `types.ts` | Canonical type contracts (FramerrWidget, GridPolicy, etc.) |
| `ops.ts` | Pure functions for widget/layout operations |
| `FramerrGridCore.tsx` | The unified React grid component |
| `history.ts` | Multi-stack undo/redo system |
| `gestures.ts` | iOS-style touch gesture handling |
| `index.ts` | Barrel exports |

---

## FramerrGridCore Component

The main grid component used by Dashboard and Template Builder.

### Props

```typescript
interface FramerrGridCoreProps {
    /** Widgets to render */
    widgets: FramerrWidget[];
    
    /** Grid configuration policy */
    policy: GridPolicy;
    
    /** Render function for each widget */
    renderWidget: (widget: FramerrWidget, activation: WidgetActivation) => ReactNode;
    
    /** Visibility map for "hide when empty" feature */
    widgetVisibility?: Record<string, boolean>;
    
    /** Called during drag/resize (if commitStrategy='on-change') */
    onLayoutPreview?: (event: LayoutEvent) => void;
    
    /** Called when drag/resize stops */
    onLayoutCommit?: (event: LayoutEvent) => void;
    
    /** Called when widget is selected/deselected */
    onWidgetSelect?: (id: string | null) => void;
    
    /** Called when drag starts */
    onDragStart?: () => void;
    
    /** Called when resize starts */
    onResizeStart?: () => void;
    
    /** CSS class name for container */
    className?: string;
    
    /** External drag-ready widget (from touch gestures) */
    dragReadyWidgetId?: string | null;
}
```

### Activation State

Core manages activation state and passes it to every widget:

```typescript
interface WidgetActivation {
    /** Whether this widget is currently active */
    isActive: boolean;
    
    /** Type of activation: 'drag' | 'resize' | 'select' | 'touch-unlock' | null */
    activationType: 'drag' | 'resize' | 'select' | 'touch-unlock' | null;
    
    /** Whether touch unlock animation is in progress */
    isTouchUnlocking: boolean;
}
```

Widgets can use this for visual styling (pulse, shadows, resize handles).

### Usage Example

```tsx
<FramerrGridCore
    widgets={widgets}
    policy={dashboardPolicy}
    renderWidget={(widget, activation) => (
        <WidgetRenderer
            widget={widget}
            isActive={activation.isActive}
            activationType={activation.activationType}
        />
    )}
    onLayoutCommit={({ widgets, reason, affectedId }) => {
        setWidgets(widgets);
        history.push('desktop', { widgets });
    }}
    onDragStart={() => captureCurrentState()}
/>
```

---

## GridPolicy

Comprehensive configuration for grid behavior. Wrappers create policies, Core uses them.

```typescript
interface GridPolicy {
    layout: {
        responsive: boolean;      // true = use WidthProvider
        width?: number;           // Required if responsive=false
        breakpoints?: Record<string, number>;
        cols: Record<string, number>;
        rowHeight: number;
        margin: [number, number];
        containerPadding?: [number, number];
        compactType: 'vertical' | 'horizontal' | null;
        preventCollision: boolean;
        transformScale?: number;  // For Template Builder previews
    };
    
    interaction: {
        canDrag: boolean;
        canResize: boolean;
        resizeHandles: Array<'n' | 'e' | 's' | 'w' | 'ne' | 'se' | 'sw' | 'nw'>;
        draggableCancel: string;  // CSS selector for drag-cancel elements
        isBounded: boolean;
    };
    
    behavior: {
        commitStrategy: 'on-stop' | 'on-change';
        selectionMode: 'single' | 'none';
        touchActivation: 'long-press' | 'none';
        autoScroll: boolean;
        autoScrollContainerId?: string;
        autoScrollEdgeThreshold?: number;
    };
    
    view: {
        breakpoint: 'lg' | 'sm';  // Current viewport breakpoint
    };
    
    extensions?: GridPolicyExtensions;  // Future/experimental features
}
```

---

## Operations (`ops.ts`)

Pure functions that operate on `FramerrWidget[]`. No side effects, no React.

### Widget CRUD

| Function | Signature | Description |
|----------|-----------|-------------|
| `addWidget` | `(widgets, newWidget) → widgets` | Add widget to array |
| `deleteWidget` | `(widgets, widgetId) → widgets` | Remove by ID |
| `duplicateWidget` | `(widgets, widgetId, newId?) → widgets` | Clone with offset |

### Widget Modification

| Function | Signature | Description |
|----------|-----------|-------------|
| `updateWidgetConfig` | `(widgets, widgetId, configUpdates) → widgets` | Merge config |
| `resizeWidget` | `(widgets, widgetId, layoutUpdates, breakpoint?) → widgets` | Update size/position |
| `moveWidget` | `(widgets, widgetId, {x, y}, breakpoint?) → widgets` | Position only |

### Layout Operations

| Function | Signature | Description |
|----------|-----------|-------------|
| `widgetsToLayoutItems` | `(widgets, breakpoint) → LayoutItem[]` | Extract layout for breakpoint |
| `widgetsToLayoutModel` | `(widgets, includeMobile?) → LayoutModel` | Full derived layout |
| `applyLayoutToWidgets` | `(widgets, layout, breakpoint) → widgets` | Apply RGL changes back |
| `normalizeLayout` | `(data) → LayoutItem[]` | Clean/validate layout |
| `validateLayout` | `(layout) → boolean` | Check for issues |
| `applyConstraintsToLayout` | `(layout, getConstraints, widgets) → layout` | Apply min/max |

### Mobile Layout

| Function | Signature | Description |
|----------|-----------|-------------|
| `deriveLinkedMobileLayout` | `(widgets, cols?) → widgets` | Band algorithm for auto-stacking |
| `snapshotToMobileLayout` | `(widgets, cols?) → widgets` | Initialize mobile from desktop |

### Change Detection

| Function | Signature | Description |
|----------|-----------|-------------|
| `isDifferent` | `(current, baseline, options?) → boolean` | Check if arrays differ |
| `getChangedWidgetIds` | `(current, baseline) → string[]` | IDs that changed |
| `widgetSetsMatch` | `(widgetsA, widgetsB) → boolean` | Same IDs check |

### Utilities

| Function | Signature | Description |
|----------|-----------|-------------|
| `getWidgetById` | `(widgets, id) → widget?` | Find by ID |
| `generateWidgetId` | `() → string` | Unique ID generator |

---

## History (`history.ts`)

Multi-stack undo/redo system with separate stacks for desktop and mobile.

### Hook: `useLayoutHistory()`

```typescript
const history = useLayoutHistory();

// Push to specific stack
history.push('desktop', { widgets });
history.push('mobile', { widgets });

// Undo from specific stack
const previous = history.undo('desktop');
if (previous) {
    setWidgets(previous.widgets);
}

// Redo
const next = history.redo('mobile');

// Check availability
if (history.canUndo('desktop')) { ... }
if (history.canRedo('mobile')) { ... }

// Clear
history.clear();           // All stacks
history.clear('desktop');  // Just desktop
```

### Return Type

```typescript
interface UseLayoutHistoryReturn {
    push: (stack: 'desktop' | 'mobile', snapshot: HistorySnapshot) => void;
    undo: (stack) => HistorySnapshot | null;
    redo: (stack) => HistorySnapshot | null;
    canUndo: (stack) => boolean;
    canRedo: (stack) => boolean;
    clear: (stack?) => void;
    pushToRedo: (stack, snapshot) => void;
    pushToUndo: (stack, snapshot) => void;
}
```

### Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `MAX_HISTORY_SIZE` | 50 | Max entries per stack |

---

## Gestures (`gestures.ts`)

iOS-style hold-to-drag gesture detection for mobile grid editing.

### Hook: `useTouchGestures()`

```typescript
const {
    dragReadyWidgetId,
    containerRef,
    setTouchBlockingActive,
    resetDragReady,
    isTouchBlockingActive,
} = useTouchGestures();

// Activate when in edit mode on mobile
useEffect(() => {
    setTouchBlockingActive(editMode && isMobile);
}, [editMode, isMobile]);

// Attach to grid container
return <div ref={containerRef}>...</div>;
```

### Return Type

```typescript
interface UseTouchGesturesReturn {
    /** Widget ID that passed hold threshold */
    dragReadyWidgetId: string | null;
    
    /** Ref to attach to grid container */
    containerRef: RefObject<HTMLDivElement | null>;
    
    /** Enable/disable touch blocking */
    setTouchBlockingActive: (active: boolean) => void;
    
    /** Manual reset after drag completes */
    resetDragReady: () => void;
    
    /** Whether touch blocking is active */
    isTouchBlockingActive: boolean;
}
```

### Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `HOLD_THRESHOLD_MS` | 170 | Time to hold before drag enabled |
| `MOVE_THRESHOLD_PX` | 5 | Movement distance that cancels hold |
| `AUTO_RESET_MS` | 250 | Auto-lock delay after finger lift |

---

## Types (`types.ts`)

### Core Data Types

```typescript
// Persisted widget shape (saved to database)
interface FramerrWidget {
    id: string;
    type: string;
    layout: WidgetLayout;
    mobileLayout?: WidgetLayout;
    config?: WidgetConfig;
    integrationId?: string;
    integrationIds?: string[];
}

// Widget position/size
interface WidgetLayout {
    x: number;
    y: number;
    w: number;
    h: number;
}

// Internal layout item (uses 'id' not 'i')
interface LayoutItem {
    id: string;
    x: number;
    y: number;
    w: number;
    h: number;
    minW?: number;
    maxW?: number;
    minH?: number;
    maxH?: number;
    locked?: boolean;
    static?: boolean;
}

// Derived layout model (never persisted)
interface LayoutModel {
    desktop: LayoutItem[];
    mobile?: LayoutItem[];
}

// Breakpoint identifier
type Breakpoint = 'lg' | 'sm';
```

### Event Types

```typescript
interface LayoutEvent {
    widgets: FramerrWidget[];
    reason: 'drag' | 'resize' | 'programmatic' | 'add' | 'remove';
    affectedId?: string;
}

interface HistorySnapshot {
    widgets: FramerrWidget[];
    selectedWidgetId?: string | null;
}

type HistoryStackName = 'desktop' | 'mobile';
```

---

## Architecture Notes

### Key Principles

1. **FramerrWidget[] is the source of truth** — Always persist widgets, never LayoutModel
2. **LayoutModel is derived and transient** — Computed at render time
3. **RGL is isolated to adapter/** — Core never imports from react-grid-layout
4. **Pure functions in ops.ts** — No side effects, easy to test

### Layer Diagram

```
┌─────────────────────────────────────────────────┐
│  Page (Dashboard.tsx / TemplateBuilderStep2)   │
│  - Calls useDashboardLayout()                  │
│  - Renders grid wrapper                        │
└──────────────────────┬──────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────┐
│  useDashboardLayout() - Orchestrator Hook      │
│  - Widget state (CRUD)                         │
│  - Undo/redo (delegates to Core history)       │
│  - gridProps (callbacks wired to history)      │
└──────────────────────┬──────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────┐
│  Grid Wrapper (FramerrDashboardGrid, etc.)     │
│  - Constructs GridPolicy                       │
│  - Surface-specific behavior                   │
└──────────────────────┬──────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────┐
│  FramerrGridCore - Single Source of Truth      │
│  - Manages activation state                    │
│  - Translates FramerrWidget[] → RGL layouts    │
│  - Emits layout events                         │
└─────────────────────────────────────────────────┘
```

---

## Related Documentation

- **Architecture & Design:** [`docs/grid-rework/ARCHITECTURE.md`](../../../docs/grid-rework/ARCHITECTURE.md)
- **Implementation Index:** [`docs/grid-rework/INDEX.md`](../../../docs/grid-rework/INDEX.md)
- **Unified Vision:** [`docs/grid-rework/UNIFIED_ARCHITECTURE.md`](../../../docs/grid-rework/UNIFIED_ARCHITECTURE.md)
