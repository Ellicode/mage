import { executeServerSideScript, getAssetPath } from "../../kit/sdk";

/**
 * Example function that demonstrates server-side script execution
 */
export const sayHello = async (name: string = "World"): Promise<string> => {
    try {
        const result = await executeServerSideScript(
            "hello",
            [name],
            "com.example.template"
        );
        return result.success
            ? result.result
            : "Error: Script execution failed";
    } catch (error) {
        console.error("Error executing hello script:", error);
        return `Error: ${error.message || "Unknown error"}`;
    }
};

/**
 * Example function that demonstrates asset path resolution
 */
export const getImagePath = (imageName: string): string => {
    return getAssetPath("com.example.template", `${imageName}`);
};
