import React from 'react';
import { MediaSectionHeading } from './MediaSectionHeading';
import './styles.css';

interface MediaGenresProps {
    genres: string[];
}

export const MediaGenres: React.FC<MediaGenresProps> = ({ genres }) => {
    if (!genres.length) return null;
    return (
        <div>
            <MediaSectionHeading>Genres</MediaSectionHeading>
            <div className="media-genres">
                {genres.map((genre) => (
                    <span key={genre} className="media-genre-chip">
                        {genre}
                    </span>
                ))}
            </div>
        </div>
    );
};
