import { readFileSync, writeFileSync } from "node:fs";
export default function createNote(filePath) {
    const note = {
        id: String(Date.now() + Math.floor(Math.random() * 10000)), // Add randomness to ensure uniqueness
        name: "New Note",
        text: "",
        date: new Date(),
    };

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

        // Add the new note to the array
        notes.push(note);

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
