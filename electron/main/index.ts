import {
    app,
    BrowserWindow,
    shell,
    ipcMain,
    globalShortcut,
    nativeImage,
    Tray,
} from "electron";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import pathModule from "node:path";
import os from "node:os";
import { readFileSync, writeFileSync } from "node:fs";
import { getInstalledApps } from "get-installed-apps";
import fs from "node:fs";
import { exec } from "child_process";
import process from "node:process";
import dns from "node:dns";
import https from "node:https";
import geoip from "geoip-lite";

const require = createRequire(import.meta.url);
const __dirname = pathModule.dirname(fileURLToPath(import.meta.url));

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
process.env.APP_ROOT = pathModule.join(__dirname, "../..");

export const MAIN_DIST = pathModule.join(process.env.APP_ROOT, "dist-electron");
export const RENDERER_DIST = pathModule.join(process.env.APP_ROOT, "dist");
export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
    ? pathModule.join(process.env.APP_ROOT, "public")
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
const preload = pathModule.join(__dirname, "../preload/index.mjs");
const indexHtml = pathModule.join(RENDERER_DIST, "index.html");

let isMenuOpen = false;

// Add tracking for app loading process
let appLoadingInProgress = false;
let appLoadAbortController = null;

import { BackgroundProcess } from "../../kit/process";
// Array to store all background processes
let currentProcesses: BackgroundProcess[] = [];
let nextProcessId = 1;
let defaultApps = [];

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

// Add improved shutdown handling for development mode
function handleDevModeShutdown() {
    if (process.env.NODE_ENV === "development" || VITE_DEV_SERVER_URL) {
        process.on("SIGTERM", () => {
            console.log("Received SIGTERM signal, cleaning up...");
            cleanupAndExit();
            process.exit(0);
        });

        process.on("SIGINT", () => {
            console.log("Received SIGINT signal, cleaning up...");
            cleanupAndExit();
            process.exit(0);
        });

        process.on("exit", () => {
            console.log("Process exiting, final cleanup...");
            cleanupAndExit();
        });

        process.on("uncaughtException", (err) => {
            console.error("Uncaught exception:", err);
            cleanupAndExit();
            process.exit(1);
        });
    }
}

// Enhance cleanup function to be more thorough
function cleanupAndExit() {
    console.log("Performing application cleanup...");

    try {
        // Abort any ongoing app loading
        if (appLoadingInProgress && appLoadAbortController) {
            console.log("Aborting in-progress app loading");
            appLoadAbortController.abort();
            appLoadingInProgress = false;
            appLoadAbortController = null;
        }

        // Unregister all global shortcuts
        globalShortcut.unregisterAll();
        console.log("Global shortcuts unregistered");

        // Clean up all background processes
        currentProcesses.forEach((process) => {
            try {
                if (process.active && typeof process.pause === "function") {
                    process.pause();
                }
            } catch (err) {
                console.error(`Error pausing process ${process.id}:`, err);
            }
        });
        console.log(`${currentProcesses.length} background processes cleaned`);
        currentProcesses = [];

        // Destroy all windows properly
        if (win !== null) {
            console.log("Closing main window...");
            try {
                win.removeAllListeners();
                win.webContents.removeAllListeners();
                if (!win.isDestroyed()) {
                    win.close();
                }
            } catch (error) {
                console.error("Error closing window:", error);
            }
            win = null;
        }

        // Close any other windows
        const allWindows = BrowserWindow.getAllWindows();
        console.log(`Closing ${allWindows.length} additional windows...`);
        allWindows.forEach((window) => {
            try {
                if (!window.isDestroyed()) {
                    window.close();
                }
            } catch (error) {
                console.error("Error closing extra window:", error);
            }
        });

        console.log("Cleanup complete");
    } catch (error) {
        console.error("Error during cleanup:", error);
    }
}

async function createWindow() {
    win = new BrowserWindow({
        title: "Main window",
        icon: pathModule.join(process.env.VITE_PUBLIC, "favicon.ico"),
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

        // Get installed apps with better error handling and abortion capability
        loadInstalledApps().catch((error) => {
            console.error("Error in loadInstalledApps:", error);
        });
    });

    // Prevent Escape key from closing the window
    win.webContents.on("before-input-event", (event, input) => {
        // Only prevent default for Escape if it would close the window
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
    ipcMain.handle(
        "executeServerSideScript",
        async (event, { file, args, appScheme }) => {
            try {
                console.log(
                    `Executing server-side script: ${file} with args:`,
                    args
                );

                // Support relative paths by ensuring proper structure
                const normalizedFile = file
                    .replace(/\\/g, "/")
                    .replace(/^\.?\/+/, "");

                // Create the absolute path to the script file
                const scriptAbsolutePath = pathModule.join(
                    process.env.APP_ROOT,
                    "apps",
                    appScheme,
                    normalizedFile + ".js"
                );

                // Convert to a proper file:// URL for ES module import
                const fileUrl = `file:///${scriptAbsolutePath
                    .replace(/\\/g, "/")
                    .replace(/^([a-zA-Z]):/, "$1:")}`;

                // Also check if a TypeScript version exists (for error reporting)
                const tsScriptPath = pathModule.join(
                    process.env.APP_ROOT,
                    "apps",
                    appScheme,
                    normalizedFile + ".ts"
                );

                if (!fs.existsSync(scriptAbsolutePath)) {
                    // If JS file doesn't exist but TS file does, provide a helpful error
                    if (fs.existsSync(tsScriptPath)) {
                        throw new Error(
                            `Found TypeScript file at ${tsScriptPath} but expected compiled JavaScript file at ${scriptAbsolutePath}. Please compile your TypeScript files.`
                        );
                    } else {
                        throw new Error(
                            `Script file not found: ${scriptAbsolutePath}`
                        );
                    }
                }
                console.log(`Importing script from: ${fileUrl}`);

                // Check for app-specific node_modules
                const appNodeModulesPath = pathModule.join(
                    process.env.APP_ROOT,
                    "apps",
                    appScheme,
                    "node_modules"
                );

                // Check if app has its own node_modules
                const hasAppNodeModules = fs.existsSync(appNodeModulesPath);

                // Import the module with custom NODE_PATH handling if needed
                let scriptModule;
                if (hasAppNodeModules) {
                    console.log(
                        `Found app-specific node_modules for ${appScheme}`
                    );

                    // Store original NODE_PATH
                    const originalNodePath = process.env.NODE_PATH || "";
                    try {
                        // Add app-specific modules path to NODE_PATH
                        process.env.NODE_PATH = `${appNodeModulesPath}${pathModule.delimiter}${originalNodePath}`;
                        // Update module resolution
                        require("module").Module._initPaths();

                        // Import with enhanced module resolution
                        scriptModule = await import(fileUrl);
                    } finally {
                        // Restore original NODE_PATH
                        process.env.NODE_PATH = originalNodePath;
                        // Update module resolution back to original
                        require("module").Module._initPaths();
                    }
                } else {
                    // Standard import with default module resolution
                    scriptModule = await import(fileUrl);
                }

                if (typeof scriptModule.default === "function") {
                    // Execute the default export function with the provided arguments
                    const result = await scriptModule.default(...args);
                    return { success: true, result };
                } else {
                    throw new Error(
                        `Invalid script format: ${file} does not export a default function`
                    );
                }
            } catch (error) {
                console.error(`Error executing server-side script:`, error);
                return {
                    success: false,
                    error: error.message || "Unknown error executing script",
                };
            }
        }
    );
    ipcMain.handle("promptPermission", async (event, arg) => {
        const getIP = async () => {
            try {
                // First attempt to fetch public IP from ipify API
                return new Promise<string>((resolve, reject) => {
                    const req = https.get("https://api.ipify.org", (res) => {
                        let data = "";
                        res.on("data", (chunk) => {
                            data += chunk;
                        });
                        res.on("end", () => {
                            if (res.statusCode === 200) {
                                console.log("Public IP Address:", data);
                                resolve(data.trim());
                            } else {
                                reject(
                                    new Error(
                                        `Failed to get IP: ${res.statusCode}`
                                    )
                                );
                            }
                        });
                    });

                    req.on("error", (err) => {
                        console.error("Error getting public IP:", err);
                        // Fall back to local IP
                        dns.lookup(
                            os.hostname(),
                            { family: 4 },
                            (err, addr) => {
                                if (err) {
                                    reject(err);
                                } else {
                                    console.log("Fallback to local IP:", addr);
                                    resolve(addr);
                                }
                            }
                        );
                    });

                    req.setTimeout(5000, () => {
                        req.destroy();
                        console.warn(
                            "IP request timed out, falling back to local IP"
                        );
                        // Fall back to local IP on timeout
                        dns.lookup(
                            os.hostname(),
                            { family: 4 },
                            (err, addr) => {
                                if (err) {
                                    reject(err);
                                } else {
                                    console.log("Fallback to local IP:", addr);
                                    resolve(addr);
                                }
                            }
                        );
                    });
                });
            } catch (error) {
                console.error("Failed to get public IP:", error);
                // Ultimate fallback to local IP if everything else fails
                return new Promise<string>((resolve, reject) => {
                    dns.lookup(os.hostname(), { family: 4 }, (err, addr) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(addr);
                        }
                    });
                });
            }
        };
        const getLocation = async () => {
            const currentIP = await getIP();
            var geo = geoip.lookup(currentIP);
            console.log("GeoIP data:", geo);

            return {
                latitude: geo.ll[0],
                longitude: geo.ll[1],
            };
        };
        const { appScheme, appName, prompt, type } = arg;
        console.log(
            `Prompting permission for ${type} from ${appName} (${appScheme})`
        );
        const registry = readFileSync(
            pathModule.join(process.env.APP_ROOT, "apps", "registry.json"),
            "utf-8"
        );
        const data = JSON.parse(registry);
        // example permission:
        // permissions: {
        //    "com.example.app": {
        //        "location: "prompt",
        //        "notifications": "granted"
        //    }
        // }

        const appPermissions = data.permissions[appScheme] || {};
        const permissionStatus = appPermissions[type] || "prompt";

        if (permissionStatus === "granted") {
            console.log(`Permission for ${type} already granted`);

            // If location permission is granted, provide coordinates
            if (type === "location") {
                try {
                    const locationData = await getLocation();
                    console.log("Retrieved location data:", locationData);
                    return {
                        status: "granted",
                        latitude: locationData.latitude,
                        longitude: locationData.longitude,
                    };
                } catch (error) {
                    console.error("Error retrieving location:", error);
                    return {
                        status: "granted",
                        error: "Failed to retrieve location",
                    };
                }
            }

            return { status: "granted" };
        } else if (permissionStatus === "denied") {
            console.log(`Permission for ${type} denied`);
            return { status: "denied" };
        } else {
            win.webContents.send("promptPermission", {
                appScheme,
                appName,
                prompt,
                type,
            });
            return new Promise((resolve) => {
                ipcMain.once("permissionResponse", async (event, response) => {
                    const { status } = response;
                    console.log(`Permission ${type} response: ${status}`);
                    if (status === "granted") {
                        appPermissions[type] = "granted";

                        // If location permission was just granted, get location data
                        if (type === "location" && status === "granted") {
                            try {
                                // Similar implementation as above

                                const locationData = await getLocation();
                                console.log(
                                    "Retrieved location data:",
                                    locationData
                                );

                                // Save updated permissions to registry
                                writeFileSync(
                                    pathModule.join(
                                        process.env.APP_ROOT,
                                        "apps",
                                        "registry.json"
                                    ),
                                    JSON.stringify(
                                        {
                                            ...data,
                                            permissions: {
                                                ...data.permissions,
                                                [appScheme]: appPermissions,
                                            },
                                        },
                                        null,
                                        4
                                    )
                                );

                                resolve({
                                    status: "granted",
                                    latitude: locationData.latitude,
                                    longitude: locationData.longitude,
                                });
                                return;
                            } catch (error) {
                                console.error(
                                    "Error retrieving location:",
                                    error
                                );
                                // Continue with regular permission handling
                            }
                        }
                    } else {
                        appPermissions[type] = "denied";
                    }

                    // Save updated permissions to registry
                    writeFileSync(
                        pathModule.join(
                            process.env.APP_ROOT,
                            "apps",
                            "registry.json"
                        ),
                        JSON.stringify(
                            {
                                ...data,
                                permissions: {
                                    ...data.permissions,
                                    [appScheme]: appPermissions,
                                },
                            },
                            null,
                            4
                        )
                    );
                    resolve({ status });
                });
            });
        }
    });
    ipcMain.handle("search", async (event, arg) => {
        try {
            const registry = readFileSync(
                pathModule.join(process.env.APP_ROOT, "apps", "registry.json"),
                "utf-8"
            );
            const data = JSON.parse(registry);
            const allApps = data.installedApps.map((app: string) => {
                try {
                    const manifest = readFileSync(
                        pathModule.join(
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

            // Add default apps to the list
            console.log("Default apps:", defaultApps);

            allIntents = allIntents.concat(defaultApps);

            if (Array.isArray(installedApps)) {
                installedApps.forEach((app) => {
                    if (app && app.name) {
                        // Make sure we have all required fields
                        allIntents.push({
                            application: {
                                name: app.name || "Unknown Application",
                                icon: {
                                    type: "image",
                                    value: app.appIcon || null,
                                },
                                appScheme:
                                    app.identifier ||
                                    `app-${Math.random()
                                        .toString(36)
                                        .substring(2, 9)}`,
                            },
                            type: "openApp",
                            appPath: app.path || "",
                            name: app.name || "Unknown Application",
                            description: app.publisher || "Local Application",
                            aliases: [app.name || "Unknown Application"],
                            minQueryLength: 1, // Default minQueryLength for installed apps
                        });
                    }
                });
            }

            // Helper function to safely test a regex pattern
            const safeRegexMatch = (pattern: string, text: string): boolean => {
                try {
                    const regex = new RegExp(pattern, "i"); // Case insensitive by default
                    return regex.test(text);
                } catch (error) {
                    console.error(`Invalid regex pattern: ${pattern}`, error);
                    return false;
                }
            };

            // Skip empty searches
            if (!arg || arg.trim() === "") return [];

            const searchTerm = arg.toLowerCase();
            const queryLength = searchTerm.length;

            const returnData = allIntents
                .filter((intent) => {
                    // Check minimum query length requirement
                    const minLength = intent.minQueryLength || 1; // Default to 1 if not specified
                    if (queryLength < minLength) return false;

                    // Determine which search methods to use
                    const searchBy = intent.searchBy || [
                        "name",
                        "aliases",
                        "regex",
                    ];

                    // Check for regex patterns if enabled in searchBy
                    if (
                        searchBy.includes("regex") &&
                        intent.regexPatterns &&
                        Array.isArray(intent.regexPatterns)
                    ) {
                        const regexMatch = intent.regexPatterns.some(
                            (pattern) => safeRegexMatch(pattern, searchTerm)
                        );
                        if (regexMatch) return true;
                    }

                    // Check if name search is enabled and matches
                    const nameMatch =
                        searchBy.includes("name") &&
                        intent.name.toLowerCase().includes(searchTerm);
                    if (nameMatch) return true;

                    // Check if aliases search is enabled and matches
                    const aliasMatch =
                        searchBy.includes("aliases") &&
                        intent.aliases &&
                        intent.aliases.some((alias: string) =>
                            alias.toLowerCase().includes(searchTerm)
                        );

                    return aliasMatch;
                })
                .slice(0, 5); // Limit to 5 results
            console.log("Search results:", returnData);

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

    ipcMain.on("open-link", (event, arg) => {
        const url = arg.url;
        shell.openExternal(url);
    });

    // Make all links open with the browser, not with the application
    win.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith("https:")) shell.openExternal(url);
        return { action: "deny" };
    });
    // win.webContents.on('will-navigate', (event, url) => { }) #344
}

function getExecutablePathFromFolder(folderPath: string): string | null {
    // Try to find executable file in InstallLocation
    const exeExtensions = [".exe", ".com", ".bat", ".cmd"];

    try {
        // Check if directory exists before reading
        if (!fs.existsSync(folderPath)) {
            throw new Error(`Install location does not exist: ${folderPath}`);
        }

        const files = fs.readdirSync(folderPath);
        const executableFiles = files.filter((file) => {
            const ext = pathModule.extname(file).toLowerCase();
            const fileName = file.toLowerCase();
            return (
                exeExtensions.includes(ext) &&
                !fileName.includes("uninstall") &&
                !fileName.includes("setup") &&
                !fileName.includes("update") &&
                !fileName.includes("install") &&
                !fileName.includes("installer") &&
                !fileName.includes("ActionRunner")
            );
        });

        if (executableFiles.length > 0) {
            let execPath = pathModule.join(folderPath, executableFiles[0]);
            if (execPath.includes(",")) {
                execPath = execPath.split(",")[0].trim();
            }
            return execPath;
        }
        return null; // No valid executable found
    } catch (error) {
        console.error(`Error finding executable for ${name}:`, error);
        return null; // Return null on error
    }
}

// Add a separate function to load installed apps with better error handling
async function loadInstalledApps() {
    // If already loading, don't start a new loading process
    if (appLoadingInProgress) {
        console.log("App loading already in progress, skipping");
        return;
    }

    appLoadingInProgress = true;

    // get from default apps

    const appsFile = readFileSync(
        pathModule.join(process.env.APP_ROOT, "apps", "defaultApps.json"),
        "utf-8"
    );
    const defaultWindowsApps = JSON.parse(appsFile);
    defaultApps = [];
    if (Array.isArray(defaultWindowsApps)) {
        defaultWindowsApps.forEach((app) => {
            if (app && app.name) {
                defaultApps.push({
                    application: {
                        name: app.name || "Unknown Application",
                        description: "System Application",
                        version: "x.x.x",
                        author: "Microsoft corporation",
                        appScheme:
                            "com.system." +
                            app.name.toLowerCase().replace(/\s+/g, "_"),
                        icon: {
                            type: "image",
                            value: app.icon || null,
                        },
                    },
                    name: app.name || "Unknown Application",
                    type: app.url ? "openLink" : "openApp",
                    description: "System Application",
                    intentScheme:
                        "com.system." +
                        app.name.toLowerCase().replace(/\s+/g, "_"),
                    url: app.url || null,
                    appPath: app.path || null,
                });
            }
        });
    }

    // Create abort controller for this operation
    if (appLoadAbortController) {
        try {
            appLoadAbortController.abort();
        } catch (e) {
            console.error("Error aborting previous load:", e);
        }
    }

    appLoadAbortController = new AbortController();
    const signal = appLoadAbortController.signal;

    try {
        console.log("Starting to load installed apps");
        const apps = (await getInstalledApps()) as InstalledApp[];

        // Check if operation was aborted
        if (signal.aborted) {
            console.log("App loading was aborted");
            appLoadingInProgress = false;
            return;
        }

        const appPromises = apps.map(async (application: InstalledApp) => {
            // Check for abort periodically
            if (signal.aborted) return null;

            try {
                const name = application.DisplayName || application.appName;
                const publisher =
                    application.Publisher || application.appPublisher;
                const version =
                    application.DisplayVersion || application.appVersion;
                const identifier = application.appIdentifier;
                let path = null;

                if (!name) return null; // Skip unnamed apps

                if (application.InstallLocation) {
                    // Use InstallLocation if available
                    path = getExecutablePathFromFolder(
                        application.InstallLocation
                    );
                } else if (application.DisplayIcon) {
                    // Extract executable path from DisplayIcon if available
                    try {
                        const iconPath = application.DisplayIcon;
                        if (iconPath) {
                            // Remove any parameters after comma and trim
                            let cleanIconPath = iconPath.split(",")[0].trim();

                            // Check if it points to an exe file
                            if (cleanIconPath.toLowerCase().endsWith(".exe")) {
                                // If it's a valid path and file exists, use it
                                if (fs.existsSync(cleanIconPath)) {
                                    path = cleanIconPath;
                                }
                            } else {
                                // If it's not an exe, get the directory and look for executables
                                const iconDir =
                                    pathModule.dirname(cleanIconPath);
                                if (fs.existsSync(iconDir)) {
                                    path = getExecutablePathFromFolder(iconDir);
                                }
                            }
                        }
                    } catch (error) {
                        console.error(
                            `Error extracting path from DisplayIcon for ${name}:`,
                            error
                        );
                    }
                }

                // Create an app icon only if we have a valid path
                let appIcon = null;
                if (path && fs.existsSync(path)) {
                    try {
                        // Check for abort before expensive icon extraction
                        if (signal.aborted) return null;

                        const icon = await app.getFileIcon(path, {
                            size: "normal",
                        });
                        const iconData = icon.toPNG().toString("base64");
                        appIcon = `data:image/png;base64,${iconData}`;
                    } catch (error) {
                        console.error(
                            `Failed to extract icon from ${path}:`,
                            error
                        );
                        // Use a safer fallback approach
                        try {
                            appIcon = `file://${path.split(",")[0].trim()}`;
                        } catch (e) {
                            appIcon = null;
                        }
                    }
                }

                if (!path) return null; // Skip if no executable path found

                return {
                    name,
                    publisher,
                    version,
                    identifier,
                    path,
                    appIcon,
                };
            } catch (error) {
                console.error("Error processing app:", error);
                return null; // Skip on any error
            }
        });

        // Process apps in batches to avoid memory issues
        const batchSize = 10;
        const results = [];

        for (let i = 0; i < appPromises.length; i += batchSize) {
            // Check for abort between batches
            if (signal.aborted) {
                console.log("App loading was aborted during batch processing");
                break;
            }

            const batch = appPromises.slice(i, i + batchSize);
            const batchResults = await Promise.all(batch);
            results.push(...batchResults);
        }

        // Final abort check before assignment
        if (!signal.aborted) {
            installedApps = results.filter((app) => app !== null);
            console.log(
                `Successfully loaded ${installedApps.length} installed apps`
            );
        }
    } catch (error) {
        console.error("Error during app loading:", error);
        installedApps = [];
    } finally {
        // Always clean up regardless of success or failure
        appLoadingInProgress = false;
        appLoadAbortController = null;
    }
}

// Call this early in the app lifecycle
handleDevModeShutdown();

let tray = null;

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
    .then(createWindow)
    .then(() => {
        tray = new Tray(
            pathModule.join(process.env.APP_ROOT, "public", "tray-icon.png")
        );
        tray.setToolTip("Mage");
        tray.on("click", () => {
            if (win) {
                win.webContents.send("toggle-menu", true);
            }
        });
    });

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

// Make these handlers more robust with try-catch blocks
app.on("will-quit", (event) => {
    try {
        console.log("App will quit, performing cleanup...");
        cleanupAndExit();
    } catch (error) {
        console.error("Error during will-quit cleanup:", error);
    }
});

app.on("quit", () => {
    try {
        console.log("App quitting, performing final cleanup...");
        cleanupAndExit();
    } catch (error) {
        console.error("Error during quit cleanup:", error);
    }
});

app.on("before-quit", (event) => {
    console.log("Before app quit, preparing for cleanup...");
    try {
        // Do any pre-quit preparation here
        // This runs before will-quit
        if (win && win.webContents) {
            win.webContents.removeAllListeners();
        }
    } catch (error) {
        console.error("Error during before-quit:", error);
    }
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
