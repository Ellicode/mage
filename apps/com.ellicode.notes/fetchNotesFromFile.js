// fetch file
import { readFileSync } from "node:fs";
// Note: TypeScript interfaces are removed during compilation
export default async function fetchNotesFromFile(filePath) {
    const fileContent = readFileSync(
        "./apps/com.ellicode.notes/" + filePath,
        "utf-8"
    );
    const notes = JSON.parse(fileContent);
    return notes;
}
