<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from "vue";
import { Bell, Clock, Clock12, Pause, Play, X, BellOff } from "lucide-vue-next";
import {
    getCurrentTimerState,
    toggleTimer,
    stopTimer,
    startTimer,
} from "./index";
import { clientProcessHandler } from "../../kit/process";

const timerState = ref<any>(null);
const updateInterval = ref<number | null>(null);

onMounted(() => {
    // Get initial timer state
    updateTimerState();

    // Update every second
    updateInterval.value = window.setInterval(updateTimerState, 200);
});

onUnmounted(() => {
    if (updateInterval.value !== null) {
        clearInterval(updateInterval.value);
    }
});

const updateTimerState = async () => {
    try {
        const state = await getCurrentTimerState();
        if (state) {
            timerState.value = state;
        }
    } catch (error) {
        console.error("Failed to update timer state:", error);
    }
};

const togglePlayPause = async () => {
    if (timerState.value) {
        await toggleTimer();
        updateTimerState();
    }
};

// Format time for display
const formatTime = (totalSeconds: number) => {
    if (totalSeconds === undefined || totalSeconds === null) return "00:00:00";

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds
            .toString()
            .padStart(2, "0")}`;
    } else {
        return `${minutes.toString().padStart(2, "0")}:${seconds
            .toString()
            .padStart(2, "0")}`;
    }
};

// Calculate progress percentage
const progressPercent = computed(() => {
    if (!timerState.value) return 0;

    const { initialTime, remainingTime } = timerState.value;
    if (initialTime <= 0) return 0;

    return Math.max(
        0,
        Math.min(100, ((initialTime - remainingTime) / initialTime) * 100)
    );
});

const snooze = async (minutes: number) => {
    if (timerState.value) {
        await stopTimer();
        await startTimer(0, minutes, 0);
        updateTimerState();
    }
};

// Toggle mute status using the custom method
const toggleMute = async () => {
    if (timerState.value) {
        try {
            const processes = await clientProcessHandler(
                "com.ellicode.timer"
            ).getProcesses();
            const timerProcess = processes.find((p) => p.name === "Timer");

            if (timerProcess) {
                // Call the custom toggleMute method on the process
                const muted = await clientProcessHandler(
                    "com.ellicode.timer"
                ).callMethod(timerProcess.id, "toggleMute");
                console.log("Alarm muted:", muted);
                // Force update timer state
                updateTimerState();
            }
        } catch (error) {
            console.error("Failed to toggle mute:", error);
        }
    }
};
</script>

<template>
    <div v-if="timerState" class="p-4">
        <transition name="fade" mode="out-in">
            <div class="flex flex-col" v-if="!timerState.alarmRinging">
                <div class="flex items-center gap-3">
                    <div
                        class="w-10 h-10 bg-neutral-800 rounded-lg flex items-center justify-center"
                    >
                        <Clock12
                            class="w-6 h-6"
                            :class="{
                                'animate-spin': timerState.running,
                                'text-amber-500': timerState.running,
                                'text-neutral-500': !timerState.running,
                            }"
                            style="animation-duration: 10s"
                        />
                    </div>

                    <span
                        class="text-xl tracking-wider flex-1 font-medium mx-2"
                    >
                        {{ formatTime(timerState.remainingTime) }}
                    </span>
                    <div class="flex gap-2">
                        <button
                            class="w-8 h-8 rounded-full flex items-center justify-center hover:bg-neutral-800"
                            @click="togglePlayPause"
                        >
                            <Pause
                                fill="white"
                                v-if="timerState.running"
                                class="w-4 h-4"
                            />
                            <Play fill="white" v-else class="w-4 h-4" />
                        </button>
                        <button
                            class="w-8 h-8 rounded-full flex items-center justify-center hover:bg-neutral-800"
                            @click="stopTimer"
                        >
                            <X fill="white" class="w-4 h-4" />
                        </button>
                        <button
                            v-if="timerState.alarmRinging"
                            class="w-8 h-8 rounded-full flex items-center justify-center hover:bg-neutral-800"
                            @click="toggleMute"
                        >
                            <Bell
                                v-if="!timerState.muted"
                                fill="white"
                                class="w-4 h-4"
                            />
                            <BellOff v-else fill="white" class="w-4 h-4" />
                        </button>
                    </div>
                </div>

                <div class="mt-8">
                    <div
                        class="h-1 bg-neutral-800 rounded-full overflow-hidden"
                    >
                        <div
                            class="h-full transition-all duration-400 ease-in-out"
                            :class="{
                                'bg-amber-500': timerState.running,
                                'bg-neutral-500': !timerState.running,
                            }"
                            :style="{
                                width: `${progressPercent}%`,
                            }"
                        ></div>
                    </div>
                </div>
                <div class="flex justify-between text-xs text-neutral-400 mt-1">
                    <span>{{ formatTime(timerState.remainingTime) }}</span>
                    <span>{{ formatTime(timerState.initialTime) }}</span>
                </div>
            </div>
            <div class="flex flex-col" v-else>
                <div class="flex gap-3 items-center">
                    <Bell class="text-amber-500 w-5 h-5 animate-shake" />

                    <span class="text-lg">Alarm complete</span>
                </div>
                <div class="flex flex-1 mt-3 gap-3">
                    <button
                        class="flex-1 h-12 rounded-lg text-lg font-medium cursor-pointer transition-all bg-neutral-800 hover:bg-neutral-700 active:scale-95 flex items-center justify-center"
                        @click="snooze(5)"
                    >
                        + 5 minutes
                    </button>
                    <button
                        class="flex-1 h-12 rounded-lg text-lg font-medium cursor-pointer transition-all bg-amber-500/20 hover:bg-amber-500/30 text-amber-500 active:scale-95 flex items-center justify-center"
                        @click="stopTimer"
                    >
                        Stop
                    </button>
                </div>
            </div>
        </transition>
    </div>
</template>

<style scoped>
.animate-shake {
    animation: shake 0.5s ease-in-out infinite;
}
@keyframes shake {
    0% {
        transform: rotate(0deg);
    }
    25% {
        transform: rotate(5deg);
    }
    50% {
        transform: rotate(-5deg);
    }
    75% {
        transform: rotate(5deg);
    }
    100% {
        transform: rotate(0deg);
    }
}

.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.5s;
}
.fade-enter-from,
.fade-leave-to /* .fade-leave-active in <2.1.8 */ {
    opacity: 0;
}
</style>
