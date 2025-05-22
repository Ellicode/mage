import { readFileSync, writeFileSync } from "node:fs";
export default function saveNote(filePath, note) {
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
        if (!note.id) {
            console.error("Note must have an id:", note);
            return;
        }

        // Find the note in the array
        const index = notes.findIndex((n) => String(n.id) === String(note.id));

        if (index !== -1) {
            notes[index] = { ...notes[index], ...note };
        } else {
            notes.push(note);
        }

        // Write the updated notes back to the file as an array
        writeFileSync(
            "./apps/com.ellicode.notes/" + filePath,
            JSON.stringify(notes, null, 2),
            {
                encoding: "utf-8",
            }
        );
    } catch (error) {
        console.error("Error in saveNote:", error);
    }
}
