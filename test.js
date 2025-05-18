import regedit from "regedit";

async function listInstalledApps() {
    const uninstallKeys = [
        "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
        "HKLM\\SOFTWARE\\Wow6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
    ];

    for (const key of uninstallKeys) {
        try {
            const result = await regedit.list(key);
            const subkeys = result[key].keys;

            for (const subkey of subkeys) {
                const appKey = `${key}\\${subkey}`;
                const appInfo = await regedit.list(appKey);
                const values = appInfo[appKey].values;

                const displayName = values["DisplayName"]?.value;
                const displayIcon = values["DisplayIcon"]?.value;
                const installLocation = values["InstallLocation"]?.value;
                const uninstallString = values["UninstallString"]?.value;

                if (displayName) {
                    console.log(`Name: ${displayName}`);
                    console.log(`Icon Path: ${displayIcon}`);
                    console.log(`Install Location: ${installLocation}`);
                    console.log(`Uninstall Command: ${uninstallString}`);
                    console.log("---");
                }
            }
        } catch (err) {
            console.error(`Error reading registry key ${key}:`, err);
        }
    }
}

listInstalledApps();
