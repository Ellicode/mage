/**
 * Execute a server-side script from the renderer process
 * @param file Script filename without extension (can include relative path within the app)
 * @param args Arguments to pass to the script
 * @param appScheme The app scheme identifier
 * @returns Result of the script execution
 */
export const executeServerSideScript = async (
    file: string,
    args: any[] = [],
    appScheme: string
) => {
    // Remove .ts or .js extension if present to allow the main process to add the correct extension
    const fileWithoutExtension = file.replace(/\.(ts|js)$/, "");

    return window.ipcRenderer.invoke("executeServerSideScript", {
        file: fileWithoutExtension,
        args,
        appScheme,
    });
};
