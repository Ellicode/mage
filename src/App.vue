<script setup lang="ts">
import { onMounted, ref, onBeforeUnmount } from "vue";
import { Intent } from "./types";
import Icon from "./components/Icon.vue";

import ListItem from "../kit/ListItem.vue";
import {
    ArrowLeft,
    CircleArrowOutUpLeft,
    CornerDownLeft,
} from "lucide-vue-next";
import {
    BackgroundProcess,
    getAllClientProcesses,
    componentRegistry,
} from "../kit/process";
import Alert from "./components/Alert.vue";

const isMenuOpen = ref(false);
const searchInput = ref<HTMLInputElement | null>(null);
const query = ref("");
const searchResults = ref<Intent[]>([]);
const widget = ref<Intent | null>(null);
const selectedIndex = ref(-1); // Track the currently selected item

const search = async () => {
    if (query.value.length > 0) {
        const data = await window.ipcRenderer.invoke("search", query.value);
        searchResults.value = data.filter((result: Intent) => {
            return result.type !== "widget";
        });
        widget.value = data.find((result: Intent) => {
            return result.type === "widget";
        }) as Intent;
        // Reset selected index when search results change
        selectedIndex.value = searchResults.value.length > 0 ? 0 : -1;
    } else {
        searchResults.value = [];
        selectedIndex.value = -1;
    }
};

const navigateUp = () => {
    if (selectedIndex.value > 0) {
        selectedIndex.value--;
    } else if (searchResults.value.length > 0) {
        selectedIndex.value = searchResults.value.length - 1;
    }
};

const navigateDown = () => {
    if (selectedIndex.value < searchResults.value.length - 1) {
        selectedIndex.value++;
    } else {
        selectedIndex.value = 0;
    }
};
const page = ref<"search" | "application">("search");
const activePageComponent = ref(null);
const activeIntent = ref<Intent | null>(null);

const executeIntent = (intent: Intent) => {
    // You can add the code to execute the intent here
    if (intent.type === "menu") {
        const component = import(
            /* @vite-ignore */
            `../apps/${intent.application?.appScheme}/${intent.src.replace(
                "@/",
                ""
            )}`
        );
        component.then((module) => {
            activePageComponent.value = module.default;
            activeIntent.value = intent;
            page.value = "application"; // Set the page to 1 when a menu is opened
        });
    } else if (intent.type === "openApp") {
        window.ipcRenderer.send("open-app", {
            appPath: intent.appPath,
        });
    }
};

const handleKeydown = (e: KeyboardEvent) => {
    if (!isMenuOpen.value) return;

    switch (e.key) {
        case "ArrowUp":
            e.preventDefault();
            navigateUp();
            break;
        case "ArrowDown":
            e.preventDefault();
            navigateDown();
            break;
        case "Enter":
            if (
                selectedIndex.value >= 0 &&
                selectedIndex.value < searchResults.value.length
            ) {
                executeIntent(searchResults.value[selectedIndex.value]);
            }
            break;
        case "Escape":
            e.preventDefault();

            if (page.value === "search") {
                closeMenu();
            } else {
                page.value = "search"; // Go back to the search page
                activePageComponent.value = null; // Reset the active component
                activeIntent.value = null; // Reset the active intent
                searchInput.value?.focus(); // Refocus the search input
            }
            break;
    }
};

// Keep track of background processes
const backgroundProcesses = ref<BackgroundProcess[]>([]);
const clientProcesses = ref<BackgroundProcess[]>([]);
const allProcesses = ref<BackgroundProcess[]>([]);
const updateInterval = ref<number | null>(null);

// Function to update background process states
const updateBackgroundProcesses = async () => {
    try {
        console.log("Requesting background processes from main...");
        // Get all background processes from main process - pass an empty object explicitly
        const mainProcesses = await window.ipcRenderer.invoke(
            "get-main-background-processes",
            {}
        );

        // Make sure we get an array back, and assign it if valid
        if (Array.isArray(mainProcesses)) {
            // Transform the processes to resolve component references
            backgroundProcesses.value = mainProcesses.map((p) => ({
                ...p,
                // Restore component from registry if available
                liveActivityComponent:
                    p.liveActivityComponentName &&
                    componentRegistry[p.liveActivityComponentName]
                        ? componentRegistry[p.liveActivityComponentName]
                        : p.liveActivityComponentName,
                // Add stub functions since they can't be sent over IPC
                action: (data) => console.log(`Action stub for ${p.name}`),
                pause: () => console.log(`Pause stub for ${p.name}`),
                resume: () => console.log(`Resume stub for ${p.name}`),
            }));

            // if (mainProcesses.length > 0) {
            //     console.log(
            //         "Found main processes:",
            //         mainProcesses.map((p) => `${p.name} (${p.id})`).join(", ")
            //     );
            // } else {
            //     console.log("No main background processes found");
            // }
        } else {
            console.error(
                "Invalid background processes data format:",
                mainProcesses
            );
            backgroundProcesses.value = [];
        }

        // Get client processes from renderer - these already have their real components and functions
        try {
            const rendererProcesses = getAllClientProcesses();
            // console.log(`Found ${rendererProcesses.length} client processes`);
            clientProcesses.value = rendererProcesses;

            // if (rendererProcesses.length > 0) {
            //     console.log(
            //         "Found client processes:",
            //         rendererProcesses
            //             .map((p) => `${p.name} (${p.id})`)
            //             .join(", ")
            //     );
            // }
        } catch (error) {
            console.error("Failed to get client processes:", error);
            clientProcesses.value = [];
        }

        // Merge all processes
        allProcesses.value = [
            ...backgroundProcesses.value,
            ...clientProcesses.value,
        ];

        // console.log(
        //     `Total processes: ${allProcesses.value.length} (${backgroundProcesses.value.length} main, ${clientProcesses.value.length} client)`
        // );
    } catch (error) {
        console.error("Failed to fetch background processes:", error);
        backgroundProcesses.value = [];
        clientProcesses.value = [];
        allProcesses.value = [];
    }
};

// Test function to create a dummy process for debugging
const createTestProcess = async () => {
    try {
        console.log("Creating test background process");
        const result = await window.ipcRenderer.invoke(
            "create-main-background-process",
            {
                name: "TestProcess",
                appScheme: "com.test",
                data: { id: 999, test: true },
            }
        );
        console.log("Test process creation result:", result);
        updateBackgroundProcesses();
    } catch (error) {
        console.error("Error creating test process:", error);
    }
};

onMounted(() => {
    window.ipcRenderer.on("toggle-menu", (event, message) => {
        console.log(message);
        isMenuOpen.value = message;
        if (isMenuOpen.value) {
            setTimeout(() => {
                searchInput.value?.focus();
            }, 100);

            // Update process status when menu is opened
            updateBackgroundProcesses();
        } else {
            searchInput.value?.blur();
        }
    });

    // Update more frequently during initial load to catch any processes
    setTimeout(() => updateBackgroundProcesses(), 200);
    setTimeout(() => updateBackgroundProcesses(), 500);

    // Improve update frequency for better responsiveness (every 1 second)
    updateInterval.value = window.setInterval(() => {
        updateBackgroundProcesses().catch((error) => {
            console.error("Background process update failed:", error);
        });
    }, 1000);

    // Register for background process events with improved error handling
    window.ipcRenderer.on("background-process-update", (event, data) => {
        console.log("Background process update event received:", data);
        updateBackgroundProcesses();
    });

    // Listen for client process updates
    window.ipcRenderer.on("client-process-updated", (event, data) => {
        console.log("Client process update event received:", data);
        updateBackgroundProcesses();
    });

    // Initial update with immediate retry on failure
    updateBackgroundProcesses().catch((error) => {
        console.error("Initial background process update failed:", error);
        // Try again after a short delay
        setTimeout(updateBackgroundProcesses, 500);
    });

    // Add test button to create a process for debugging
    window.addEventListener("keydown", (e) => {
        if (e.key === "F12") {
            debug.value = !debug.value;
        }
        handleKeydown(e);
    });
});

onBeforeUnmount(() => {
    // Clean up the interval when component is unmounted
    if (updateInterval.value) {
        clearInterval(updateInterval.value);
    }

    window.ipcRenderer.off(
        "background-process-update",
        updateBackgroundProcesses
    );

    window.ipcRenderer.off("client-process-updated", updateBackgroundProcesses);
});

const debug = ref(false);

const closeMenu = () => {
    isMenuOpen.value = false;
    setTimeout(() => {
        window.ipcRenderer.send("ui-toggle-menu", false);
    }, 100);
};
const back = () => {
    page.value = "search"; // Go back to the search page
    activePageComponent.value = null; // Reset the active component
    activeIntent.value = null; // Reset the active intent
    searchInput.value?.focus(); // Refocus the search input
};

const focusWindow = () => {
    window.ipcRenderer.send("ui-toggle-menu", true);
    console.log("Focusing window");
};
const blurWindow = () => {
    window.ipcRenderer.send("ui-toggle-menu", false);
    console.log("Blurring window");
};

const showAlert = ref(false);
const alertTitle = ref("Test Alert");
const alertDescription = ref("This is a test description");
const alertType = ref<
    "info" | "error" | "warning" | "success" | "security.location"
>("security.location"); // Can be "info", "warning", or "error"
</script>

<template>
    <div
        class="flex flex-col select-none items-center justify-center w-screen h-screen"
        @mousedown.self="closeMenu"
    >
        <div class="max-w-3xl h-10 w-full flex items-start">
            <transition name="open-menu" mode="out-in">
                <div
                    v-if="activeIntent && isMenuOpen"
                    class="flex items-center border border-neutral-950 inset-shadow-xs inset-shadow-neutral-800 bg-neutral-900 mb-3 rounded-lg"
                >
                    <button
                        @click="back"
                        class="border-e outline-0 cursor-pointer border-neutral-800 px-2 py-1.5 rounded-l-lg hover:bg-neutral-800 active:bg-neutral-700 transition"
                    >
                        <ArrowLeft class="w-4 h-4 text-white" />
                    </button>
                    <Icon
                        v-if="
                            activeIntent.application?.icon.type ===
                            'lucide-icon'
                        "
                        :name="activeIntent.application.icon.name"
                        :size="18"
                        strokeWidth="2"
                        :style="{
                            color: activeIntent.application?.icon.color,
                        }"
                        class="w-4 h-4 ms-2 shrink-0 my-1.5 text-white"
                    />
                    <span
                        class="text-neutral-100 text-sm mx-2 me-1.5 font-medium ml-3"
                    >
                        {{ activeIntent.application?.name }}
                    </span>
                </div>
            </transition>
        </div>
        <transition name="open-menu" mode="out-in">
            <div
                v-if="isMenuOpen"
                class="w-full relative text-neutral-100 max-w-3xl shadow-2xl shadow-black/75 bg-neutral-900 rounded-xl border border-neutral-950"
                :class="{
                    'h-[500px]': page === 'application',
                }"
            >
                <div
                    v-if="allProcesses.length > 0 && debug"
                    class="absolute top-0 right-0 p-2 z-10"
                >
                    <div class="text-xs bg-neutral-800 py-1 px-2 rounded-md">
                        Active Processes: {{ allProcesses.length }} ({{
                            backgroundProcesses.length
                        }}
                        main, {{ clientProcesses.length }} client)
                    </div>
                </div>
                <template v-if="page === 'search'">
                    <div
                        class="flex items-center rounded-t-xl h-16 inset-shadow-xs inset-shadow-neutral-800 p-3"
                        :class="{
                            'border-b border-neutral-800':
                                searchResults.length > 0,
                        }"
                    >
                        <input
                            type="text"
                            ref="searchInput"
                            @input="search"
                            v-model="query"
                            class="h-full flex-1 font-medium text-lg outline-0 text-white placeholder:text-neutral-500 px-2"
                            placeholder="Search anything"
                        />
                    </div>
                    <ul class="flex flex-col">
                        <ListItem
                            v-for="(result, index) in searchResults"
                            :key="result.intentScheme"
                            :title="result.name"
                            :description="result.application?.name"
                            :active="index === selectedIndex"
                            @click="executeIntent(result)"
                            @mouseover="selectedIndex = index"
                        >
                            <template #icon>
                                <div
                                    class="w-7 h-7 flex items-center justify-center rounded-md inset-shadow-xs inset-shadow-white/30"
                                    v-if="
                                        result.application?.icon.type ===
                                        'lucide-icon'
                                    "
                                    :style="{
                                        backgroundColor:
                                            result.application?.icon.color,
                                    }"
                                >
                                    <Icon
                                        :name="result.application.icon.name"
                                        :size="18"
                                        strokeWidth="2"
                                        class="w-4 h-4 text-white"
                                    />
                                </div>
                                <img
                                    class="w-7 h-7"
                                    v-else-if="
                                        result.application?.icon.type ===
                                        'image'
                                    "
                                    :src="result.application.icon.value"
                                />
                            </template>
                            <template #append>
                                <div
                                    v-if="
                                        allProcesses.filter(
                                            (p) =>
                                                p.appScheme ===
                                                result.application!.appScheme
                                        ).length > 0
                                    "
                                    class="relative me-2"
                                >
                                    <div
                                        class="w-2 h-2 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full animate-ping bg-white/50"
                                    ></div>
                                    <div
                                        class="w-1 h-1 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white"
                                    ></div>
                                </div>
                            </template>
                        </ListItem>
                    </ul>
                    <div
                        class="flex gap-5 items-center justify-end border-t border-neutral-800 p-2"
                        v-if="searchResults.length > 0"
                    >
                        <button
                            @click="showAlert = !showAlert"
                            class="text-sm outline-0 flex items-center gap-3 p-1 px-2 rounded-md transition cursor-pointer active:bg-neutral-700 hover:bg-neutral-800"
                        >
                            Execute action
                            <span class="bg-white/10 p-1.5 rounded text-base">
                                <CornerDownLeft
                                    class="w-4 h-4 text-white"
                                    :stroke-width="2"
                                />
                            </span>
                        </button>
                        <button
                            class="text-sm outline-0 flex items-center gap-3 p-1 px-2 rounded-md transition cursor-pointer active:bg-neutral-700 hover:bg-neutral-800"
                            @click="closeMenu"
                        >
                            Exit
                            <span class="bg-white/10 p-1.5 rounded text-base">
                                <CircleArrowOutUpLeft
                                    class="w-4 h-4 text-white"
                                    :stroke-width="2"
                                />
                            </span>
                        </button>
                    </div>
                </template>
                <template v-else-if="page === 'application'">
                    <div class="flex flex-col h-full overflow-hidden">
                        <component :is="activePageComponent" />
                    </div>
                </template>
            </div>
        </transition>
        <transition name="dynamic-island" mode="out-in">
            <div
                @mouseenter="focusWindow"
                @mouseleave="blurWindow"
                class="bg-neutral-900 w-80 text-white h-30 fixed bottom-16 right-2 rounded-3xl border border-neutral-950 shadow-2xl shadow-black/75"
                v-if="
                    allProcesses.length > 0 &&
                    allProcesses[0]?.liveActivityComponent &&
                    !isMenuOpen
                "
            >
                <component
                    :is="
                        typeof allProcesses[0].liveActivityComponent ===
                        'string'
                            ? componentRegistry[
                                  allProcesses[0].liveActivityComponent
                              ]
                            : allProcesses[0].liveActivityComponent
                    "
                    v-if="allProcesses[0]?.liveActivityComponent"
                />
            </div>
        </transition>
    </div>
    <Alert
        v-model="showAlert"
        :title="alertTitle"
        :description="alertDescription"
        :type="alertType"
    />
</template>

<style scoped>
.open-menu-enter-active,
.open-menu-leave-active {
    transition: all 0.2s ease-in-out;
}
.open-menu-enter-from,
.open-menu-leave-to {
    opacity: 0;
    transform: scale(0.95);
}

.dynamic-island-enter-active,
.dynamic-island-leave-active {
    transition: all 1s cubic-bezier(0.16, 1, 0.3, 1);
}
.dynamic-island-enter-from,
.dynamic-island-leave-to {
    opacity: 0;
    transform: translateX(20px) scale(0.95);
    filter: blur(10px);
}
</style>
