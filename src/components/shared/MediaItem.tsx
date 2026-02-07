import React from 'react';

export interface MediaItemProps {
    title: string;
    type: string;
    time: string;
}

const MediaItem = ({ title, type, time }: MediaItemProps): React.JSX.Element => (
    <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700/50 hover:border-accent/50 transition-colors">
        <div className="flex-1">
            <h4 className="font-medium text-white">{title}</h4>
            <p className="text-sm text-slate-400">{type}</p>
        </div>
        <div className="text-sm text-accent font-medium">{time}</div>
    </div>
);

export default MediaItem;
