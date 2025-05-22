import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "path";

export default defineConfig({
    plugins: [vue()],
    build: {
        outDir: "dist",
        emptyOutDir: false,
        lib: {
            entry: path.resolve(__dirname, "kit/sdk.ts"),
            name: "MageSDK",
            fileName: (format) => `mage-sdk.${format}.js`,
            formats: ["es", "umd"],
        },
        rollupOptions: {
            external: ["vue", "electron"],
            output: {
                globals: {
                    vue: "Vue",
                    electron: "electron",
                },
                assetFileNames: (assetInfo) => {
                    if (assetInfo.name === "style.css") return "mage-sdk.css";
                    return assetInfo.name;
                },
            },
        },
    },
    resolve: {
        alias: {
            "@kit": path.resolve(__dirname, "kit"),
            "@apps": path.resolve(__dirname, "apps"),
        },
    },
});
