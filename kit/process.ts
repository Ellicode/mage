import { Component } from "vue";

// Extend Window interface to include Electron properties
declare global {
    interface Window {
        ipcRenderer: any;
    }
}

// Instead of direct imports, use these conditionals to safely access Electron APIs
const electron = (() => {
    try {
        // When running in Electron, this will work
        return require("electron");
    } catch (e) {
        // When bundling with Vite/Webpack, return mock objects
        return {
            ipcRenderer: null,
            ipcMain: null,
        };
    }
})();

// Safe access to ipcRenderer and ipcMain
const ipcRenderer =
    electron?.ipcRenderer ||
    (typeof window !== "undefined" && window.ipcRenderer);
const ipcMain = electron?.ipcMain;

export interface BackgroundProcess<T = any> {
    id: number;
    name: string;
    appScheme: string;
    data: T;
    active: boolean;
    isClient: boolean;
    liveActivityComponent?: Component | string; // Can be component or string identifier
    shrinkedLiveActivityComponent?: Component | string; // Optional for shrinked state
    // Core method - only action is required
    action: (data: T) => void;
    // Optional standard methods
    pause?: () => void;
    resume?: () => void;
    // Custom methods
    [key: string]: any; // Allow any additional methods
}

// Component registry to keep references to components by name
// This allows us to serialize just the name and restore the actual component
export const componentRegistry: Record<string, Component> = {};

// Register a component for use with background processes
export const registerProcessComponent = (
    name: string,
    component: Component
) => {
    componentRegistry[name] = component;
    console.log(`Registered component: ${name}`);
    return name;
};

// Helper to make a process serializable for IPC
export const makeSerializable = (process: BackgroundProcess): any => {
    // If liveActivityComponent is a Component object, replace with its registered name
    let componentName: string | undefined;

    if (process.liveActivityComponent) {
        // Check if it's already a string (name)
        if (typeof process.liveActivityComponent === "string") {
            componentName = process.liveActivityComponent;
        } else {
            // Find the name for this component in the registry
            for (const [name, comp] of Object.entries(componentRegistry)) {
                if (comp === process.liveActivityComponent) {
                    componentName = name;
                    break;
                }
            }

            // If not found, register it with a unique name
            if (!componentName) {
                componentName = `component_${process.appScheme}_${
                    process.name
                }_${Date.now()}`;
                registerProcessComponent(
                    componentName,
                    process.liveActivityComponent
                );
            }
        }
    }

    // Extract method names but exclude standard properties and functions
    const methodNames = Object.keys(process).filter((key) => {
        return (
            typeof process[key] === "function" &&
            !["pause", "resume", "action"].includes(key)
        );
    });

    return {
        id: process.id,
        name: process.name,
        appScheme: process.appScheme,
        data: process.data,
        active: process.active,
        isClient: process.isClient,
        liveActivityComponentName: componentName,
        methodNames: methodNames, // Include list of available custom methods
        // We cannot include functions in IPC messages
    };
};

// Global registry to track all client processes across different appSchemes
const globalClientProcessRegistry: Record<string, BackgroundProcess[]> = {};

// Client-side process handler
export const clientProcessHandler = (appScheme: string) => {
    // Initialize the registry entry for this appScheme if it doesn't exist
    if (!globalClientProcessRegistry[appScheme]) {
        globalClientProcessRegistry[appScheme] = [];
    }

    // Get a reference to this appScheme's process list
    const clientProcesses = globalClientProcessRegistry[appScheme];
    let nextId = 1;

    return {
        createProcess: <T>(
            process: Omit<
                BackgroundProcess<T>,
                "id" | "appScheme" | "active" | "isClient"
            >
        ) => {
            // Create a base process with required properties
            const newProcess: BackgroundProcess<T> = {
                id: nextId++,
                appScheme,
                active: true,
                isClient: true,
                name: process.name,
                data: process.data,
                action: process.action,
                liveActivityComponent: process.liveActivityComponent,
            };

            // Add optional standard methods if they exist
            if (process.pause) {
                newProcess.pause = process.pause;
            }

            if (process.resume) {
                newProcess.resume = process.resume;
            }

            // Copy any additional methods from the process parameter
            for (const key of Object.keys(process)) {
                if (!(key in newProcess)) {
                    newProcess[key] = process[key];
                }
            }

            if (process.action) {
                process.action(process.data);
            }

            clientProcesses.push(newProcess); // Using the reference to the global registry

            // If there's a component, get or create its name in the registry
            let componentName: string | undefined;
            if (newProcess.liveActivityComponent) {
                if (typeof newProcess.liveActivityComponent === "string") {
                    componentName = newProcess.liveActivityComponent;
                } else {
                    componentName = registerProcessComponent(
                        `component_${appScheme}_${
                            newProcess.name
                        }_${Date.now()}`,
                        newProcess.liveActivityComponent
                    );
                    newProcess.liveActivityComponent = componentName; // Store the name reference
                }
            }

            // Notify main process about the new background process
            if (ipcRenderer && typeof ipcRenderer.send === "function") {
                const serialized = makeSerializable(newProcess);
                ipcRenderer.send("register-background-process", serialized);
            }

            console.log(
                `Client process created: ${newProcess.name} (${newProcess.id})`
            );
            return newProcess;
        },

        getProcesses: () => {
            return clientProcesses;
        },
        pauseProcess: (id: number) => {
            const process = clientProcesses.find((p) => p.id === id);
            if (process) {
                process.active = false;
                // Only call pause if it exists
                if (typeof process.pause === "function") {
                    process.pause();
                }
                return true;
            }
            return false;
        },

        resumeProcess: (id: number) => {
            const process = clientProcesses.find((p) => p.id === id);
            if (process) {
                process.active = true;
                // Only call resume if it exists
                if (typeof process.resume === "function") {
                    process.resume();
                }
                return true;
            }
            return false;
        },
        removeProcess: (id: number) => {
            const index = clientProcesses.findIndex((p) => p.id === id);
            if (index !== -1) {
                const process = clientProcesses[index];
                if (process.active && typeof process.pause === "function") {
                    process.pause();
                }
                clientProcesses.splice(index, 1);

                // Notify main process to remove the process
                if (ipcRenderer && typeof ipcRenderer.send === "function") {
                    ipcRenderer.send("remove-background-process", { id });
                }

                console.log(
                    `Client process removed: ${process.name} (${process.id})`
                );
                return true;
            }
            return false;
        },

        // New method to call any custom method on a process
        callMethod: (id: number, methodName: string, ...args: any[]) => {
            const process = clientProcesses.find((p) => p.id === id);
            if (process && typeof process[methodName] === "function") {
                try {
                    return process[methodName](...args);
                } catch (error) {
                    console.error(`Error calling method ${methodName}:`, error);
                    return null;
                }
            }
            console.warn(`Method ${methodName} not found on process ${id}`);
            return null;
        },
    };
};

// Helper function to get all client processes for debugging
export const getAllClientProcesses = () => {
    // Collect all processes from the global registry
    let allProcesses: BackgroundProcess[] = [];

    Object.keys(globalClientProcessRegistry).forEach((scheme) => {
        try {
            const processes = globalClientProcessRegistry[scheme];
            if (processes && processes.length > 0) {
                console.log(
                    `Found ${processes.length} processes for scheme ${scheme}`
                );
                allProcesses = [...allProcesses, ...processes];
            }
        } catch (error) {
            console.error(`Error getting processes for ${scheme}:`, error);
        }
    });

    console.log(`Total client processes found: ${allProcesses.length}`);
    return allProcesses;
};

// Server-side (Electron main process) handler
export const backgroundProcessHandler = (appScheme: string) => {
    // This will be registered in the main process
    const registerMainProcessHandlers = () => {
        if (!ipcMain) return;

        ipcMain.on(
            "register-background-process",
            (event: any, process: any) => {
                // Main process can track client processes here
                // This allows main to know which processes are running in renderer
                console.log(
                    `Process registered: ${process.name} (${process.id})`
                );
            }
        );

        ipcMain.on(
            "remove-background-process",
            (event: any, { id }: { id: number }) => {
                console.log(`Process removed: ${id}`);
            }
        );
    }; // Register handlers when in main process
    if (ipcMain && typeof ipcMain.on === "function") {
        registerMainProcessHandlers();
        // Register handler for custom method calls
        ipcMain.handle(
            "call-process-method",
            async (
                event: any,
                params: { id: number; methodName: string; args: any[] }
            ) => {
                const { id, methodName, args } = params;
                console.log(
                    `Attempting to call method ${methodName} on process ${id}`
                );
                // Find the process in the main process registry
                // This would need to be implemented in the main process
                return null; // Placeholder - should be implemented in main process
            }
        );
    }

    return {
        createProcess: <T>(
            process: Omit<
                BackgroundProcess<T>,
                "id" | "appScheme" | "active" | "isClient"
            >
        ) => {
            // This implementation will be completed in main process
            // It will interact with the global processes array
            // Since we're in a module, we'll use IPC to communicate with the main process
            if (ipcRenderer && typeof ipcRenderer.invoke === "function") {
                return ipcRenderer.invoke("create-main-background-process", {
                    appScheme,
                    ...process,
                    // Serialize the component if it exists
                    liveActivityComponent: process.liveActivityComponent
                        ? // If it's a string (reference), pass it directly
                          typeof process.liveActivityComponent === "string"
                            ? process.liveActivityComponent
                            : // Otherwise, generate a new reference
                              registerProcessComponent(
                                  `component_${appScheme}_${
                                      process.name
                                  }_${Date.now()}`,
                                  process.liveActivityComponent
                              )
                        : undefined,
                });
            }

            return null;
        },

        getProcesses: () => {
            if (ipcRenderer && typeof ipcRenderer.invoke === "function") {
                return ipcRenderer.invoke("get-main-background-processes", {
                    appScheme,
                });
            }

            return [];
        },

        pauseProcess: (id: number) => {
            if (ipcRenderer && typeof ipcRenderer.invoke === "function") {
                return ipcRenderer.invoke("pause-main-background-process", {
                    id,
                });
            }

            return false;
        },

        resumeProcess: (id: number) => {
            if (ipcRenderer && typeof ipcRenderer.invoke === "function") {
                return ipcRenderer.invoke("resume-main-background-process", {
                    id,
                });
            }

            return false;
        },
        removeProcess: (id: number) => {
            if (ipcRenderer && typeof ipcRenderer.invoke === "function") {
                return ipcRenderer.invoke("remove-main-background-process", {
                    id,
                });
            }

            return false;
        },

        // New method to call a custom method on a background process
        callMethod: (id: number, methodName: string, ...args: any[]) => {
            if (ipcRenderer && typeof ipcRenderer.invoke === "function") {
                return ipcRenderer.invoke("call-process-method", {
                    id,
                    methodName,
                    args,
                });
            }

            return null;
        },
    };
};
