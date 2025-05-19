import { defineConfig } from "vite";
import path from "path";
import electron from "vite-plugin-electron";
import renderer from "vite-plugin-electron-renderer";

export default defineConfig({
    plugins: [
        electron([
            {
                entry: "electron/main/index.ts",
                onstart({ startup }) {
                    // Customize the startup process to handle termination better
                    startup([".", "--no-sandbox", "--trace-warnings"], {
                        // Add options to control process termination
                        forcePkill: true,
                        timeout: 15000, // Longer timeout for graceful shutdown
                        beforePkill: (pid) => {
                            console.log(`Preparing to terminate pid ${pid}...`);
                            // You could add a custom signal here if needed
                            return Promise.resolve();
                        },
                    });
                },
            },
            {
                entry: "electron/preload/index.ts",
                onstart(options) {
                    options.reload();
                },
            },
        ]),
        renderer(),
    ],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "src"),
        },
    },
});
