import {
    app,
    BrowserWindow,
    shell,
    ipcMain,
    globalShortcut,
    nativeImage,
} from "electron";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";
import { readFileSync } from "node:fs";
import { getInstalledApps } from "get-installed-apps";
import fs from "node:fs";
import { exec } from "child_process";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

let installedApps = [];
// The built directory structure
//
// ├─┬ dist-electron
// │ ├─┬ main
// │ │ └── index.js    > Electron-Main
// │ └─┬ preload
// │   └── index.mjs   > Preload-Scripts
// ├─┬ dist
// │ └── index.html    > Electron-Renderer
//
process.env.APP_ROOT = path.join(__dirname, "../..");

export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
    ? path.join(process.env.APP_ROOT, "public")
    : RENDERER_DIST;

// Disable GPU Acceleration for Windows 7
if (os.release().startsWith("6.1")) app.disableHardwareAcceleration();

// Set application name for Windows 10+ notifications
if (process.platform === "win32") app.setAppUserModelId(app.getName());

if (!app.requestSingleInstanceLock()) {
    app.quit();
    process.exit(0);
}

let win: BrowserWindow | null = null;
const preload = path.join(__dirname, "../preload/index.mjs");
const indexHtml = path.join(RENDERER_DIST, "index.html");

let isMenuOpen = false;

import { BackgroundProcess } from "../../kit/process";
// Array to store all background processes
let currentProcesses: BackgroundProcess[] = [];
let nextProcessId = 1;

interface InstalledApp {
    appIdentifier: string;
    "Inno Setup: Setup Version"?: string;
    "Inno Setup: App Path"?: string;
    InstallLocation?: string;
    "Inno Setup: Icon Group"?: string;
    "Inno Setup: User"?: string;
    "Inno Setup: Selected Tasks"?: string;
    "Inno Setup: Deselected Tasks"?: string;
    "Inno Setup: Language"?: string;
    DisplayName?: string;
    appName?: string;
    DisplayIcon?: string;
    UninstallString?: string;
    QuietUninstallString?: string;
    DisplayVersion?: string;
    appVersion?: string;
    Publisher?: string;
    appPublisher?: string;
    URLInfoAbout?: string;
    HelpLink?: string;
    URLUpdateInfo?: string;
    NoModify?: string;
    NoRepair?: string;
    InstallDate?: string;
    appInstallDate?: string;
    MajorVersion?: string;
    MinorVersion?: string;
    VersionMajor?: string;
    VersionMinor?: string;
    EstimatedSize?: string;
}

// Add a proper shutdown function
function cleanupAndExit() {
    // Unregister all global shortcuts
    globalShortcut.unregisterAll();

    // Clean up all background processes
    for (const process of currentProcesses) {
        if (process.active && typeof process.pause === "function") {
            try {
                process.pause();
            } catch (err) {
                console.error(`Error pausing process ${process.id}:`, err);
            }
        }
    }

    // Clear the processes array
    currentProcesses = [];

    // Close all windows
    if (win !== null) {
        win.removeAllListeners();
        win = null;
    }
}

async function createWindow() {
    win = new BrowserWindow({
        title: "Main window",
        icon: path.join(process.env.VITE_PUBLIC, "favicon.ico"),
        webPreferences: {
            preload,
            // Warning: Enable nodeIntegration and disable contextIsolation is not secure in production
            // nodeIntegration: true,

            // Consider using contextBridge.exposeInMainWorld
            // Read more on https://www.electronjs.org/docs/latest/tutorial/context-isolation
            // contextIsolation: false,
        },
        frame: false,
        fullscreen: true,
        resizable: false,
        skipTaskbar: true,
        transparent: true,
    });

    if (VITE_DEV_SERVER_URL) {
        // #298
        win.loadURL(VITE_DEV_SERVER_URL);
        // Open devTool if the app is not packaged
    } else {
        win.loadFile(indexHtml);
    }
    win.setAlwaysOnTop(true, "screen-saver");
    win.setIgnoreMouseEvents(true);
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    // Test actively push message to the Electron-Renderer
    win.webContents.on("did-finish-load", async () => {
        win?.webContents.send(
            "main-process-message",
            new Date().toLocaleString()
        );

        // Get installed apps
        getInstalledApps()
            .then(async (apps: []) => {
                const appPromises = apps.map(
                    async (application: InstalledApp) => {
                        const name =
                            application.DisplayName || application.appName;
                        const publisher =
                            application.Publisher || application.appPublisher;
                        const version =
                            application.DisplayVersion ||
                            application.appVersion;
                        const identifier = application.appIdentifier;
                        let path = null; // Initialize as null by default
                        if (application.DisplayIcon) {
                            path = application.DisplayIcon.split(",")[0].trim();
                        } else if (application.InstallLocation) {
                            // Try to find executable file in InstallLocation
                            // List of common executable extensions to check
                            const exeExtensions = [
                                ".exe",
                                ".com",
                                ".bat",
                                ".cmd",
                            ];

                            // Try to find a file with executable extension directly in the InstallLocation
                            try {
                                const files = fs.readdirSync(
                                    application.InstallLocation
                                );
                                // Filter for executable files that don't contain banned words
                                const executableFiles = files.filter((file) => {
                                    const ext = path
                                        .extname(file)
                                        .toLowerCase();
                                    const fileName = file.toLowerCase();
                                    return (
                                        exeExtensions.includes(ext) &&
                                        !fileName.includes("uninstall") &&
                                        !fileName.includes("setup") &&
                                        !fileName.includes("update")
                                    );
                                });

                                // Use the first valid executable found
                                if (executableFiles.length > 0) {
                                    path = path
                                        .join(
                                            application.InstallLocation,
                                            executableFiles[0]
                                        )
                                        .split(",")[0]
                                        .trim();
                                }
                            } catch (error) {
                                console.error(
                                    `Error finding executable for ${
                                        application.DisplayName ||
                                        application.appName
                                    }:`,
                                    error
                                );
                            }
                        }

                        // Create an app icon as base64 if path exists
                        let appIcon = null;
                        if (path) {
                            try {
                                // Use optional electron API for extracting icons from executables
                                // This is more reliable than just linking to the executable
                                const icon = await app.getFileIcon(path, {
                                    size: "normal",
                                });
                                const iconData = icon
                                    .toPNG()
                                    .toString("base64");
                                appIcon = `data:image/png;base64,${iconData}`;
                            } catch (error) {
                                console.error(
                                    `Failed to extract icon from ${path}:`,
                                    error
                                );
                                // Fallback to file URL if icon extraction fails
                                appIcon = `file://${path.split(",")[0].trim()}`;
                            }
                        } else {
                            return null; // Skip if no path is found
                        }

                        return {
                            name,
                            publisher,
                            version,
                            identifier,
                            path,
                            appIcon,
                        };
                    }
                );

                // Wait for all promises to resolve and filter out null values
                installedApps = (await Promise.all(appPromises)).filter(
                    (app) => app !== null
                );
                console.log("Installed Apps:", installedApps);
            })
            .catch((error) => {
                console.error("Error getting installed apps:", error);
                installedApps = [];
            });
    });

    // Prevent Escape key from closing the window
    win.webContents.on("before-input-event", (event, input) => {
        // Only prevent default f r Escape if it would close the window
        // but still allow the event to be handled in the renderer
        if (input.key === "Escape") {
            // We don't call preventDefault() here, as it would stop the event
            // from reaching the renderer process

            // Instead, handle this at the window level
            win.setClosable(false);
            // Re-enable closing after the key event is processed
            setTimeout(() => {
                if (win) win.setClosable(true);
            }, 100);
        }
    });
    ipcMain.on("ui-toggle-menu", (event, arg) => {
        isMenuOpen = arg;
        win.setIgnoreMouseEvents(!isMenuOpen, { forward: true });
    });

    ipcMain.handle("search", async (event, arg) => {
        try {
            const registry = readFileSync(
                path.join(process.env.APP_ROOT, "apps", "registry.json"),
                "utf-8"
            );
            const data = JSON.parse(registry);
            const allApps = data.installedApps.map((app: string) => {
                try {
                    const manifest = readFileSync(
                        path.join(
                            process.env.APP_ROOT,
                            "apps",
                            app,
                            "application.json"
                        ),
                        "utf-8"
                    );
                    return JSON.parse(manifest);
                } catch (err) {
                    console.error(
                        `Error reading manifest for app ${app}:`,
                        err
                    );
                    return { intents: [] }; // Return empty app on error
                }
            });
            let allIntents = [];
            allApps.forEach((app) => {
                if (app.intents && Array.isArray(app.intents)) {
                    allIntents = allIntents.concat(
                        app.intents.map((intent) => {
                            // Destructure app to separate intents from other properties
                            const { intents, ...appWithoutIntents } = app;
                            return {
                                application: appWithoutIntents,
                                ...intent,
                            };
                        })
                    );
                }
            });

            if (Array.isArray(installedApps)) {
                installedApps.forEach((app) => {
                    if (app && app.name) {
                        // Destructure app to separate intents from other properties
                        allIntents.push({
                            application: {
                                name: app.name,
                                icon: {
                                    type: "image",
                                    value: app.appIcon,
                                },
                                appScheme: app.identifier,
                            },
                            type: "openApp",
                            appPath: app.path,
                            name: app.name,
                            description: app.publisher,
                            aliases: [app.name],
                        });
                    }
                });
            }

            const returnData = allIntents
                .filter((intent) => {
                    // Check if the search matches the intent name
                    const nameMatch = intent.name
                        .toLowerCase()
                        .includes(arg.toLowerCase());

                    // Check if the search matches any of the aliases (if they exist)
                    const aliasMatch =
                        intent.aliases &&
                        intent.aliases.some((alias: string) =>
                            alias.toLowerCase().includes(arg.toLowerCase())
                        );

                    // Return true if either name or any alias matches
                    return nameMatch || aliasMatch;
                })
                .slice(0, 5); // Limit to 5 results

            return returnData;
        } catch (err) {
            console.error("Error in search handler:", err);
            return []; // Return empty array on error
        }
    });

    ipcMain.on("open-app", (event, arg) => {
        const executablePath = arg.appPath;
        if (executablePath) {
            try {
                exec(`"${executablePath}"`, (error, stdout, stderr) => {
                    if (error) {
                        console.error(`Error opening application: ${error}`);
                        return;
                    }
                    if (stderr) {
                        console.error(`Application stderr: ${stderr}`);
                    }
                    if (stdout) {
                        console.log(`Application stdout: ${stdout}`);
                    }
                });
            } catch (error) {
                console.error("Failed to open application:", error);
            }
        }
    });

    // Make all links open with the browser, not with the application
    win.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith("https:")) shell.openExternal(url);
        return { action: "deny" };
    });
    // win.webContents.on('will-navigate', (event, url) => { }) #344
}

app.whenReady()
    .then(() => {
        globalShortcut.register("Alt+CommandOrControl+Space", () => {
            isMenuOpen = !isMenuOpen;
            if (win) {
                win.setIgnoreMouseEvents(!isMenuOpen, { forward: true });
                win.webContents.send("toggle-menu", isMenuOpen);
                win.focus();
            }
        });
    })
    .then(createWindow);

app.on("window-all-closed", () => {
    cleanupAndExit();
    if (process.platform !== "darwin") app.quit();
});

app.on("second-instance", () => {
    if (win) {
        // Focus on the main window if the user tried to open another
        if (win.isMinimized()) win.restore();
        win.focus();
    }
});

app.on("activate", () => {
    const allWindows = BrowserWindow.getAllWindows();
    if (allWindows.length) {
        allWindows[0].focus();
    } else {
        createWindow();
    }
});

app.on("will-quit", () => {
    cleanupAndExit();
});

app.on("quit", () => {
    cleanupAndExit();
});

// Background process management handlers
ipcMain.handle("create-main-background-process", (_, processData) => {
    const { appScheme, name, data, liveActivityComponent } = processData;

    // Create a new background process in the main process
    const process: BackgroundProcess = {
        id: nextProcessId++,
        name,
        appScheme,
        data,
        active: true,
        isClient: false,
        // Store component name reference if provided
        liveActivityComponent: liveActivityComponent,
        // These functions won't run in main process, but we keep the structure
        action: () => console.log(`Main process action for: ${name}`),
        pause: () => console.log(`Main process pause for: ${name}`),
        resume: () => console.log(`Main process resume for: ${name}`),
    };

    currentProcesses.push(process);
    console.log(`Created main process: ${name} (${process.id})`);

    // Notify renderer process about the background process update
    if (win) {
        // Create a serializable version without functions for IPC
        const serializableProcess = {
            id: process.id,
            name: process.name,
            appScheme: process.appScheme,
            data: process.data,
            active: process.active,
            isClient: process.isClient,
            liveActivityComponentName: liveActivityComponent, // Use the component name
        };

        win.webContents.send("background-process-update", {
            type: "added",
            process: serializableProcess,
        });
    }

    // Return a serializable version for the IPC response
    return {
        id: process.id,
        name: process.name,
        appScheme: process.appScheme,
        data: process.data,
        active: process.active,
        isClient: process.isClient,
        liveActivityComponentName: liveActivityComponent, // Use the component name
    };
});

ipcMain.handle("get-main-background-processes", (_, { appScheme } = {}) => {
    // Create serializable version of processes by excluding function properties
    // and handling the component references
    const serializableProcesses = currentProcesses.map((p) => ({
        id: p.id,
        name: p.name,
        appScheme: p.appScheme,
        data: p.data,
        active: p.active,
        isClient: p.isClient,
        liveActivityComponentName: p.liveActivityComponent, // Component name reference
    }));

    // Filter processes by app scheme if provided
    if (appScheme) {
        return serializableProcesses.filter((p) => p.appScheme === appScheme);
    }
    return serializableProcesses;
});

ipcMain.handle("pause-main-background-process", (_, { id }) => {
    const process = currentProcesses.find((p) => p.id === id);
    if (process) {
        process.active = false;

        // Only call pause if it exists
        if (typeof process.pause === "function") {
            process.pause();
        }

        // Notify renderer about state change
        if (win) {
            win.webContents.send("background-process-update", {
                type: "paused",
                id,
            });
        }

        return true;
    }
    return false;
});

ipcMain.handle("resume-main-background-process", (_, { id }) => {
    const process = currentProcesses.find((p) => p.id === id);
    if (process) {
        process.active = true;

        // Only call resume if it exists
        if (typeof process.resume === "function") {
            process.resume();
        }

        // Notify renderer about state change
        if (win) {
            win.webContents.send("background-process-update", {
                type: "resumed",
                id,
            });
        }

        return true;
    }
    return false;
});

ipcMain.handle("remove-main-background-process", (_, { id }) => {
    const index = currentProcesses.findIndex((p) => p.id === id);
    if (index !== -1) {
        const process = currentProcesses[index];
        if (process.active && typeof process.pause === "function") {
            process.pause();
        }
        currentProcesses.splice(index, 1);

        // Notify renderer about removal
        if (win) {
            win.webContents.send("background-process-update", {
                type: "removed",
                id,
            });
        }

        return true;
    }
    return false;
});

// Handle custom method calls on background processes
ipcMain.handle("call-process-method", (_, { id, methodName, args }) => {
    const process = currentProcesses.find((p) => p.id === id);

    if (process && typeof process[methodName] === "function") {
        try {
            console.log(`Calling method ${methodName} on process ${id}`);

            // Call the method with the provided arguments
            const result = process[methodName](...(args || []));

            // If the result is a Promise, return it
            if (result instanceof Promise) {
                return result;
            }

            return result;
        } catch (error) {
            console.error(
                `Error calling method ${methodName} on process ${id}:`,
                error
            );
            return { error: `Failed to call method: ${error.message}` };
        }
    } else {
        console.warn(`Method ${methodName} not found on process ${id}`);
        return { error: `Method ${methodName} not found on process ${id}` };
    }
});

// Track background processes from renderer process
ipcMain.on("register-background-process", (_, process) => {
    // Notify UI about the client process update
    if (win) {
        win.webContents.send("client-process-updated", {
            type: "added",
            process,
        });
    }
});

ipcMain.on("remove-background-process", (_, { id }) => {
    console.log(`Renderer process removed: ${id}`);

    // Notify UI about the client process update
    if (win) {
        win.webContents.send("client-process-updated", {
            type: "removed",
            id,
        });
    }
});

// Handle direct client process update notifications
ipcMain.on("client-process-updated", (_, data) => {
    console.log("Client process update notification:", data);

    // Forward to the renderer
    if (win) {
        win.webContents.send("client-process-updated", data);
    }
});

// New window example arg: new windows url
ipcMain.handle("open-win", (_, arg) => {
    const childWindow = new BrowserWindow({
        webPreferences: {
            preload,
            nodeIntegration: true,
            contextIsolation: false,
        },
    });

    if (VITE_DEV_SERVER_URL) {
        childWindow.loadURL(`${VITE_DEV_SERVER_URL}#${arg}`);
    } else {
        childWindow.loadFile(indexHtml, { hash: arg });
    }
});
