<script setup lang="ts">
import { computed, onMounted, onUnmounted } from "vue";

const props = defineProps({
    name: {
        type: String,
        required: true,
    },
    keybind: {
        type: String,
        required: true,
    },
    destructive: {
        type: Boolean,
        default: false,
    },
});

const emit = defineEmits<{
    (e: "actionTriggered"): void;
}>();

let keyEventListener: (event: KeyboardEvent) => void;

const displayedKeybind = computed(() => {
    // Format the keybind for display
    return props.keybind
        .toLowerCase()
        .replace("ctrl", "^")
        .replace("shift", "⇧")
        .replace("alt", "⌥")
        .replace("cmd", "⌘")
        .replace("enter", "⏎")
        .replace("esc", "⎋")
        .replace("backspace", "⌫")
        .replace("+", "")
        .replace(" ", "")
        .toUpperCase();
});
onMounted(() => {
    // Register the keybind action with the app
    const splittedKeybind = props.keybind
        .split("+")
        .map((k) => k.trim().toLowerCase());

    keyEventListener = (event: KeyboardEvent) => {
        // Only trigger if all modifiers match and the main key matches
        let required = {
            ctrl: splittedKeybind.includes("ctrl"),
            shift: splittedKeybind.includes("shift"),
            alt: splittedKeybind.includes("alt"),
            meta: splittedKeybind.includes("cmd"),
        };

        // Check modifiers
        if (
            event.ctrlKey !== required.ctrl ||
            event.shiftKey !== required.shift ||
            event.altKey !== required.alt ||
            event.metaKey !== required.meta
        ) {
            return;
        }

        // Find the main key (not a modifier)
        const mainKey = splittedKeybind.find(
            (k) => k !== "ctrl" && k !== "shift" && k !== "alt" && k !== "cmd"
        );

        // If no main key, do nothing
        if (!mainKey) return;

        // Check if the pressed key matches the main key
        if (
            (mainKey === "enter" && event.key === "Enter") ||
            (mainKey === "esc" && event.key === "Escape") ||
            (mainKey === "backspace" && event.key === "Backspace") ||
            event.key.toLowerCase() === mainKey
        ) {
            emit("actionTriggered");
        }
    };
    document.addEventListener("keydown", keyEventListener);
});

onUnmounted(() => {
    if (keyEventListener) {
        document.removeEventListener("keydown", keyEventListener);
    }
});
</script>

<template>
    <button
        @click="emit('actionTriggered')"
        class="text-sm outline-0 flex items-center gap-3 py-1.5 px-2 rounded-md hover:inset-shadow-2xs inset-shadow-white/10 transition cursor-pointer active:bg-neutral-700 hover:bg-neutral-800"
        :class="{
            'text-red-400': props.destructive,
        }"
    >
        {{ name }}
        <span
            class="bg-white/10 px-1.5 py-1 font-mono rounded-md inset-shadow-2xs inset-shadow-white/10 text-xs"
        >
            {{ displayedKeybind }}
        </span>
    </button>
</template>
