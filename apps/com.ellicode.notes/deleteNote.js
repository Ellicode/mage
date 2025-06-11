import { readFileSync, writeFileSync } from "node:fs";
export default function deleteNote(filePath, noteID) {
    try {
        const noteFileData = readFileSync(
            "./apps/com.ellicode.notes/" + filePath,
            "utf-8"
        );

        let notes = [];
        try {
            const parsed = JSON.parse(noteFileData);
            // Handle both array and object formats
            notes = Array.isArray(parsed) ? parsed : Object.values(parsed);
        } catch (e) {
            console.error("Error parsing notes file:", e);
        }

        // Ensure note.id is defined and always compare as string
        notes.splice(
            notes.findIndex((n) => String(n.id) === String(noteID)),
            1
        );
        // Write the updated notes back to the file as an array
        writeFileSync(
            "./apps/com.ellicode.notes/" + filePath,
            JSON.stringify(notes, null, 2),
            {
                encoding: "utf-8",
            }
        );

        // Return the created note for potential use
        return note;
    } catch (error) {
        console.error("Error in createNote:", error);
    }
}
