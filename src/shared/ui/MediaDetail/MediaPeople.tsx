import React from 'react';
import { MediaSectionHeading } from './MediaSectionHeading';
import './styles.css';

interface MediaPeopleProps {
    /** Singular base label, e.g. "Director" or "Writer" */
    label: string;
    names: string[];
}

export const MediaPeople: React.FC<MediaPeopleProps> = ({ label, names }) => {
    if (!names.length) return null;
    const heading = names.length > 1 ? `${label}s` : label;
    return (
        <div>
            <MediaSectionHeading>{heading}</MediaSectionHeading>
            <p className="media-people-body">{names.join(', ')}</p>
        </div>
    );
};
