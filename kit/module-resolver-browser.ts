/**
 * Browser-compatible module resolver
 * This is a stub implementation of the module-resolver functionality for client-side use
 */

/**
 * Browser-safe stub for createAppAwareRequire
 * @param appScheme The app's scheme identifier
 * @param appRoot The root path of the application
 * @returns null in browser environment
 */
export function createAppAwareRequire(appScheme: string, appRoot: string): any {
    console.warn(
        "createAppAwareRequire is only available in Node.js environment"
    );
    return null;
}

/**
 * Browser-safe stub for withAppNodePath
 * Just runs the callback directly in browser environment
 *
 * @param appScheme The app's scheme identifier
 * @param appRoot The root path of the application
 * @param callback Function to execute
 * @returns The result of the callback
 */
export async function withAppNodePath<T>(
    appScheme: string,
    appRoot: string,
    callback: () => Promise<T>
): Promise<T> {
    return callback();
}
