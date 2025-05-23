import { executeServerSideScript } from "../../kit/execute";

export interface Note {
    id: string;
    name: string;
    text: string;
    date: Date;
}

export const fetchNotesFromFile = async (filePath: string): Promise<Note[]> => {
    const ssScript = await executeServerSideScript(
        "fetchNotesFromFile",
        [filePath],
        "com.ellicode.notes"
    );
    return ssScript.result as Note[];
};

export const createNote = async (filePath: string) => {
    await executeServerSideScript(
        "createNote",
        [filePath],
        "com.ellicode.notes"
    );
};

export const saveNote = async (filePath: string, data: Note) => {
    const serializableData = {
        ...data,
        date: data.date instanceof Date ? data.date.toISOString() : data.date,
    };
    await executeServerSideScript(
        "saveNote",
        [filePath, serializableData],
        "com.ellicode.notes"
    );
};

export const deleteNote = async (filePath: string, noteId: string) => {
    await executeServerSideScript(
        "deleteNote",
        [filePath, noteId],
        "com.ellicode.notes"
    );
};
