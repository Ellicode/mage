/**
 * Batteries-included SDK for Mage app development
 * This module provides a unified interface for all SDK functionality
 */
import { ref, watch, computed, onMounted, onBeforeUnmount } from "vue";

// Re-export all the SDK components
export * from "./process";
export * from "./execute";
export * from "./security";
export * from "./storage";

// Re-export UI components with proper typing
export { default as BlankSlate } from "./components/BlankSlate.vue";
export { default as Button } from "./components/Button.vue";
export { default as ListItem } from "./components/ListItem.vue";
export { default as SearchBar } from "./components/SearchBar.vue";
export { default as SplitView } from "./components/SplitView.vue";
export { default as StatusBar } from "./components/StatusBar.vue";
export { default as KeybindAction } from "./components/KeybindAction.vue";
/**
 * Gets relative path from app to resource
 * @param appScheme The app's scheme identifier (e.g. 'com.example.app')
 * @param path The path to the resource relative to the app's root
 * @returns The properly formatted relative path
 */
export const getAppResourcePath = (appScheme: string, path: string): string => {
    // Remove any leading slashes
    const cleanPath = path.replace(/^[\/\\]+/, "");
    return `./apps/${appScheme}/${cleanPath}`;
};

/**
 * Gets relative path to assets directory
 * @param appScheme The app's scheme identifier (e.g. 'com.example.app')
 * @param assetPath The path to the asset relative to the assets directory
 * @returns The properly formatted relative path to the asset
 */
export const getAssetPath = (appScheme: string, assetPath: string): string => {
    // Remove any leading slashes
    const cleanPath = assetPath.replace(/^[\/\\]+/, "");
    return getAppResourcePath(appScheme, `assets/${cleanPath}`);
};

/**
 * Creates a debounced version of a function
 * @param func The function to debounce
 * @param wait The debounce wait time in milliseconds
 * @returns A debounced function
 */
export const debounce = <T extends (...args: any[]) => any>(
    func: T,
    wait: number
): ((...args: Parameters<T>) => void) => {
    let timeout: ReturnType<typeof setTimeout> | null = null;

    return function (this: any, ...args: Parameters<T>) {
        const context = this;
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
};

/**
 * Creates a throttled version of a function
 * @param func The function to throttle
 * @param limit The minimum time between function calls in milliseconds
 * @returns A throttled function
 */
export const throttle = <T extends (...args: any[]) => any>(
    func: T,
    limit: number
): ((...args: Parameters<T>) => void) => {
    let lastCall = 0;

    return function (this: any, ...args: Parameters<T>) {
        const context = this;
        const now = Date.now();

        if (now - lastCall >= limit) {
            lastCall = now;
            func.apply(context, args);
        }
    };
};

/**
 * Custom hook to handle an interval in Vue components
 * @param callback Function to execute periodically
 * @param delay Delay in milliseconds
 * @returns Object with control functions
 */
export const useInterval = (callback: () => void, delay: number) => {
    const savedCallback = ref<() => void>(callback);
    const intervalId = ref<number | null>(null);

    const start = () => {
        if (intervalId.value === null) {
            intervalId.value = window.setInterval(
                () => savedCallback.value(),
                delay
            );
        }
    };

    const stop = () => {
        if (intervalId.value !== null) {
            clearInterval(intervalId.value);
            intervalId.value = null;
        }
    };

    onMounted(() => {
        savedCallback.value = callback;
        start();
    });

    onBeforeUnmount(() => {
        stop();
    });

    return { start, stop };
};

/**
 * Delay execution for the specified milliseconds
 * @param ms Milliseconds to delay
 * @returns Promise that resolves after the delay
 */
export const sleep = (ms: number): Promise<void> => {
    return new Promise((resolve) => setTimeout(resolve, ms));
};
