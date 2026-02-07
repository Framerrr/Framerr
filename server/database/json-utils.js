/**
 * JSON Column Utilities for SQLite
 * 
 * Helpers for working with JSON-type columns in SQLite.
 * Used for safely updating flexible data structures like
 * user preferences, widget configs, dashboard layouts, etc.
 */

// Handle ES module interop - compiled TypeScript logger exports to .default
const loggerModule = require('../utils/logger');
const logger = loggerModule.default || loggerModule;

/**
 * Deep merge two objects (source into target)
 * Arrays are replaced, not merged
 * @param {object} target - Target object
 * @param {object} source - Source object
 * @returns {object} Merged object
 */
function deepMerge(target, source) {
    if (!isObject(target) || !isObject(source)) {
        return source;
    }

    const output = { ...target };

    Object.keys(source).forEach(key => {
        if (isObject(source[key]) && isObject(target[key])) {
            output[key] = deepMerge(target[key], source[key]);
        } else {
            output[key] = source[key];
        }
    });

    return output;
}

/**
 * Check if value is a plain object
 * @param {*} item - Value to check
 * @returns {boolean}
 */
function isObject(item) {
    return item && typeof item === 'object' && !Array.isArray(item);
}

/**
 * Merge stored JSON with defaults, ensuring new default keys exist
 * Stored values take precedence over defaults
 * @param {object|string} stored - Stored JSON (object or string)
 * @param {object} defaults - Default values
 * @returns {object} Merged object
 */
function mergeWithDefaults(stored, defaults) {
    const storedObj = typeof stored === 'string' ? JSON.parse(stored) : (stored || {});
    return deepMerge(defaults, storedObj);
}

/**
 * Add a new key with default value to all rows in a JSON column
 * @param {Database} db - better-sqlite3 database instance
 * @param {string} table - Table name
 * @param {string} column - JSON column name
 * @param {string} jsonPath - Dot-separated path (e.g., 'settings.notifications')
 * @param {*} defaultValue - Default value to set
 * @returns {number} Number of rows updated
 */
function addDefaultToJsonColumn(db, table, column, jsonPath, defaultValue) {
    // Get all rows
    const rows = db.prepare(`SELECT rowid, ${column} FROM ${table}`).all();

    let updated = 0;
    const update = db.prepare(`UPDATE ${table} SET ${column} = ? WHERE rowid = ?`);

    const transaction = db.transaction(() => {
        for (const row of rows) {
            try {
                const json = row[column] ? JSON.parse(row[column]) : {};

                // Navigate to path and set default if key doesn't exist
                const pathParts = jsonPath.split('.');
                let current = json;

                for (let i = 0; i < pathParts.length - 1; i++) {
                    const part = pathParts[i];
                    if (!current[part]) {
                        current[part] = {};
                    }
                    current = current[part];
                }

                const lastKey = pathParts[pathParts.length - 1];
                if (!(lastKey in current)) {
                    current[lastKey] = defaultValue;
                    update.run(JSON.stringify(json), row.rowid);
                    updated++;
                }
            } catch (error) {
                logger.warn(`[JSON Utils] Failed to update row ${row.rowid} in ${table}.${column}:`, error.message);
            }
        }
    });

    transaction();

    if (updated > 0) {
        logger.debug(`[JSON Utils] Added ${jsonPath} to ${updated} rows in ${table}.${column}`);
    }

    return updated;
}

/**
 * Remove a key from all rows in a JSON column
 * @param {Database} db - better-sqlite3 database instance
 * @param {string} table - Table name
 * @param {string} column - JSON column name
 * @param {string} jsonPath - Dot-separated path to remove
 * @returns {number} Number of rows updated
 */
function removeFromJsonColumn(db, table, column, jsonPath) {
    const rows = db.prepare(`SELECT rowid, ${column} FROM ${table}`).all();

    let updated = 0;
    const update = db.prepare(`UPDATE ${table} SET ${column} = ? WHERE rowid = ?`);

    const transaction = db.transaction(() => {
        for (const row of rows) {
            try {
                const json = row[column] ? JSON.parse(row[column]) : {};

                const pathParts = jsonPath.split('.');
                let current = json;

                // Navigate to parent of target key
                for (let i = 0; i < pathParts.length - 1; i++) {
                    const part = pathParts[i];
                    if (!current[part]) {
                        current = null;
                        break;
                    }
                    current = current[part];
                }

                if (current) {
                    const lastKey = pathParts[pathParts.length - 1];
                    if (lastKey in current) {
                        delete current[lastKey];
                        update.run(JSON.stringify(json), row.rowid);
                        updated++;
                    }
                }
            } catch (error) {
                logger.warn(`[JSON Utils] Failed to remove from row ${row.rowid} in ${table}.${column}:`, error.message);
            }
        }
    });

    transaction();

    if (updated > 0) {
        logger.debug(`[JSON Utils] Removed ${jsonPath} from ${updated} rows in ${table}.${column}`);
    }

    return updated;
}

/**
 * Transform all JSON values in a column using a custom function
 * @param {Database} db - better-sqlite3 database instance
 * @param {string} table - Table name
 * @param {string} column - JSON column name
 * @param {Function} transformer - Function that receives parsed JSON and returns transformed JSON
 * @returns {number} Number of rows updated
 */
function transformJsonColumn(db, table, column, transformer) {
    const rows = db.prepare(`SELECT rowid, ${column} FROM ${table}`).all();

    let updated = 0;
    const update = db.prepare(`UPDATE ${table} SET ${column} = ? WHERE rowid = ?`);

    const transaction = db.transaction(() => {
        for (const row of rows) {
            try {
                const json = row[column] ? JSON.parse(row[column]) : {};
                const transformed = transformer(json);

                if (transformed !== undefined) {
                    update.run(JSON.stringify(transformed), row.rowid);
                    updated++;
                }
            } catch (error) {
                logger.warn(`[JSON Utils] Failed to transform row ${row.rowid} in ${table}.${column}:`, error.message);
            }
        }
    });

    transaction();

    if (updated > 0) {
        logger.debug(`[JSON Utils] Transformed ${updated} rows in ${table}.${column}`);
    }

    return updated;
}

/**
 * Safely parse JSON with fallback to default
 * @param {string|null} jsonString - JSON string to parse
 * @param {*} defaultValue - Default value if parse fails
 * @returns {*} Parsed value or default
 */
function safeParseJson(jsonString, defaultValue = {}) {
    if (!jsonString) return defaultValue;

    try {
        return JSON.parse(jsonString);
    } catch (error) {
        logger.warn('[JSON Utils] Failed to parse JSON, using default');
        return defaultValue;
    }
}

module.exports = {
    deepMerge,
    isObject,
    mergeWithDefaults,
    addDefaultToJsonColumn,
    removeFromJsonColumn,
    transformJsonColumn,
    safeParseJson
};
