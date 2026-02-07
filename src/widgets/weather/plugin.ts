/**
 * Weather Widget Plugin
 *
 * Current weather and forecast with configurable location and display options.
 * P4 Phase 4.3: Widget Plugin Migration
 */

import { lazy } from 'react';
import { Cloud } from 'lucide-react';
import type { WidgetPlugin } from '../types';

export const plugin: WidgetPlugin = {
    id: 'weather',
    name: 'Weather',
    description: 'Current weather and forecast',
    category: 'utility',
    icon: Cloud,
    sizing: {
        default: { w: 6, h: 2 },
        min: { w: 4, h: 1 },
        max: { w: 24, h: 6 },
    },
    component: lazy(() => import('./WeatherWidget')),
    isGlobal: true,
    defaultConfig: {
        locationMode: 'auto',
        showCity: true,
    },
    configConstraints: {
        contentPadding: 'sm',  // Compact padding for data-dense display
        options: [
            // Location mode selector
            {
                key: 'locationMode',
                label: 'Location',
                type: 'buttons',
                defaultValue: 'auto',
                choices: [
                    { value: 'auto', label: 'Auto' },
                    { value: 'search', label: 'City Search' },
                    { value: 'manual', label: 'Manual' },
                ]
            },
            // City search (visible only in 'search' mode)
            {
                key: 'citySearch',
                label: 'Search City',
                type: 'search',
                placeholder: 'Type a city name...',
                visibleWhen: { key: 'locationMode', value: 'search' },
                searchFn: async (query: string) => {
                    const res = await fetch(
                        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en`
                    );
                    const data = await res.json();
                    return (data.results || []).map((r: { name: string; admin1?: string; country: string; latitude: number; longitude: number }) => ({
                        label: `${r.name}${r.admin1 ? `, ${r.admin1}` : ''}, ${r.country}`,
                        value: {
                            latitude: r.latitude,
                            longitude: r.longitude,
                            cityName: `${r.name}${r.admin1 ? `, ${r.admin1}` : ''}`
                        }
                    }));
                },
                linkedFields: { latitude: 'latitude', longitude: 'longitude', cityName: 'cityName' },
            },
            // Latitude (visible in search+manual modes)
            {
                key: 'latitude',
                label: 'Latitude',
                type: 'number',
                placeholder: '40.7128',
                min: -90,
                max: 90,
                step: 0.0001,
                visibleWhen: { key: 'locationMode', value: ['search', 'manual'] },
                readOnlyWhen: { key: 'locationMode', value: 'search' },
            },
            // Longitude (visible in search+manual modes)
            {
                key: 'longitude',
                label: 'Longitude',
                type: 'number',
                placeholder: '-74.0060',
                min: -180,
                max: 180,
                step: 0.0001,
                visibleWhen: { key: 'locationMode', value: ['search', 'manual'] },
                readOnlyWhen: { key: 'locationMode', value: 'search' },
            },
            // Display options
            {
                key: 'displayOptions',
                label: 'Display',
                type: 'toggle-buttons',
                choices: [
                    { value: 'useCelsius', label: '°C', defaultValue: false },
                    { value: 'showDecimals', label: 'Decimals', defaultValue: false },
                    { value: 'showCity', label: 'City', defaultValue: true },
                ]
            }
        ]
    },
};

