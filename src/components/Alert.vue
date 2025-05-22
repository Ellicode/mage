<script setup lang="ts">
import {
    CheckCircle,
    Fingerprint,
    Info,
    Navigation,
    TriangleAlert,
    XOctagon,
} from "lucide-vue-next";
import { onMounted, onUnmounted, watch } from "vue";
import AlertButton from "./AlertButton.vue";

const props = defineProps({
    title: {
        type: String,
        default: "No data",
    },
    description: {
        type: String,
    },
    type: {
        type: String as () =>
            | "info"
            | "error"
            | "warning"
            | "success"
            | "security.location",
        default: "info",
    },
});

const model = defineModel();
let eventListener: EventListener | null = null;
let audio: HTMLAudioElement | null = null;
onMounted(async () => {
    eventListener = (event: Event) => {
        if (model.value) {
            event.preventDefault();
            event.stopPropagation();
            if ((event as KeyboardEvent).key === "Escape") {
                model.value = false;
            }
        }
    };
    const response = await fetch("./src/assets/sounds/alert.mp3");
    const blob = await response.blob();
    const audioDataURL = URL.createObjectURL(blob);

    audio = new Audio(audioDataURL);

    document.addEventListener("keydown", eventListener);
});

watch(
    () => model.value,
    (newValue) => {
        if (!audio) return;

        if (newValue) {
            audio.play();
        } else {
            audio.pause();
            audio.currentTime = 0;
        }
    },
    { immediate: true }
);

onUnmounted(() => {
    if (eventListener) {
        document.removeEventListener("keydown", eventListener);
    }
});
</script>

<template>
    <Teleport to="body">
        <Transition
            enter-active-class="transition duration-200 ease-out"
            enter-from-class="transform scale-95 opacity-0"
            enter-to-class="transform scale-100 opacity-100"
            leave-active-class="transition duration-150 ease-in"
            leave-from-class="transform scale-100 opacity-100"
            leave-to-class="transform scale-95 opacity-0"
        >
            <div
                v-if="model"
                class="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
                <div
                    class="fixed inset-0 bg-black/30 scale-200"
                    @click="model = false"
                ></div>
                <div
                    class="relative bg-neutral-900 inset-shadow-2xs inset-shadow-neutral-800 text-white rounded-3xl shadow-2xl border border-neutral-950 max-w-xs flex flex-col items-center w-full p-6 z-10"
                >
                    <Info
                        v-if="type === 'info'"
                        class="w-8 h-8 text-blue-400"
                    />
                    <XOctagon
                        v-else-if="type === 'error'"
                        class="w-8 h-8 text-red-400"
                    />
                    <TriangleAlert
                        v-else-if="type === 'warning'"
                        class="w-8 h-8 text-yellow-400"
                    />
                    <CheckCircle
                        v-else-if="type === 'success'"
                        class="w-8 h-8 text-green-400"
                    />

                    <div
                        v-else-if="type.startsWith('security')"
                        class="w-10 h-10 relative bg-blue-500 rounded-lg flex items-center justify-center inset-shadow-blue-400 inset-shadow-2xs"
                    >
                        <Fingerprint class="w-6 h-6 text-white" />
                        <div
                            class="absolute animate-pop -bottom-3 -right-3 rounded-md bg-neutral-800 w-6 h-6 shadow-xl inset-shadow-neutral-700 inset-shadow-2xs flex items-center justify-center"
                        >
                            <Navigation
                                fill="#51a2ff"
                                class="w-3 h-3 text-blue-400"
                                v-if="type === 'security.location'"
                            />
                        </div>
                    </div>
                    <h3 class="text-lg text-center mt-5">{{ title }}</h3>
                    <p class="text-sm text-center text-neutral-400 mt-2">
                        {{ description }}
                    </p>
                    <div class="flex flex-col gap-3 mt-5 w-full">
                        <slot>
                            <AlertButton @click="model = false">
                                Close
                            </AlertButton>
                        </slot>
                    </div>
                </div>
            </div>
        </Transition>
    </Teleport>
</template>

<style scoped>
.fixed {
    position: fixed;
}

.animate-pop {
    animation: pop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

@keyframes pop {
    0% {
        transform: scale(0);
    }
    100% {
        transform: scale(1);
    }
}
</style>
