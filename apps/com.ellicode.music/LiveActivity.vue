<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from "vue";
import {
    Play,
    Pause,
    SkipForward,
    SkipBack,
    Music,
    X,
    Square,
} from "lucide-vue-next";
import { getCurrentMusicState, toggleMusic, stopMusic } from "./index";

const musicState = ref<any>(null);
const updateInterval = ref<number | null>(null);
const visualizerCanvas = ref<HTMLCanvasElement | null>(null);
const animationFrame = ref<number | null>(null);

onMounted(() => {
    // Get initial music state
    updateMusicState();

    // Update every second
    updateInterval.value = window.setInterval(updateMusicState, 500);

    // Start visualization if we have a canvas
    if (visualizerCanvas.value) {
        startVisualization();
    }
});

onUnmounted(() => {
    if (updateInterval.value !== null) {
        clearInterval(updateInterval.value);
    }

    if (animationFrame.value !== null) {
        cancelAnimationFrame(animationFrame.value);
        animationFrame.value = null;
    }
});

const updateMusicState = async () => {
    try {
        const state = await getCurrentMusicState();
        if (state) {
            musicState.value = state;
        }
    } catch (error) {
        console.error("Failed to update music state:", error);
    }
};

const togglePlayPause = async () => {
    if (musicState.value) {
        await toggleMusic(musicState.value);
        updateMusicState();
    }
};

const formatTime = (seconds: number) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
};

// Draw visualization without creating a new audio context
const startVisualization = () => {
    if (!visualizerCanvas.value) return;

    const canvas = visualizerCanvas.value;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas dimensions
    canvas.width = 40;
    canvas.height = 40;

    const drawVisualization = () => {
        if (!ctx || !musicState.value || !musicState.value.playing) {
            if (animationFrame.value) {
                cancelAnimationFrame(animationFrame.value);
                animationFrame.value = null;
            }
            return;
        }

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw animated bars without accessing audio data
        // Since we can't access the analyzer directly from here,
        // we'll create a simple animation that looks like an audio visualizer
        const time = Date.now() / 200;
        const barCount = 4;
        const barWidth = 5;
        const spacing = 3;
        const totalWidth = barCount * (barWidth + spacing) - spacing;
        const startX = (canvas.width - totalWidth) / 2;

        ctx.fillStyle = "#ec4899"; // Use rose-500 color

        for (let i = 0; i < barCount; i++) {
            // Create a pseudorandom height using sine waves with different frequencies
            // This creates a realistic-looking audio visualization without actual audio data
            const frequency = 0.5 + i * 0.2;
            const amplitude = 0.4 + (i % 3) * 0.2;
            const phase = (i * Math.PI) / 4;

            // Calculate bar height using sine wave
            const barHeight =
                (amplitude * Math.abs(Math.sin(time * frequency + phase)) +
                    0.2) *
                canvas.height;

            // Draw bar
            ctx.fillRect(
                startX + i * (barWidth + spacing),
                canvas.height - barHeight,
                barWidth,
                barHeight
            );
        }

        // Continue animation loop if still playing
        if (musicState.value && musicState.value.playing) {
            animationFrame.value = requestAnimationFrame(drawVisualization);
        }
    };

    // Start visualization loop
    drawVisualization();
    animationFrame.value = requestAnimationFrame(drawVisualization);
};

// Watch for changes in playing state to start/stop visualization
watch(
    () => musicState.value?.playing,
    (isPlaying) => {
        if (isPlaying && !animationFrame.value) {
            startVisualization();
        } else if (!isPlaying && animationFrame.value) {
            cancelAnimationFrame(animationFrame.value);
            animationFrame.value = null;
        }
    }
);
</script>

<template>
    <div class="p-4 flex flex-col">
        <div v-if="musicState" class="flex items-center gap-3">
            <canvas
                id="live-activity-visualizer"
                class="w-5 h-5 ms-1 me-3"
            ></canvas>

            <div class="flex flex-col flex-1 min-w-0">
                <span class="font-medium truncate">{{ musicState.title }}</span>
                <span class="text-xs text-neutral-400">{{
                    musicState.artist
                }}</span>
            </div>

            <div class="flex gap-2">
                <button
                    class="w-8 h-8 rounded-full flex items-center justify-center hover:bg-neutral-800"
                    @click="togglePlayPause"
                >
                    <Pause
                        fill="white"
                        v-if="musicState.playing"
                        class="w-4 h-4"
                    />
                    <Play fill="white" v-else class="w-4 h-4" />
                </button>
                <button
                    class="w-8 h-8 rounded-full flex items-center justify-center hover:bg-neutral-800"
                    @click="stopMusic"
                >
                    <Square fill="white" class="w-4 h-4" />
                </button>
            </div>
        </div>

        <div
            v-else
            class="flex items-center justify-center h-10 text-neutral-400 text-sm"
        >
            No music playing
        </div>

        <div v-if="musicState" class="mt-5">
            <div class="h-1 bg-neutral-800 rounded-full overflow-hidden">
                <div
                    class="bg-rose-500 h-full"
                    :style="{
                        width: `${
                            (musicState.time / musicState.duration) * 100
                        }%`,
                    }"
                ></div>
            </div>
            <div class="flex justify-between text-xs text-neutral-400 mt-1">
                <span>{{ formatTime(musicState.time) }}</span>
                <span>{{ formatTime(musicState.duration) }}</span>
            </div>
        </div>
    </div>
</template>
