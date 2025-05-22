<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed } from "vue";
import { Play, Pause, RotateCcw, Bell } from "lucide-vue-next";
import {
    startTimer,
    stopTimer,
    toggleTimer,
    getCurrentTimerState,
    isTimerRunning,
    calculateTotalSeconds,
    formatTimeString,
} from "./index";
import { clientProcessHandler } from "../../kit/sdk";

// Get the client process handler for timer processes
const processHandler = clientProcessHandler("com.ellicode.timer");

const suggestedTimers = ref([
    { hours: 0, minutes: 0, seconds: 30 },
    { hours: 0, minutes: 5, seconds: 0 },
    { hours: 0, minutes: 15, seconds: 0 },
    { hours: 0, minutes: 30, seconds: 0 },
    { hours: 1, minutes: 0, seconds: 0 },
    { hours: 1, minutes: 30, seconds: 0 },
]);

// Time inputs
const hours = ref(0);
const minutes = ref(15);
const seconds = ref(0);

// Timer state
const timerState = ref<any>(null);
const isActive = ref(false);
const updateInterval = ref<number | null>(null);

// Formatted remaining time (00:00:00)
const formattedTime = computed(() => {
    if (timerState.value && timerState.value.remainingTime !== undefined) {
        return formatTimeString(timerState.value.remainingTime);
    }
    return formatTimeString(
        calculateTotalSeconds(hours.value, minutes.value, seconds.value)
    );
});

// Update timer state
const updateTimerState = async () => {
    try {
        const state = await getCurrentTimerState();
        timerState.value = state;
        isActive.value = !!state;
    } catch (error) {
        console.error("Error updating timer state:", error);
    }
};

// Handle timer start/resume
const handleStartTimer = async () => {
    if (isActive.value) {
        // Toggle pause/resume if already active
        await toggleTimer();
    } else {
        // Start new timer
        await startTimer(hours.value, minutes.value, seconds.value);
    }
    updateTimerState();
};

// Handle timer reset
const handleResetTimer = async () => {
    await stopTimer();
    updateTimerState();
};

// Initialize and cleanup
onMounted(async () => {
    // Check for any existing timer
    await updateTimerState();

    // Set up periodic updates
    updateInterval.value = window.setInterval(updateTimerState, 200);
});

onBeforeUnmount(() => {
    if (updateInterval.value !== null) {
        clearInterval(updateInterval.value);
    }
});

const snooze = async (minutes: number) => {
    if (timerState.value) {
        await stopTimer();
        await startTimer(0, minutes, 0);
        updateTimerState();
    }
};
</script>

<template>
    <div
        class="flex flex-col h-full items-center justify-center gap-8 p-5 relative"
    >
        <!-- SVG Circle Gauge -->
        <svg
            class="w-96 h-96 pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
            viewBox="0 0 100 100"
        >
            <!-- Background circle -->
            <circle
                cx="50"
                cy="50"
                r="45"
                fill="transparent"
                stroke="#262626"
                stroke-width="1"
            />
            <!-- Progress circle -->
            <circle
                cx="50"
                cy="50"
                r="45"
                fill="transparent"
                stroke="#fe9a00"
                stroke-width="1"
                class="transition-[stroke-dashoffset] duration-500"
                stroke-linecap="round"
                :stroke-dasharray="282.74"
                :stroke-dashoffset="
                    timerState &&
                    timerState.remainingTime !== undefined &&
                    timerState.initialTime
                        ? (282.74 * timerState.remainingTime) /
                          timerState.initialTime
                        : 0
                "
                transform="rotate(-90, 50, 50)"
            />
        </svg>
        <transition name="center-digits" mode="out-in">
            <div v-if="!isActive" class="flex items-start">
                <div
                    class="flex flex-col items-center justify-center gap-1 p-2"
                >
                    <input
                        type="number"
                        v-model="hours"
                        min="0"
                        max="23"
                        class="w-16 text-center text-4xl outline-0 appearance-none number-remove-arrow"
                    />
                    <div class="text-sm text-neutral-400">Hours</div>
                </div>
                <span class="text-4xl text-neutral-400 mt-2">:</span>
                <div
                    class="flex flex-col items-center justify-center gap-1 p-2"
                >
                    <input
                        type="number"
                        v-model="minutes"
                        min="0"
                        max="59"
                        class="w-16 text-center text-4xl outline-0 appearance-none number-remove-arrow"
                    />
                    <div class="text-sm text-neutral-400">Minutes</div>
                </div>
                <span class="text-4xl text-neutral-400 mt-2">:</span>
                <div
                    class="flex flex-col items-center justify-center gap-1 p-2"
                >
                    <input
                        type="number"
                        v-model="seconds"
                        min="0"
                        max="59"
                        class="w-16 text-center text-4xl outline-0 appearance-none number-remove-arrow"
                    />
                    <div class="text-sm text-neutral-400">Seconds</div>
                </div>
            </div>
            <div
                v-else-if="timerState.alarmRinging"
                class="flex flex-col items-center justify-center gap-3"
            >
                <Bell class="text-amber-500 w-10 h-10 animate-shake" />
                <span class="text-lg">Alarm complete</span>
                <button
                    class="flex-1 py-3 w-60 rounded-2xl text-lg font-medium cursor-pointer transition-all bg-neutral-800 hover:bg-neutral-700 active:scale-95 flex items-center justify-center"
                    @click="snooze(5)"
                >
                    + 5 minutes
                </button>
                <button
                    class="flex-1 py-3 w-60 rounded-2xl text-lg font-medium cursor-pointer transition-all bg-amber-500/20 hover:bg-amber-500/30 text-amber-500 active:scale-95 flex items-center justify-center"
                    @click="stopTimer"
                >
                    Stop
                </button>
            </div>
            <div v-else class="text-5xl tracking-wider font-medium">
                {{ formattedTime }}
            </div>
        </transition>
        <div class="flex gap-4" v-if="!timerState?.alarmRinging">
            <button
                @click="handleStartTimer"
                class="h-12 w-12 rounded-full inset-shadow-2xs inset-shadow-white/20 border border-amber-600 cursor-pointer transition-all bg-amber-500 hover:bg-amber-600 active:scale-95 flex items-center justify-center"
            >
                <Pause
                    v-if="timerState && timerState.running"
                    class="w-6 h-6 text-white"
                />
                <Play v-else class="w-6 h-6 text-white" />
            </button>

            <button
                @click="handleResetTimer"
                class="h-12 w-12 rounded-full inset-shadow-2xs inset-shadow-white/20 border border-neutral-950 cursor-pointer transition-all bg-neutral-700 hover:bg-neutral-600 active:scale-95 flex items-center justify-center"
            >
                <RotateCcw class="w-5 h-5" />
            </button>
        </div>

        <div
            class="absolute bottom-0 gap-2 flex left-0 w-full p-2"
            v-if="!isActive"
        >
            <button
                v-for="(timer, index) in suggestedTimers"
                @click="
                    () => {
                        hours = timer.hours;
                        minutes = timer.minutes;
                        seconds = timer.seconds;
                    }
                "
                class="rounded-lg hover:inset-shadow-2xs inset-shadow-white/20 cursor-pointer transition-all hover:bg-neutral-800 active:scale-95 flex items-center justify-center px-3 py-1.5 text-sm"
            >
                <span v-if="timer.hours > 0">{{ timer.hours }}h</span>
                <span v-if="timer.minutes > 0">{{ timer.minutes }}m</span>
                <span v-if="timer.seconds > 0">{{ timer.seconds }}s</span>
            </button>
        </div>
    </div>
</template>

<style scoped>
.number-remove-arrow {
    -moz-appearance: textfield;
    appearance: textfield;
}
/* Firefox */
input[type="number"]::-webkit-inner-spin-button,
input[type="number"]::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
}
/* Transitions for timer display */
.center-digits-enter-active,
.center-digits-leave-active {
    transition: all 0.2s cubic-bezier(0.87, 0, 0.13, 1);
}
.center-digits-enter-from,
.center-digits-leave-to {
    opacity: 0;
    filter: blur(10px);
    transform: scale(0.8);
}

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
</style>
