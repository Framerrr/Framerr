import React from 'react';
import Link from '@docusaurus/Link';
import styles from './DocCardGrid.module.css';

/**
 * DocCardGrid
 *
 * Renders a responsive grid of navigation cards, inspired by Framerr's
 * WidgetCard gallery variant. Supports optional category grouping.
 *
 * Usage:
 *   <DocCardGrid items={[{ title, description, icon, link }]} />
 *
 *   // With groups:
 *   <DocCardGrid groups={[
 *     { label: 'Media Servers', items: [...] },
 *     { label: 'Downloads', items: [...] },
 *   ]} />
 */

function CardItem({ title, description, icon, link }) {
    return (
        <Link to={link} className={styles.card}>
            <div className={styles.iconPill}>{icon}</div>
            <div className={styles.content}>
                <h4 className={styles.title}>{title}</h4>
                {description && <p className={styles.description}>{description}</p>}
            </div>
            <span className={styles.arrow}>→</span>
        </Link>
    );
}

export default function DocCardGrid({ items, groups }) {
    // Grouped display
    if (groups) {
        return (
            <div className={styles.grid}>
                {groups.map((group, i) => (
                    <React.Fragment key={group.label}>
                        <h3 className={`${styles.groupHeading}${i > 0 ? ` ${styles.groupHeadingSpaced}` : ''}`}>{group.label}</h3>
                        {group.items.map((item) => (
                            <CardItem key={item.title} {...item} />
                        ))}
                    </React.Fragment>
                ))}
            </div>
        );
    }

    // Flat display
    return (
        <div className={styles.grid}>
            {(items || []).map((item) => (
                <CardItem key={item.title} {...item} />
            ))}
        </div>
    );
}
