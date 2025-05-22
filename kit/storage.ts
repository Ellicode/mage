import { ref, onMounted, reactive } from "vue";

/**
 * Storage module for working with persistent data at app-level
 * @param appScheme The app's scheme identifier
 * @returns Storage utilities for persisting data
 */
export const useStorage = (appScheme: string) => {
    /**
     * Stores data in app's local storage
     * @param key Storage key
     * @param data Data to store
     */
    const setItem = (key: string, data: any): void => {
        try {
            const appPrefix = `app.${appScheme}`;
            const storageKey = `${appPrefix}.${key}`;
            localStorage.setItem(storageKey, JSON.stringify(data));
        } catch (error) {
            console.error(`Storage error (${appScheme}):`, error);
        }
    };

    /**
     * Retrieves data from app's local storage
     * @param key Storage key
     * @param defaultValue Default value if key not found
     * @returns Retrieved data or default value
     */
    const getItem = <T>(key: string, defaultValue: T): T => {
        try {
            const appPrefix = `app.${appScheme}`;
            const storageKey = `${appPrefix}.${key}`;
            const data = localStorage.getItem(storageKey);

            if (data === null) return defaultValue;
            return JSON.parse(data) as T;
        } catch (error) {
            console.error(`Storage error (${appScheme}):`, error);
            return defaultValue;
        }
    };

    /**
     * Removes an item from app's local storage
     * @param key Storage key to remove
     */
    const removeItem = (key: string): void => {
        try {
            const appPrefix = `app.${appScheme}`;
            const storageKey = `${appPrefix}.${key}`;
            localStorage.removeItem(storageKey);
        } catch (error) {
            console.error(`Storage error (${appScheme}):`, error);
        }
    };

    /**
     * Creates a reactive object that syncs with storage
     * @param key Storage key
     * @param defaultValue Default value
     * @returns A reactive object that auto-syncs with storage
     */
    const useStorageState = <T>(key: string, defaultValue: T) => {
        const state = ref<T>(getItem<T>(key, defaultValue));

        // Watch for changes and sync to storage
        const sync = () => {
            setItem(key, state.value);
        };

        return {
            state,
            sync,
        };
    };

    return {
        setItem,
        getItem,
        removeItem,
        useStorageState,
    };
};
