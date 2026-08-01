import React from 'react';
import { MediaSectionHeading } from './MediaSectionHeading';
import './styles.css';

interface MediaSynopsisProps {
    text: string;
}

export const MediaSynopsis: React.FC<MediaSynopsisProps> = ({ text }) => {
    if (!text) return null;
    return (
        <div>
            <MediaSectionHeading>Synopsis</MediaSectionHeading>
            <p className="media-synopsis">{text}</p>
        </div>
    );
};
