<script setup lang="ts">
import {
    CheckCircle,
    Fingerprint,
    Info,
    Navigation,
    TriangleAlert,
    XOctagon,
} from "lucide-vue-next";
import { onMounted, onUnmounted } from "vue";

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
onMounted(() => {
    eventListener = (event: Event) => {
        if (model.value) {
            event.preventDefault();
            event.stopPropagation();
            if ((event as KeyboardEvent).key === "Escape") {
                model.value = false;
            }
        }
    };
    document.addEventListener("keydown", eventListener);
});

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
                    class="fixed inset-0 bg-black/10"
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
                            class="absolute -bottom-3 -right-3 rounded-md bg-neutral-800 w-6 h-6 shadow-xl inset-shadow-neutral-700 inset-shadow-2xs flex items-center justify-center"
                        >
                            <Navigation
                                fill="#51a2ff"
                                class="w-3 h-3 text-blue-400"
                                v-if="type === 'security.location'"
                            />
                        </div>
                    </div>
                    <h3 class="text-lg mt-5">{{ title }}</h3>
                    <p class="text-sm text-neutral-400 mt-2">
                        {{ description }}
                    </p>
                    <div class="flex flex-col gap-3 mt-5 w-full">
                        <slot>
                            <button
                                @click="model = false"
                                class="w-full h-10 rounded-lg uppercase text-lg font-medium cursor-pointer transition-all bg-neutral-800 hover:bg-neutral-700 active:scale-95 flex items-center justify-center inset-shadow-neutral-700 inset-shadow-2xs"
                            >
                                Ok
                            </button>
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
</style>
