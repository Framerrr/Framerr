import React from 'react';
import {
    Sun,
    Cloud,
    CloudFog,
    CloudRain,
    CloudSnow,
    CloudLightning,
    MapPin,
    RefreshCw,
    LucideIcon
} from 'lucide-react';
import { WidgetStateMessage } from '../../shared/widgets';
import logger from '../../utils/logger';
import type { WidgetProps } from '../types';
import './styles.css';

interface WeatherData {
    temp: number;
    code: number;
    high: number;
    low: number;
    location: string;
}

interface WeatherInfo {
    label: string;
    icon: LucideIcon;
}

interface OpenMeteoResponse {
    current: {
        temperature_2m: number;
        weather_code: number;
    };
    daily: {
        temperature_2m_max: number[];
        temperature_2m_min: number[];
    };
}

interface LocationResponse {
    locality?: string;
    principalSubdivision?: string;
    principalSubdivisionCode?: string;
    city?: string;
}

interface WeatherWidgetProps extends WidgetProps {
    // No additional props needed - uses base WidgetProps
}

// Static preview weather data for template builder
const PREVIEW_WEATHER: WeatherData = {
    temp: 42,
    code: 0, // Clear/Sunny
    high: 48,
    low: 35,
    location: 'New York, NY'
};

const CACHE_KEY = 'framerr_weather_location';
const CACHE_EXPIRY_DAYS = 7;

const WeatherWidget = ({ widget, isEditMode = false, previewMode = false }: WeatherWidgetProps): React.JSX.Element | null => {
    // ===== Config values from widget.config =====
    const cfg = widget.config || {};
    const locationMode = (cfg.locationMode as string) || 'auto';
    const configLat = cfg.latitude as number | undefined;
    const configLon = cfg.longitude as number | undefined;
    const configCityName = cfg.cityName as string | undefined;
    const useCelsius = cfg.useCelsius === true;
    const showDecimals = cfg.showDecimals === true;
    const showCity = cfg.showCity !== false; // default true

    // In preview mode, use static data; otherwise fetch real weather
    const [weather, setWeather] = React.useState<WeatherData | null>(previewMode ? PREVIEW_WEATHER : null);
    const [loading, setLoading] = React.useState<boolean>(!previewMode);
    const [error, setError] = React.useState<string | null>(null);
    const [showRefreshConfirm, setShowRefreshConfirm] = React.useState<boolean>(false);
    const [refreshing, setRefreshing] = React.useState<boolean>(false);

    // WMO Weather interpretation codes (https://open-meteo.com/en/docs)
    const getWeatherInfo = (code: number): WeatherInfo => {
        if (code === 0) return { label: 'Clear', icon: Sun };
        if (code === 1 || code === 2 || code === 3) return { label: 'Partly Cloudy', icon: Cloud };
        if (code >= 45 && code <= 48) return { label: 'Fog', icon: CloudFog || Cloud };
        if (code >= 51 && code <= 67) return { label: 'Rain', icon: CloudRain };
        if (code >= 71 && code <= 77) return { label: 'Snow', icon: CloudSnow };
        if (code >= 80 && code <= 82) return { label: 'Showers', icon: CloudRain };
        if (code >= 85 && code <= 86) return { label: 'Snow Showers', icon: CloudSnow };
        if (code >= 95 && code <= 99) return { label: 'Thunderstorm', icon: CloudLightning };
        return { label: 'Unknown', icon: Cloud };
    };

    // Format temperature based on config
    const formatTemp = (tempFahrenheit: number): string => {
        let temp = tempFahrenheit;
        if (useCelsius) {
            temp = (tempFahrenheit - 32) * 5 / 9;
        }
        if (showDecimals) {
            return temp.toFixed(1);
        }
        return Math.round(temp).toString();
    };

    // Fetch weather data using coordinates
    const fetchWeather = async (latitude: number, longitude: number, locationName?: string): Promise<void> => {
        try {
            // Always fetch in Fahrenheit from API, convert client-side for consistency
            const weatherRes = await fetch(
                `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&timezone=auto`
            );

            if (!weatherRes.ok) throw new Error('Weather data fetch failed');
            const weatherData: OpenMeteoResponse = await weatherRes.json();

            // Determine location string
            let locationStr = locationName || 'Unknown Location';

            // If no pre-set location name, reverse geocode
            if (!locationName) {
                try {
                    const locationRes = await fetch(
                        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
                    );
                    const locationData: LocationResponse = await locationRes.json();

                    if (locationData.locality && locationData.principalSubdivision) {
                        locationStr = `${locationData.locality}, ${locationData.principalSubdivisionCode || locationData.principalSubdivision}`;
                    } else if (locationData.city) {
                        locationStr = locationData.city;
                    } else if (locationData.locality) {
                        locationStr = locationData.locality;
                    }
                } catch {
                    // Reverse geocode failed, use coordinates as fallback
                    locationStr = `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`;
                }
            }

            setWeather({
                temp: weatherData.current.temperature_2m,
                code: weatherData.current.weather_code,
                high: weatherData.daily.temperature_2m_max[0],
                low: weatherData.daily.temperature_2m_min[0],
                location: locationStr
            });
            setError(null);
        } catch (err) {
            logger.error('Weather fetch error:', { error: err });
            setError('Failed to load weather');
        } finally {
            setLoading(false);
        }
    };

    // ===== Location sourcing based on config mode =====
    React.useEffect(() => {
        // Skip data fetching in preview mode - use static data
        if (previewMode) return;

        // Reset state for fresh fetch
        setLoading(true);
        setError(null);

        if (locationMode === 'search' || locationMode === 'manual') {
            // Use configured coordinates
            if (configLat != null && configLon != null) {
                // For search mode, use the stored city name
                const locationName = locationMode === 'search' ? configCityName : undefined;
                fetchWeather(configLat, configLon, locationName || undefined);
            } else {
                setError(locationMode === 'search' ? 'Search for a city in widget settings' : 'Set coordinates in widget settings');
                setLoading(false);
            }
            return;
        }

        // Auto mode: try cached location first, then geolocation
        const getCachedLocation = (): { latitude: number; longitude: number } | null => {
            try {
                const cached = localStorage.getItem(CACHE_KEY);
                if (!cached) return null;

                const data = JSON.parse(cached);
                const cacheAge = Date.now() - (data.timestamp || 0);
                const maxAge = CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

                if (cacheAge > maxAge) {
                    localStorage.removeItem(CACHE_KEY);
                    return null;
                }

                return { latitude: data.latitude, longitude: data.longitude };
            } catch {
                return null;
            }
        };

        const cacheLocation = (latitude: number, longitude: number): void => {
            try {
                localStorage.setItem(CACHE_KEY, JSON.stringify({
                    latitude,
                    longitude,
                    timestamp: Date.now()
                }));
            } catch (err) {
                logger.warn('Failed to cache location:', { error: err });
            }
        };

        // Try cached location first
        const cachedLocation = getCachedLocation();
        if (cachedLocation) {
            logger.debug('Using cached location for weather');
            fetchWeather(cachedLocation.latitude, cachedLocation.longitude);
            return;
        }

        // No cache - request geolocation
        if (!navigator.geolocation) {
            setError('Geolocation not supported');
            setLoading(false);
            return;
        }

        const success = async (position: GeolocationPosition): Promise<void> => {
            const { latitude, longitude } = position.coords;
            cacheLocation(latitude, longitude);
            await fetchWeather(latitude, longitude);
        };

        const fail = (err: GeolocationPositionError): void => {
            logger.error('Geolocation error:', { code: err.code, message: err.message });
            switch (err.code) {
                case 1: setError('Location access denied'); break;
                case 2: setError('Location unavailable'); break;
                case 3: setError('Location request timed out'); break;
                default: setError('Failed to get location');
            }
            setLoading(false);
        };

        navigator.geolocation.getCurrentPosition(success, fail, {
            timeout: 30000,
            maximumAge: 60000
        });
    }, [previewMode, locationMode, configLat, configLon, configCityName]);

    // Handle refresh location request (auto mode only)
    const handleRefreshLocation = (): void => {
        if (!navigator.geolocation) {
            setError('Geolocation not supported');
            return;
        }

        setRefreshing(true);
        setShowRefreshConfirm(false);

        // Clear the cache
        try {
            localStorage.removeItem(CACHE_KEY);
        } catch (err) {
            logger.warn('Failed to clear location cache:', { error: err });
        }

        // Request fresh location
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;

                try {
                    localStorage.setItem(CACHE_KEY, JSON.stringify({
                        latitude,
                        longitude,
                        timestamp: Date.now()
                    }));
                } catch (err) {
                    logger.warn('Failed to cache location:', { error: err });
                }

                await fetchWeather(latitude, longitude);
                setRefreshing(false);
            },
            (err) => {
                logger.error('Geolocation refresh error:', { code: err.code, message: err.message });
                switch (err.code) {
                    case 1: setError('Location access denied'); break;
                    case 2: setError('Location unavailable'); break;
                    case 3: setError('Location request timed out'); break;
                    default: setError('Failed to get location');
                }
                setRefreshing(false);
            },
            { timeout: 30000, maximumAge: 0 }
        );
    };

    // Render loading state
    if (loading) {
        return <WidgetStateMessage variant="loading" />;
    }

    // Render error state
    if (error) {
        return (
            <WidgetStateMessage
                variant="error"
                serviceName="Weather"
                message={error}
            />
        );
    }

    if (!weather) return null;

    const info = getWeatherInfo(weather.code);
    const WeatherIcon = info.icon || Cloud;
    const tempUnit = useCelsius ? '°C' : '°F';

    // Render success state - CSS container queries handle all responsive layouts
    return (
        <div className="weather-widget">
            {/* Refresh button - edit mode only, auto mode only */}
            {isEditMode && locationMode === 'auto' && (
                <button
                    onClick={() => setShowRefreshConfirm(true)}
                    className="weather-widget__refresh-btn"
                    title="Refresh location"
                    disabled={refreshing}
                >
                    <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
                </button>
            )}

            {/* Refresh confirmation dialog */}
            {showRefreshConfirm && (
                <div className="weather-widget__confirm-overlay">
                    <div className="weather-widget__confirm-dialog">
                        <p>Refresh location?</p>
                        <div className="weather-widget__confirm-buttons">
                            <button
                                onClick={() => setShowRefreshConfirm(false)}
                                className="weather-widget__confirm-btn weather-widget__confirm-btn--cancel"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleRefreshLocation}
                                className="weather-widget__confirm-btn weather-widget__confirm-btn--confirm"
                            >
                                Yes
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="weather-widget__content">
                {/* Weather Icon */}
                <WeatherIcon className="weather-widget__icon" />

                {/* Temperature */}
                <div className="weather-widget__temp">
                    {formatTemp(weather.temp)}°
                </div>

                {/* Info Section */}
                <div className="weather-widget__info">
                    {/* City name - conditionally shown based on showCity config */}
                    {showCity && (
                        <div className="weather-widget__location">
                            <MapPin className="weather-widget__location-icon" />
                            <span>{weather.location}</span>
                        </div>
                    )}
                    <div className="weather-widget__condition">{info.label}</div>
                    <div className="weather-widget__highlow">
                        H: {formatTemp(weather.high)}° · L: {formatTemp(weather.low)}°
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WeatherWidget;
