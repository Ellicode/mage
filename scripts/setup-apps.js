// App package setup script
// Helps to set up app dependencies correctly
// Usage: npm run setup-apps

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

// Read registry to find all apps
const APPS_DIR = path.join(process.cwd(), "apps");
const REGISTRY_PATH = path.join(APPS_DIR, "registry.json");
const TEMPLATE_PATH = path.join(APPS_DIR, "template", "package.json");
const MAIN_PKG_PATH = path.join(process.cwd(), "package.json");

// Ensure the template exists
if (!fs.existsSync(TEMPLATE_PATH)) {
    console.error(
        "❌ App template package.json not found. Cannot continue setup."
    );
    process.exit(1);
}

// Read the template package.json
const templatePkg = JSON.parse(fs.readFileSync(TEMPLATE_PATH, "utf-8"));

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

    console.log(`📦 Setting up packages for ${apps.length} apps...\n`);

    // Process each app
    for (const appScheme of apps) {
        const appDir = path.join(APPS_DIR, appScheme);

        // Skip if directory doesn't exist
        if (!fs.existsSync(appDir)) {
            console.warn(`⚠️ App directory not found: ${appScheme}`);
            continue;
        }

        // Read app manifest
        const appManifestPath = path.join(appDir, "application.json");
        if (!fs.existsSync(appManifestPath)) {
            console.warn(`⚠️ Application manifest not found for: ${appScheme}`);
            continue;
        }

        try {
            const appManifest = JSON.parse(
                fs.readFileSync(appManifestPath, "utf-8")
            );

            // Create package.json for the app if it doesn't exist
            const appPkgPath = path.join(appDir, "package.json");

            if (!fs.existsSync(appPkgPath)) {
                console.log(
                    `📄 Creating package.json for ${
                        appManifest.name || appScheme
                    }`
                );
                // Generate package.json based on the template
                const appPkg = {
                    ...templatePkg,
                    name: appScheme.replace(/\./g, "-"),
                    description:
                        appManifest.description ||
                        `${appManifest.name} app for Mage platform`,
                    version: appManifest.version || "1.0.0",
                };

                // Add shared dependencies configuration
                appPkg.mage = {
                    sharedDependencies: Object.keys(sharedDependencies),
                };

                // Check if the app has special dependency requirements in its manifest
                if (
                    appManifest.dependencies &&
                    typeof appManifest.dependencies === "object"
                ) {
                    appPkg.dependencies = {
                        ...appPkg.dependencies,
                        ...appManifest.dependencies,
                    };
                    console.log(
                        `📦 Added ${
                            Object.keys(appManifest.dependencies).length
                        } custom dependencies from manifest`
                    );
                }

                // Write package.json
                fs.writeFileSync(appPkgPath, JSON.stringify(appPkg, null, 2));
                console.log(`✅ Created package.json for ${appScheme}`);
            } else {
                console.log(
                    `📝 Package.json already exists for ${appScheme}. Skipping.`
                );
            }

            // Create tsconfig.json for TypeScript apps if needed
            const tsconfigPath = path.join(appDir, "tsconfig.json");
            if (
                fs.readdirSync(appDir).some((file) => file.endsWith(".ts")) &&
                !fs.existsSync(tsconfigPath)
            ) {
                console.log(`🔧 Creating tsconfig.json for ${appScheme}`);

                // Copy from template
                const templateTsconfig = path.join(
                    APPS_DIR,
                    "template",
                    "tsconfig.json"
                );
                if (fs.existsSync(templateTsconfig)) {
                    fs.copyFileSync(templateTsconfig, tsconfigPath);
                    console.log(`✅ Created tsconfig.json for ${appScheme}`);
                }
            }
        } catch (error) {
            console.error(`❌ Error processing ${appScheme}:`, error);
        }
    }

    console.log("\n🎉 App package setup complete!");
    console.log("\nTo install dependencies for each app:");
    console.log("1. Navigate to each app directory");
    console.log("2. Run: npm install");
    console.log(
        "\nOr use: npm run install-apps to install dependencies for all apps"
    );
} catch (error) {
    console.error("❌ Failed to process app registry:", error);
}
