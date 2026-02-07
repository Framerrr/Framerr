/**
 * Structure Validation Script
 * 
 * Validates codebase structure during refactor phases.
 * Run: npm run validate-structure
 * 
 * Checks:
 * 1. File size limits (>25KB = error, >15KB = warning)
 * 2. Required folders exist
 * 3. Bundle size baseline tracking
 * 4. Circular dependency detection
 * 5. Naming convention validation
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

// ============================================
// Configuration
// ============================================

const CONFIG = {
    // File size thresholds (in bytes)
    SIZE_ERROR_THRESHOLD: 25 * 1024,   // 25KB
    SIZE_WARNING_THRESHOLD: 15 * 1024, // 15KB

    // Bundle size threshold (percentage increase from baseline)
    BUNDLE_SIZE_THRESHOLD: 0.10, // 10%

    // Directories to scan for file size
    SCAN_DIRS: ['src', 'server'],

    // Extensions to check
    CODE_EXTENSIONS: ['.ts', '.tsx', '.js', '.jsx'],

    // Directories to exclude
    EXCLUDE_DIRS: ['node_modules', 'dist', '.git', 'coverage', '__snapshots__'],

    // Required folders (target structure)
    REQUIRED_FOLDERS: [
        'src/widgets',
        'src/features',
        'src/shared',
        'server/routes',
        'server/db',
    ],

    // Baseline file location
    BASELINE_FILE: path.join(ROOT, '.structure-baseline.json'),
};

// ============================================
// Console Colors (ANSI)
// ============================================

const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    green: '\x1b[32m',
    cyan: '\x1b[36m',
    dim: '\x1b[2m',
    bold: '\x1b[1m',
};

function log(color, prefix, message) {
    console.log(`${color}${prefix}${colors.reset} ${message}`);
}

// ============================================
// Utility Functions
// ============================================

function getAllFiles(dir, extensions, exclude) {
    const files = [];

    function walk(currentDir) {
        if (!fs.existsSync(currentDir)) return;

        const entries = fs.readdirSync(currentDir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(currentDir, entry.name);
            const relativePath = path.relative(ROOT, fullPath);

            // Skip excluded directories
            if (exclude.some(ex => relativePath.includes(ex))) continue;

            if (entry.isDirectory()) {
                walk(fullPath);
            } else if (extensions.some(ext => entry.name.endsWith(ext))) {
                files.push({
                    path: fullPath,
                    relativePath,
                    name: entry.name,
                    size: fs.statSync(fullPath).size,
                });
            }
        }
    }

    walk(dir);
    return files;
}

function formatSize(bytes) {
    return `${(bytes / 1024).toFixed(1)}KB`;
}

function getDistSize() {
    const distPath = path.join(ROOT, 'dist');
    if (!fs.existsSync(distPath)) return null;

    let totalSize = 0;
    function walk(dir) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(fullPath);
            } else {
                totalSize += fs.statSync(fullPath).size;
            }
        }
    }
    walk(distPath);
    return totalSize;
}

// ============================================
// Check 1: File Size Limits
// ============================================

function checkFileSizes() {
    const errors = [];
    const warnings = [];

    for (const scanDir of CONFIG.SCAN_DIRS) {
        const dirPath = path.join(ROOT, scanDir);
        const files = getAllFiles(dirPath, CONFIG.CODE_EXTENSIONS, CONFIG.EXCLUDE_DIRS);

        for (const file of files) {
            if (file.size > CONFIG.SIZE_ERROR_THRESHOLD) {
                errors.push({
                    type: 'file-size',
                    severity: 'error',
                    path: file.relativePath,
                    message: `File exceeds 25KB limit: ${formatSize(file.size)}`,
                    size: file.size,
                });
            } else if (file.size > CONFIG.SIZE_WARNING_THRESHOLD) {
                warnings.push({
                    type: 'file-size',
                    severity: 'warning',
                    path: file.relativePath,
                    message: `File exceeds 15KB (consider splitting): ${formatSize(file.size)}`,
                    size: file.size,
                });
            }
        }
    }

    return { errors, warnings };
}

// ============================================
// Check 2: Required Folders
// ============================================

function checkRequiredFolders() {
    const errors = [];

    for (const folder of CONFIG.REQUIRED_FOLDERS) {
        const folderPath = path.join(ROOT, folder);
        if (!fs.existsSync(folderPath)) {
            errors.push({
                type: 'missing-folder',
                severity: 'error',
                path: folder,
                message: `Required folder missing: ${folder}`,
            });
        }
    }

    return { errors, warnings: [] };
}

// ============================================
// Check 3: Bundle Size Baseline
// ============================================

function checkBundleSize(setBaseline = false) {
    const errors = [];
    const warnings = [];

    const distSize = getDistSize();

    if (distSize === null) {
        warnings.push({
            type: 'bundle-size',
            severity: 'warning',
            path: 'dist/',
            message: 'No dist folder found. Run `npm run build` first for bundle size tracking.',
        });
        return { errors, warnings };
    }

    // Load or create baseline
    let baseline = null;
    if (fs.existsSync(CONFIG.BASELINE_FILE)) {
        baseline = JSON.parse(fs.readFileSync(CONFIG.BASELINE_FILE, 'utf-8'));
    }

    if (setBaseline) {
        const newBaseline = {
            bundleSize: distSize,
            timestamp: new Date().toISOString(),
        };
        fs.writeFileSync(CONFIG.BASELINE_FILE, JSON.stringify(newBaseline, null, 2));
        log(colors.green, '✓', `Baseline set: ${formatSize(distSize)}`);
        return { errors, warnings };
    }

    if (baseline) {
        const increase = (distSize - baseline.bundleSize) / baseline.bundleSize;
        if (increase > CONFIG.BUNDLE_SIZE_THRESHOLD) {
            warnings.push({
                type: 'bundle-size',
                severity: 'warning',
                path: 'dist/',
                message: `Bundle size increased ${(increase * 100).toFixed(1)}% (${formatSize(baseline.bundleSize)} → ${formatSize(distSize)})`,
            });
        }
    } else {
        warnings.push({
            type: 'bundle-size',
            severity: 'warning',
            path: 'dist/',
            message: `No baseline set. Run \`npm run validate-structure:baseline\` to set baseline.`,
        });
    }

    return { errors, warnings };
}

// ============================================
// Check 4: Circular Dependencies
// ============================================

function checkCircularDependencies() {
    const warnings = [];

    // Build import graph
    const importGraph = new Map(); // file -> [imported files]

    for (const scanDir of CONFIG.SCAN_DIRS) {
        const dirPath = path.join(ROOT, scanDir);
        const files = getAllFiles(dirPath, CONFIG.CODE_EXTENSIONS, CONFIG.EXCLUDE_DIRS);

        for (const file of files) {
            const content = fs.readFileSync(file.path, 'utf-8');
            const imports = [];

            // Match import statements
            const importRegex = /import\s+(?:[\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g;
            let match;
            while ((match = importRegex.exec(content)) !== null) {
                const importPath = match[1];
                // Only track relative imports
                if (importPath.startsWith('.')) {
                    const resolvedPath = resolveImport(file.path, importPath);
                    if (resolvedPath) {
                        imports.push(resolvedPath);
                    }
                }
            }

            importGraph.set(file.path, imports);
        }
    }

    // Detect cycles using DFS
    const visited = new Set();
    const recursionStack = new Set();
    const cycles = [];

    function detectCycle(node, nodePath = []) {
        if (recursionStack.has(node)) {
            // Found cycle - extract it
            const cycleStart = nodePath.indexOf(node);
            const cycle = nodePath.slice(cycleStart).map(p => path.relative(ROOT, p));
            cycles.push(cycle);
            return;
        }

        if (visited.has(node)) return;

        visited.add(node);
        recursionStack.add(node);

        const imports = importGraph.get(node) || [];
        for (const imported of imports) {
            detectCycle(imported, [...nodePath, node]);
        }

        recursionStack.delete(node);
    }

    for (const file of importGraph.keys()) {
        detectCycle(file);
    }

    // Deduplicate cycles
    const uniqueCycles = [];
    const seen = new Set();
    for (const cycle of cycles) {
        const key = [...cycle].sort().join('|');
        if (!seen.has(key)) {
            seen.add(key);
            uniqueCycles.push(cycle);
        }
    }

    for (const cycle of uniqueCycles) {
        warnings.push({
            type: 'circular-dependency',
            severity: 'warning',
            path: cycle[0],
            message: `Circular dependency: ${cycle.join(' → ')} → ${cycle[0]}`,
            cycle,
        });
    }

    return { errors: [], warnings };
}

function resolveImport(fromFile, importPath) {
    const dir = path.dirname(fromFile);
    let resolved = path.resolve(dir, importPath);

    // Try extensions
    for (const ext of CONFIG.CODE_EXTENSIONS) {
        if (fs.existsSync(resolved + ext)) {
            return resolved + ext;
        }
    }

    // Try index files
    for (const ext of CONFIG.CODE_EXTENSIONS) {
        const indexPath = path.join(resolved, `index${ext}`);
        if (fs.existsSync(indexPath)) {
            return indexPath;
        }
    }

    return null;
}

// ============================================
// Check 5: Naming Conventions
// ============================================

function checkNamingConventions() {
    const warnings = [];

    // Patterns for different file types
    const patterns = {
        // Components should be PascalCase
        component: /^[A-Z][a-zA-Z0-9]*\.tsx$/,
        // Hooks should be use + camelCase
        hook: /^use[A-Z][a-zA-Z0-9]*\.ts$/,
        // Utilities should be camelCase
        utility: /^[a-z][a-zA-Z0-9]*\.ts$/,
        // Types should end with .types.ts
        types: /\.types\.ts$/,
        // Config should end with .config.ts
        config: /\.config\.ts$/,
    };

    for (const scanDir of CONFIG.SCAN_DIRS) {
        const dirPath = path.join(ROOT, scanDir);
        const files = getAllFiles(dirPath, CONFIG.CODE_EXTENSIONS, CONFIG.EXCLUDE_DIRS);

        for (const file of files) {
            // Skip index files and test files
            if (file.name.startsWith('index.') || file.name.includes('.test.') || file.name.includes('.spec.')) {
                continue;
            }

            // Check hooks
            if (file.relativePath.includes('/hooks/') || file.relativePath.includes('\\hooks\\')) {
                if (!patterns.hook.test(file.name) && !file.name.startsWith('index.')) {
                    warnings.push({
                        type: 'naming',
                        severity: 'warning',
                        path: file.relativePath,
                        message: `Hook file should be named use*.ts: ${file.name}`,
                    });
                }
            }

            // Check components (tsx files not in hooks)
            if (file.name.endsWith('.tsx') && !file.relativePath.includes('hooks')) {
                if (!patterns.component.test(file.name)) {
                    warnings.push({
                        type: 'naming',
                        severity: 'warning',
                        path: file.relativePath,
                        message: `Component file should be PascalCase: ${file.name}`,
                    });
                }
            }
        }
    }

    return { errors: [], warnings };
}

// ============================================
// Main Runner
// ============================================

function main() {
    const args = process.argv.slice(2);
    const jsonOutput = args.includes('--json');
    const setBaseline = args.includes('--set-baseline');

    if (!jsonOutput) {
        console.log(`\n${colors.bold}📋 Structure Validation${colors.reset}\n`);
    }

    // Run all checks
    const results = {
        errors: [],
        warnings: [],
    };

    // Check 1: File sizes
    const sizeResults = checkFileSizes();
    results.errors.push(...sizeResults.errors);
    results.warnings.push(...sizeResults.warnings);

    // Check 2: Required folders
    const folderResults = checkRequiredFolders();
    results.errors.push(...folderResults.errors);
    results.warnings.push(...folderResults.warnings);

    // Check 3: Bundle size
    const bundleResults = checkBundleSize(setBaseline);
    results.errors.push(...bundleResults.errors);
    results.warnings.push(...bundleResults.warnings);

    // Check 4: Circular dependencies
    const circularResults = checkCircularDependencies();
    results.errors.push(...circularResults.errors);
    results.warnings.push(...circularResults.warnings);

    // Check 5: Naming conventions
    const namingResults = checkNamingConventions();
    results.errors.push(...namingResults.errors);
    results.warnings.push(...namingResults.warnings);

    // Output
    if (jsonOutput) {
        console.log(JSON.stringify(results, null, 2));
    } else {
        // Print errors
        if (results.errors.length > 0) {
            console.log(`${colors.red}${colors.bold}Errors (${results.errors.length})${colors.reset}\n`);
            for (const error of results.errors) {
                log(colors.red, '✗', `${error.path}`);
                console.log(`  ${colors.dim}${error.message}${colors.reset}`);
            }
            console.log();
        }

        // Print warnings
        if (results.warnings.length > 0) {
            console.log(`${colors.yellow}${colors.bold}Warnings (${results.warnings.length})${colors.reset}\n`);
            for (const warning of results.warnings) {
                log(colors.yellow, '⚠', `${warning.path}`);
                console.log(`  ${colors.dim}${warning.message}${colors.reset}`);
            }
            console.log();
        }

        // Summary
        if (results.errors.length === 0 && results.warnings.length === 0) {
            log(colors.green, '✓', 'All structure checks passed!');
        } else {
            console.log(`${colors.dim}Total: ${results.errors.length} errors, ${results.warnings.length} warnings${colors.reset}`);
        }
        console.log();
    }

    // Exit with error code if there are errors
    if (results.errors.length > 0) {
        process.exit(1);
    }
}

main();
