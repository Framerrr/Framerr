import React from 'react';
import MediaItem from '../shared/MediaItem';

const UpcomingMediaWidget: React.FC = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <MediaItem title="Inception" type="Movie" time="Tonight, 8:00 PM" />
        <MediaItem title="Stranger Things" type="Episode" time="Tomorrow" />
        <MediaItem title="The Mandalorian" type="Episode" time="Friday" />
    </div>
);

export default UpcomingMediaWidget;
