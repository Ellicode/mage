export const getLocation = async (
    appScheme: string,
    appName: string,
    prompt: string
) => {
    const promptData = await window.ipcRenderer.invoke("promptPermission", {
        appScheme,
        appName,
        prompt,
        type: "location",
    });
    if (promptData.status === "granted") {
        return {
            latitude: promptData.latitude,
            longitude: promptData.longitude,
        };
    } else if (promptData.status === "denied") {
        return false;
    }
};
