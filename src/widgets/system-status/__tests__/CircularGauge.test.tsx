/**
 * CircularGauge — unit tests (CG-1)
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CircularGauge from '../components/CircularGauge';

describe('CircularGauge', () => {
    it('renders empty arc at value=0', () => {
        const { container } = render(
            <CircularGauge value={0} color="var(--success)" label="0%" ariaLabel="CPU 0%" />
        );
        const fill = container.querySelector('.metric-gauge__fill');
        expect(fill?.getAttribute('stroke-dasharray')).toBe('0 100');
        expect(fill?.getAttribute('pathLength')).toBe('100');
    });

    it('renders full arc at value=100', () => {
        const { container } = render(
            <CircularGauge value={100} color="var(--success)" label="100%" ariaLabel="CPU 100%" />
        );
        const fill = container.querySelector('.metric-gauge__fill');
        expect(fill?.getAttribute('stroke-dasharray')).toBe('100 100');
    });

    it('renders half arc at value=50', () => {
        const { container } = render(
            <CircularGauge value={50} color="var(--success)" label="50%" ariaLabel="CPU 50%" />
        );
        const fill = container.querySelector('.metric-gauge__fill');
        expect(fill?.getAttribute('stroke-dasharray')).toBe('50 100');
    });

    it('renders small arc at value=4 (no inflation)', () => {
        const { container } = render(
            <CircularGauge value={4} color="var(--success)" label="4%" ariaLabel="CPU 4%" />
        );
        const fill = container.querySelector('.metric-gauge__fill');
        expect(fill?.getAttribute('stroke-dasharray')).toBe('4 100');
    });

    it('clamps out-of-range values to 100', () => {
        const { container } = render(
            <CircularGauge value={150} color="var(--success)" label="150%" ariaLabel="CPU 150%" />
        );
        const fill = container.querySelector('.metric-gauge__fill');
        expect(fill?.getAttribute('stroke-dasharray')).toBe('100 100');
    });

    it('renders label text and aria-label on wrapper', () => {
        render(
            <CircularGauge value={72} color="var(--success)" label="72%" ariaLabel="CPU usage 72%" />
        );
        expect(screen.getByText('72%')).toBeInTheDocument();
        expect(screen.getByRole('img', { name: 'CPU usage 72%' })).toBeInTheDocument();
    });

    it('renders optional caption under the value inside the ring', () => {
        render(
            <CircularGauge
                value={72}
                color="var(--success)"
                label="72%"
                caption="CPU"
                ariaLabel="CPU usage 72%"
            />
        );
        expect(screen.getByText('CPU')).toBeInTheDocument();
        expect(document.querySelector('.metric-gauge__caption')).not.toBeNull();
    });
});
