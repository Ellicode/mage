// App dependency sync script
// Synchronizes shared dependencies between main app and individual apps
// Usage: npm run sync-deps

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

// Read registry to find all apps
const APPS_DIR = path.join(process.cwd(), "apps");
const REGISTRY_PATH = path.join(APPS_DIR, "registry.json");
const MAIN_PKG_PATH = path.join(process.cwd(), "package.json");

try {
    // Read main package.json for shared dependencies
    const mainPkg = JSON.parse(fs.readFileSync(MAIN_PKG_PATH, "utf-8"));
    const mainDeps = mainPkg.dependencies || {};

    // Read the registry to get all installed apps
    const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf-8"));
    const apps = registry.installedApps;

    if (!Array.isArray(apps)) {
        console.error(
            '❌ Invalid registry format. Expected "installedApps" array.'
        );
        process.exit(1);
    }

    console.log(
        `🔄 Syncing dependencies for ${apps.length} apps with main app...\n`
    );

    // Find all shared dependencies
    const sharedDepsMap = new Map();

    // Process each app to collect their dependencies
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
            console.warn(`⚠️ No package.json found for ${appScheme}.`);
            continue;
        }

        try {
            const appPkg = JSON.parse(fs.readFileSync(appPkgPath, "utf-8"));
            const appDeps = appPkg.dependencies || {};

            // Count dependencies for this app
            for (const [dep, version] of Object.entries(appDeps)) {
                if (!sharedDepsMap.has(dep)) {
                    sharedDepsMap.set(dep, {
                        count: 1,
                        version,
                        apps: [appScheme],
                    });
                } else {
                    const info = sharedDepsMap.get(dep);
                    info.count++;
                    info.apps.push(appScheme);
                }
            }
        } catch (error) {
            console.error(`❌ Error processing ${appScheme}:`, error);
        }
    }

    // Find dependencies used by more than one app
    const commonDeps = [];
    for (const [dep, info] of sharedDepsMap.entries()) {
        if (info.count > 1) {
            commonDeps.push({
                name: dep,
                version: info.version,
                count: info.count,
                apps: info.apps,
            });
        }
    }

    // Sort by usage count
    commonDeps.sort((a, b) => b.count - a.count);

    if (commonDeps.length === 0) {
        console.log("ℹ️ No common dependencies found between apps.");
    } else {
        console.log(
            `📊 Found ${commonDeps.length} dependencies used by multiple apps:`
        );

        // Display common dependencies
        for (const dep of commonDeps) {
            console.log(
                `- ${dep.name}@${dep.version} (used by ${dep.count} apps)`
            );

            // Check if already in main dependencies
            const inMain = dep.name in mainDeps;

            if (inMain) {
                if (mainDeps[dep.name] !== dep.version) {
                    console.log(
                        `  ⚠️ Version mismatch: main app uses ${dep.name}@${
                            mainDeps[dep.name]
                        }`
                    );
                } else {
                    console.log(
                        `  ✅ Already in main app with matching version`
                    );
                }
            } else {
                console.log(`  ❓ Not in main app dependencies`);
            }
        }

        // Ask if user wants to add common dependencies to main app
        console.log(
            "\nWould you like to add the common dependencies to the main app?"
        );
        console.log(
            "This will make them available to all apps without duplicating the code."
        );
        console.log("(y/n)");

        // For now, just provide instructions
        console.log(
            "\nTo add these dependencies to your main package.json, run:"
        );
        for (const dep of commonDeps) {
            if (!(dep.name in mainDeps)) {
                console.log(`npm install ${dep.name}@${dep.version}`);
            }
        }
    }

    console.log("\n🎉 Dependency analysis complete!");
} catch (error) {
    console.error("❌ Failed to process app dependencies:", error);
}
