<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed } from "vue";
import { Music2, MusicIcon, Pause, Play, Rewind } from "lucide-vue-next";
import { ListItem, SearchBar, clientProcessHandler } from "../../kit/sdk";
import {
    toggleMusic,
    startMusic,
    stopMusic,
    getCurrentMusicState,
} from "./index";

// Get the client process handler for monitoring music processes
const processHandler = clientProcessHandler("com.ellicode.music");

// Add missing currentAudio reference
const currentAudio = ref<HTMLAudioElement | null>(null);

import { getAssetPath } from "../../kit/sdk";

const APP_SCHEME = "com.ellicode.music";

const songs = ref<
    {
        id: number;
        title: string;
        artist: string;
        url: string;
    }[]
>([
    {
        id: 1,
        title: "Lost signal",
        artist: "Lofi & Chill",
        url: getAssetPath(APP_SCHEME, "song1.mp3"),
    },
    {
        id: 2,
        title: "Coffee Break",
        artist: "Lofi & Chill",
        url: getAssetPath(APP_SCHEME, "song2.mp3"),
    },
    {
        id: 3,
        title: "Paper Dreams",
        artist: "Lofi & Chill",
        url: getAssetPath(APP_SCHEME, "song3.mp3"),
    },
    {
        id: 4,
        title: "Midnight Haze",
        artist: "Lofi & Chill",
        url: getAssetPath(APP_SCHEME, "song4.mp3"),
    },
    {
        id: 5,
        title: "Empty Streets",
        artist: "Lofi & Chill",
        url: getAssetPath(APP_SCHEME, "song5.mp3"),
    },
    {
        id: 6,
        title: "Faded Light",
        artist: "Lofi & Chill",
        url: getAssetPath(APP_SCHEME, "song6.mp3"),
    },
    {
        id: 7,
        title: "Quiet Rain",
        artist: "Lofi & Chill",
        url: getAssetPath(APP_SCHEME, "song7.mp3"),
    },
]);

const currentSong = ref<{
    id: number;
    title: string;
    artist: string;
    url: string;
    time: number;
    duration: number;
    playing: boolean;
} | null>(null);

// Setup state monitoring for music playback
const updateCurrentSongState = async () => {
    try {
        const musicState = await getCurrentMusicState();

        currentSong.value = musicState;
        currentAudio.value = musicState?.audioElement!;
    } catch (error) {
        console.error("Error updating music state:", error);
    }
};

// Initialize and cleanup
onMounted(() => {
    updateCurrentSongState();

    // Update UI when the menu is reopened to reflect current playing state
    const interval = setInterval(async () => {
        try {
            const musicState = await getCurrentMusicState();
            const processes = processHandler.getProcesses();
            const musicProcess = processes.find((p) => p.name === "Music");

            currentSong.value = musicState;
            currentAudio.value = musicState?.audioElement!;

            if (currentAudio.value) {
                currentAudio.value.onended = async () => {
                    // Play the next song if available
                    const nextSong = songs.value.find(
                        (s) => s.id === currentSong.value!.id + 1
                    );
                    // Reset current song state when playback ends
                    currentSong.value = null;
                    currentAudio.value = null;
                    // If the song has ended, stop the music
                    await stopMusic();

                    if (nextSong) {
                        await startMusic(nextSong);
                    }
                };
            }
            if (musicProcess && !currentSong.value) {
                console.log("Detected music process, updating UI state");
                updateCurrentSongState();
            }
        } catch (error) {
            console.error("Error in interval check:", error);
        }
    }, 100);

    // Cleanup the interval on component unmount
    onBeforeUnmount(() => {
        clearInterval(interval);
    });
});

// Play a song using the background process system
const playsound = async (url: string) => {
    const song = songs.value.find((s) => s.url === url);
    if (song) {
        await toggleMusic(song);
        // Force update current song state after toggle
        setTimeout(updateCurrentSongState, 100);
    }
};

const playpause = async () => {
    if (currentSong.value) {
        const song = songs.value.find((s) => s.id === currentSong.value!.id);
        if (song) {
            await toggleMusic(song);
        }
    }
};

const rewind = async () => {
    if (currentSong.value) {
        // Stop current playback and restart from beginning
        const song = songs.value.find((s) => s.id === currentSong.value!.id);
        if (song) {
            await stopMusic();
            await startMusic(song);
        }
    }
};

const progressBar = ref<HTMLDivElement | null>(null);

const updateTime = async (event: MouseEvent) => {
    if (currentAudio.value && currentSong.value) {
        const progressBar = event.currentTarget as HTMLDivElement;
        const rect = progressBar.getBoundingClientRect();
        const offsetX = event.clientX - rect.left;
        const width = rect.width;
        const percentage = offsetX / width;
        currentAudio.value.currentTime =
            percentage * currentSong.value.duration;

        // Update the current song time
        currentSong.value.time = currentAudio.value.currentTime;
    }
};

const isDragging = ref(false);

const startDrag = (event: MouseEvent) => {
    if (currentSong.value && currentAudio.value) {
        isDragging.value = true;
        const progressBar = event.currentTarget as HTMLDivElement;
        const rect = progressBar.getBoundingClientRect();
        const offsetX = event.clientX - rect.left;
        const width = rect.width;
        const percentage = offsetX / width;
        currentAudio.value.currentTime =
            percentage * currentSong.value.duration;
    }
};

const searchQuery = ref("");
const filteredSongs = computed(() => {
    if (!searchQuery.value) {
        return songs.value;
    }
    return songs.value.filter((song) =>
        song.title.toLowerCase().includes(searchQuery.value.toLowerCase())
    );
});
</script>

<template>
    <SearchBar v-model="searchQuery" placeholder="Search for songs..." />
    <div class="overflow-auto flex flex-col pb-18">
        <ListItem
            v-for="song in filteredSongs"
            :key="song.id"
            :title="song.title"
            :description="song.artist"
            :active="!!(currentSong && currentSong.id === song.id)"
            @click="playsound(song.url)"
        >
            <template #icon>
                <div
                    class="w-9 h-9 inset-shadow-2xs inset-shadow-neutral-600 bg-neutral-700 rounded-lg flex items-center justify-center"
                >
                    <Music2 class="w-5 h-5 text-rose-500" />
                </div>
            </template>
            <template #append>
                <canvas
                    v-if="currentSong && currentSong.id === song.id"
                    id="audio-visualizer"
                    class="w-5 h-5"
                ></canvas>
            </template>
        </ListItem>
    </div>
    <div
        v-if="currentSong"
        class="absolute z-10 flex items-center gap-2 px-5 bottom-0 w-full left-0 h-16 border-t border-t-neutral-800 bg-neutral-900/50 backdrop-blur-lg"
    >
        <div class="flex flex-col me-auto">
            <span>{{ currentSong.title }}</span>
            <span class="text-neutral-500 text-sm">
                {{ currentSong.artist }}
            </span>
        </div>
        <div
            class="bg-neutral-800 h-1 mx-10 w-96 rounded-full overflow-hidden cursor-pointer"
            ref="progressBar"
            @mousedown="startDrag"
            @mousemove="isDragging ? updateTime($event) : null"
            @mouseup="isDragging = false"
        >
            <div
                class="bg-rose-500 h-1"
                :style="{
                    width: `${
                        currentSong.time && currentSong.duration
                            ? (currentSong.time / currentSong.duration) * 100
                            : 0
                    }%`,
                }"
            ></div>
        </div>
        <button
            class="h-8 w-8 rounded-full cursor-pointer transition-all active:bg-neutral-700 active:scale-95 hover:bg-neutral-800 flex items-center justify-center"
            @click="rewind"
        >
            <Rewind fill="white" class="w-5 h-5" />
        </button>
        <button
            class="h-8 w-8 rounded-full cursor-pointer transition-all active:bg-neutral-700 active:scale-90 hover:bg-neutral-800 flex items-center justify-center"
            @click="playpause"
        >
            <Play
                v-if="currentAudio && currentAudio.paused"
                fill="white"
                class="w-5 h-5"
            />
            <Pause
                v-else-if="currentAudio && !currentAudio.paused"
                class="w-5 h-5"
                fill="white"
            />
        </button>
    </div>
</template>
