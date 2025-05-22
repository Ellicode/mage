<script setup lang="ts">
import {
    Loader,
    LoaderCircle,
    NotepadTextDashed,
    StickyNote,
} from "lucide-vue-next";
import {
    BlankSlate,
    ListItem,
    SearchBar,
    Button,
    SplitView,
} from "../../kit/sdk";
import { computed, onMounted, ref } from "vue";
import { createNote, fetchNotesFromFile, saveNote } from "./index";
import type { Note } from "./index";

// Add a debounce function
function debounce(func: Function, wait: number) {
    let timeout: number | undefined;
    return function (...args: any[]) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait) as unknown as number;
    };
}

const fetchNotes = async () => {
    notes.value = [];
    const notesData = await fetchNotesFromFile("assets/notes.json");
    console.log("Fetched notes:", notesData);

    notes.value = notesData.map((note: any) => ({
        id: note.id,
        name: note.name,
        text: note.text,
        date: new Date(note.date),
    }));
};

const searchQuery = ref("");
const notes = ref<Note[]>([]);

const formatDate = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    };
    return new Intl.DateTimeFormat("en-US", options).format(date);
};

const selectedNote = ref<Note | null>(null);

const filteredNotes = computed(() => {
    if (!searchQuery.value) return notes.value;
    return notes.value.filter((note) =>
        note.name.toLowerCase().includes(searchQuery.value.toLowerCase())
    );
});

const selectNote = (note: Note) => {
    selectedNote.value = note;
    console.log("Selected note:", note);
};

const addNote = async () => {
    await createNote("assets/notes.json");
    await fetchNotes();
};

const saveNoteDebounced = debounce(async (note: Note) => {
    await saveNote("assets/notes.json", note);

    // Update the note in-place instead of refetching all notes
    const index = notes.value.findIndex(
        (n) => String(n.id) === String(note.id)
    );
    if (index !== -1) {
        notes.value[index] = { ...note };
        selectedNote.value = notes.value[index];
    }
}, 500);

const updateNoteName = (name: string) => {
    if (selectedNote.value) {
        selectedNote.value = {
            ...selectedNote.value,
            name,
            date: new Date(),
        };
        saveNoteDebounced(selectedNote.value);
    }
};

const updateNoteText = (text: string) => {
    if (selectedNote.value) {
        selectedNote.value = {
            ...selectedNote.value,
            text,
            date: new Date(),
        };
        saveNoteDebounced(selectedNote.value);
    }
};

onMounted(() => {
    fetchNotes();
});
</script>

<template>
    <SearchBar v-model="searchQuery" placeholder="Search notes..." />

    <SplitView>
        <template #leading>
            <ListItem
                v-for="(note, index) in filteredNotes"
                :key="index"
                :title="note.name"
                :description="formatDate(note.date)"
                :active="selectedNote?.id === note.id"
                @click="selectNote(note)"
            >
                <template #icon>
                    <StickyNote class="w-5 h-5 text-neutral-500" />
                </template>
                <template #append>
                    <transition
                        name="fade"
                        enter-active-class="transition-opacity duration-200"
                        leave-active-class="transition-opacity duration-200"
                        enter-from-class="opacity-0"
                        enter-to-class="opacity-100"
                        leave-from-class="opacity-100"
                        leave-to-class="opacity-0"
                        mode="out-in"
                    >
                        <LoaderCircle
                            v-if="
                                selectedNote?.id === note.id &&
                                selectedNote !== note
                            "
                            class="w-4 h-4 text-neutral-500 animate-spin"
                        />
                    </transition>
                </template>
            </ListItem>
        </template>
        <template #trailing>
            <BlankSlate
                title="No note selected"
                v-if="!selectedNote"
                description="No note selected yet. Click on a note to view it."
            >
                <template #icon>
                    <NotepadTextDashed class="w-10 h-10 text-neutral-500" />
                </template>
                <Button type="accent" @click="addNote">Create note</Button>
            </BlankSlate>
            <div v-else class="p-5 flex flex-col h-full">
                <input
                    type="text"
                    :value="selectedNote.name"
                    @input="
                        updateNoteName(
                            ($event.target as HTMLInputElement).value
                        )
                    "
                    class="text-2xl font-bold outline-0 mb-2"
                />
                <textarea
                    :value="selectedNote.text"
                    @input="
                        updateNoteText(
                            ($event.target as HTMLTextAreaElement).value
                        )
                    "
                    class="flex-1 outline-0 resize-none placeholder:text-neutral-500"
                    rows="10"
                    placeholder="Write your note here..."
                />
            </div>
        </template>
    </SplitView>
</template>
