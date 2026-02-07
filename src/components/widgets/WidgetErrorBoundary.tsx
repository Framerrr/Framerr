import React, { Component, ErrorInfo, ReactNode } from 'react';
import { WidgetStateMessage } from '../../shared/widgets';
import logger from '../../utils/logger';

interface WidgetErrorBoundaryProps {
    widgetType?: string;
    children: ReactNode;
}

interface WidgetErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
    showDetails: boolean;
}

/**
 * WidgetErrorBoundary - Enhanced error boundary for widgets
 * Catches React errors, displays premium error UI, and provides retry mechanism
 */
class WidgetErrorBoundary extends Component<WidgetErrorBoundaryProps, WidgetErrorBoundaryState> {
    constructor(props: WidgetErrorBoundaryProps) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
            showDetails: false
        };
    }

    static getDerivedStateFromError(error: Error): Partial<WidgetErrorBoundaryState> {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        this.setState({ errorInfo });

        logger.error('Widget error caught by boundary', {
            error: error.message,
            stack: error.stack,
            componentStack: errorInfo.componentStack,
            widgetType: this.props.widgetType || 'unknown'
        });
    }

    handleRetry = (): void => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
            showDetails: false
        });
    };

    toggleDetails = (): void => {
        this.setState(prev => ({ showDetails: !prev.showDetails }));
    };

    render(): ReactNode {
        if (this.state.hasError) {
            const { error, errorInfo } = this.state;

            return (
                <WidgetStateMessage
                    variant="crash"
                    serviceName="Widget"
                    errorDetails={error?.stack || errorInfo?.componentStack || error?.message}
                    onRetry={this.handleRetry}
                />
            );
        }

        return this.props.children;
    }
}

export default WidgetErrorBoundary;
