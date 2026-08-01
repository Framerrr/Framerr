import React from 'react';
import './styles.css';

interface MediaSectionHeadingProps {
    children: React.ReactNode;
    icon?: React.ReactNode;
}

export const MediaSectionHeading: React.FC<MediaSectionHeadingProps> = ({ children, icon }) => (
    <h4 className={`media-section-heading${icon ? ' media-section-heading--with-icon' : ''}`}>
        {icon}
        {children}
    </h4>
);
