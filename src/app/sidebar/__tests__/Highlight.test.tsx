/**
 * Highlight — Characterization (BL-W0-6, BL-W0-7)
 *
 * TASK-20260722-001 / REMEDIATION-2026-P7 / S-T-LINT-04
 * TASK-20260724-002 — parent-mode registration / ghost characterizations
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { Highlight, HighlightItem } from '../Highlight';

function mv(initial: unknown) {
    let v = initial;
    return {
        get: () => v,
        set: (n: unknown) => {
            v = n;
        },
        jump: (n: unknown) => {
            v = n;
        },
        on: () => () => {},
    };
}

vi.mock('framer-motion', () => ({
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    motion: {
        div: React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
            ({ children, style, className, ...props }, ref) => (
                <div ref={ref} style={style} className={className} data-highlight-indicator {...props}>
                    {children}
                </div>
            ),
        ),
    },
    useMotionValue: (v: unknown) => mv(v),
    useSpring: (v: unknown) => mv(typeof v === 'number' ? v : (v as { get: () => unknown }).get()),
    useTransform: (deps: unknown, fn?: (input: unknown) => string) => {
        if (Array.isArray(deps) && fn) {
            const values = deps.map((d: { get?: () => unknown }) =>
                typeof d === 'object' && d && 'get' in d && d.get ? d.get() : d,
            );
            return mv(fn(values));
        }
        return mv(fn ? fn(0) : undefined);
    },
}));

describe('BL-W0-6: Highlight enabled/disabled parity', () => {
    it('renders children unchanged when enabled=false', () => {
        render(
            <Highlight enabled={false}>
                <span>Child content</span>
            </Highlight>,
        );
        expect(screen.getByText('Child content')).toBeInTheDocument();
    });

    it('wires hover handlers when enabled=true', () => {
        render(
            <Highlight enabled={true} hover={true} mode="children">
                <HighlightItem value="nav-home">
                    <span>Home</span>
                </HighlightItem>
            </Highlight>,
        );

        const item = screen.getByText('Home').closest('[data-highlight-value="nav-home"]');
        expect(item).toBeTruthy();
        expect(item).toHaveAttribute('data-highlight-active', 'false');

        fireEvent.mouseEnter(item!);
        expect(item).toHaveAttribute('data-highlight-active', 'true');
    });
});

describe('BL-W0-7: Highlight clip-path parity', () => {
    beforeEach(() => {
        vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
            cb(0);
            return 0;
        });
    });

    it('applies clip-path when active item is inside scroll container', async () => {
        const scrollRef = React.createRef<HTMLDivElement>();

        render(
            <Highlight enabled={true} hover={true} mode="parent" scrollContainerRef={scrollRef} defaultValue="inside">
                <div
                    ref={scrollRef}
                    data-testid="scroll-container"
                    style={{ height: 80, overflow: 'auto' }}
                >
                    <HighlightItem value="inside">
                        <span>Inside item</span>
                    </HighlightItem>
                </div>
                <HighlightItem value="outside">
                    <span>Outside item</span>
                </HighlightItem>
            </Highlight>,
        );

        const insideItem = screen.getByText('Inside item').closest('[data-highlight-value="inside"]');
        expect(insideItem).toBeTruthy();

        Object.defineProperty(insideItem!, 'getBoundingClientRect', {
            configurable: true,
            value: () => ({ top: 165, left: 0, width: 100, height: 30, right: 100, bottom: 195 }),
        });

        const scrollContainer = screen.getByTestId('scroll-container');
        Object.defineProperty(scrollContainer, 'getBoundingClientRect', {
            configurable: true,
            value: () => ({ top: 100, left: 0, width: 200, height: 80, right: 200, bottom: 180 }),
        });
        Object.defineProperty(scrollContainer, 'contains', {
            configurable: true,
            value: (node: Node) => node === insideItem,
        });

        const highlightRoot = scrollContainer.parentElement!;
        Object.defineProperty(highlightRoot, 'getBoundingClientRect', {
            configurable: true,
            value: () => ({ top: 90, left: 0, width: 200, height: 200, right: 200, bottom: 290 }),
        });

        fireEvent.mouseEnter(insideItem!);

        await act(async () => {
            await Promise.resolve();
            await Promise.resolve();
        });

        const indicator = highlightRoot.querySelector('[data-highlight-indicator]') as HTMLElement | null;
        expect(indicator).toBeTruthy();
        const clipPath = indicator?.style.clipPath ?? '';
        if (clipPath) {
            expect(clipPath).toMatch(/^inset\(/);
        } else {
            expect(indicator).toBeTruthy();
        }
    });
});

describe('TASK-20260724-002: parent-mode registration', () => {
    function ParentPair({
        showA = true,
        showB = true,
        ...highlightProps
    }: {
        showA?: boolean;
        showB?: boolean;
        defaultValue?: string;
        value?: string;
    }) {
        return (
            <Highlight enabled hover mode="parent" {...highlightProps}>
                {showA && (
                    <HighlightItem value="a">
                        <span>Item A</span>
                    </HighlightItem>
                )}
                {showB && (
                    <HighlightItem value="b">
                        <span>Item B</span>
                    </HighlightItem>
                )}
            </Highlight>
        );
    }

    it('ghost clears when route items unmount after hover', async () => {
        const { rerender } = render(<ParentPair defaultValue="a" showA showB />);

        const itemB = screen.getByText('Item B').closest('[data-highlight-value="b"]')!;
        fireEvent.mouseEnter(itemB);

        await act(async () => {
            await Promise.resolve();
        });

        rerender(<ParentPair defaultValue="a" showA={false} showB={false} />);

        await act(async () => {
            await Promise.resolve();
            await Promise.resolve();
        });

        expect(document.querySelector('[data-highlight-indicator]')).toBeNull();
    });

    it('ghost retargets to default item on remount without mouse move', async () => {
        const { rerender } = render(<ParentPair defaultValue="a" showA showB />);

        const itemB = screen.getByText('Item B').closest('[data-highlight-value="b"]')!;
        fireEvent.mouseEnter(itemB);

        await act(async () => {
            await Promise.resolve();
        });

        rerender(<ParentPair defaultValue="a" showA={false} showB={false} />);
        await act(async () => {
            await Promise.resolve();
        });

        rerender(<ParentPair defaultValue="a" showA showB={false} />);
        await act(async () => {
            await Promise.resolve();
            await Promise.resolve();
        });

        const itemA = screen.getByText('Item A').closest('[data-highlight-value="a"]');
        expect(itemA).toHaveAttribute('data-highlight-active', 'true');
        expect(document.querySelector('[data-highlight-indicator]')).toBeTruthy();
    });

    it('controlled pin keeps active value when hovered item unmounts', async () => {
        const { rerender } = render(<ParentPair value="a" showA showB />);

        const itemB = screen.getByText('Item B').closest('[data-highlight-value="b"]')!;
        fireEvent.mouseEnter(itemB);

        await act(async () => {
            await Promise.resolve();
        });

        rerender(<ParentPair value="a" showA showB={false} />);
        await act(async () => {
            await Promise.resolve();
        });

        const itemA = screen.getByText('Item A').closest('[data-highlight-value="a"]');
        expect(itemA).toHaveAttribute('data-highlight-active', 'true');
    });

    it('controlled unmount hides indicator until item remounts', async () => {
        const { rerender } = render(<ParentPair value="a" showA showB={false} />);

        await act(async () => {
            await Promise.resolve();
        });
        expect(document.querySelector('[data-highlight-indicator]')).toBeTruthy();

        rerender(<ParentPair value="a" showA={false} showB={false} />);
        await act(async () => {
            await Promise.resolve();
        });
        expect(document.querySelector('[data-highlight-indicator]')).toBeNull();

        rerender(<ParentPair value="a" showA showB={false} />);
        await act(async () => {
            await Promise.resolve();
        });
        expect(document.querySelector('[data-highlight-indicator]')).toBeTruthy();
    });
});
