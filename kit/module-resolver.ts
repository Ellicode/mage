/**
 * Module resolver utils for handling app-specific and shared dependencies
 */

// Only import Node.js modules in Node.js environment
// This prevents "Dynamic require of 'fs' is not supported" errors in the browser
const isNode = typeof window === "undefined";

/**
 * Creates an app-aware require function that checks app-specific node_modules first,
 * then falls back to main app node_modules
 *
 * @param appScheme The app's scheme identifier
 * @param appRoot The root path of the application
 * @returns A require function that respects app-specific modules
 */
export function createAppAwareRequire(
    appScheme: string,
    appRoot: string
): NodeRequire {
    const baseRequire = createRequire(import.meta.url);

    // App specific node_modules path
    const appNodeModulesPath = path.join(
        appRoot,
        "apps",
        appScheme,
        "node_modules"
    );

    // Check if app has its own node_modules
    const hasAppNodeModules = fs.existsSync(appNodeModulesPath);

    // If no app-specific modules, just return the base require
    if (!hasAppNodeModules) {
        return baseRequire;
    }

    // Custom require function that tries app-specific node_modules first
    const appAwareRequire: NodeRequire = function (id: string) {
        try {
            // Try to resolve from app node_modules first
            const appRequire = createRequire(
                appNodeModulesPath + "/package.json"
            );
            return appRequire(id);
        } catch (error) {
            // Fall back to main app node_modules
            return baseRequire(id);
        }
    } as NodeRequire;

    // Copy properties from base require
    Object.setPrototypeOf(appAwareRequire, Object.getPrototypeOf(baseRequire));
    Object.defineProperties(
        appAwareRequire,
        Object.getOwnPropertyDescriptors(baseRequire)
    );

    return appAwareRequire;
}

/**
 * Temporarily modifies NODE_PATH to include app-specific node_modules
 *
 * @param appScheme The app's scheme identifier
 * @param appRoot The root path of the application
 * @param callback Function to execute with the modified NODE_PATH
 * @returns The result of the callback
 */
export async function withAppNodePath<T>(
    appScheme: string,
    appRoot: string,
    callback: () => Promise<T>
): Promise<T> {
    // App specific node_modules path
    const appNodeModulesPath = path.join(
        appRoot,
        "apps",
        appScheme,
        "node_modules"
    );

    // Check if app has its own node_modules
    const hasAppNodeModules = fs.existsSync(appNodeModulesPath);

    // If no app-specific modules, just execute the callback
    if (!hasAppNodeModules) {
        return callback();
    }

    // Store original NODE_PATH
    const originalNodePath = process.env.NODE_PATH || "";

    try {
        // Append app-specific node_modules to NODE_PATH
        process.env.NODE_PATH = `${appNodeModulesPath}${path.delimiter}${originalNodePath}`;

        // Update the module resolution paths
        require("module").Module._initPaths();

        // Execute callback with modified NODE_PATH
        return await callback();
    } finally {
        // Restore original NODE_PATH
        process.env.NODE_PATH = originalNodePath;

        // Update the module resolution paths
        require("module").Module._initPaths();
    }
}
