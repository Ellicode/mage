// App dependency installer
// Helps to install dependencies for all apps
// Usage: npm run install-apps

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

// Read registry to find all apps
const APPS_DIR = path.join(process.cwd(), "apps");
const REGISTRY_PATH = path.join(APPS_DIR, "registry.json");
const MAIN_PKG_PATH = path.join(process.cwd(), "package.json");

// Read main package.json for shared dependencies
const mainPkg = JSON.parse(fs.readFileSync(MAIN_PKG_PATH, "utf-8"));
const sharedDependencies = mainPkg.dependencies || {};

try {
    // Read the registry to get all installed apps
    const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf-8"));
    const apps = registry.installedApps;

    if (!Array.isArray(apps)) {
        console.error(
            '❌ Invalid registry format. Expected "installedApps" array.'
        );
        process.exit(1);
    }

    console.log(`📦 Installing dependencies for ${apps.length} apps...\n`);

    // Process each app
    for (const appScheme of apps) {
        const appDir = path.join(APPS_DIR, appScheme);

        // Skip if directory doesn't exist
        if (!fs.existsSync(appDir)) {
            console.warn(`⚠️ App directory not found: ${appScheme}`);
            continue;
        }

        // Check if package.json exists
        const appPkgPath = path.join(appDir, "package.json");
        if (!fs.existsSync(appPkgPath)) {
            console.warn(
                `⚠️ No package.json found for ${appScheme}. Run setup-apps first.`
            );
            continue;
        }
        try {
            const appPkg = JSON.parse(fs.readFileSync(appPkgPath, "utf-8"));
            const appDeps = appPkg.dependencies || {};

            // Check for shared dependencies configuration
            const sharedDepsList =
                appPkg.mage && appPkg.mage.sharedDependencies
                    ? appPkg.mage.sharedDependencies
                    : [];
            // Filter out shared dependencies already in the main package.json
            const uniqueDeps = {};
            for (const [dep, version] of Object.entries(appDeps)) {
                if (!sharedDepsList.includes(dep)) {
                    uniqueDeps[dep] = version;
                }
            }

            // Create a temporary package.json with only unique dependencies
            const tempPkg = {
                ...appPkg,
                dependencies: uniqueDeps,
            };

            // Log shared dependencies if any
            if (sharedDepsList.length > 0) {
                console.log(
                    `🔄 Using ${sharedDepsList.length} shared dependencies from main app`
                );
            }

            // Write temporary package.json
            fs.writeFileSync(appPkgPath, JSON.stringify(tempPkg, null, 2));

            console.log(`📦 Installing dependencies for ${appScheme}...`);

            // Run npm install
            execSync("npm install", {
                cwd: appDir,
                stdio: "inherit",
            });

            // Restore original package.json
            fs.writeFileSync(appPkgPath, JSON.stringify(appPkg, null, 2));

            console.log(`✅ Installed dependencies for ${appScheme}`);
        } catch (error) {
            console.error(
                `❌ Error installing dependencies for ${appScheme}:`,
                error
            );
        }
    }

    console.log("\n🎉 All app dependencies installed!");
} catch (error) {
    console.error("❌ Failed to process app registry:", error);
}
