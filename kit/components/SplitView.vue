<template>
    <div class="flex h-full">
        <div
            class="overflow-auto flex flex-col"
            :style="{ width: `${leadingWidth}px` }"
            ref="leadingSection"
        >
            <slot name="leading" />
        </div>
        <div
            @mousedown="startResize"
            @dblclick="leadingWidth = 384"
            class="h-full group cursor-col-resize"
        >
            <div
                class="w-px h-full mx-1 bg-neutral-800 group-hover:bg-neutral-500"
            ></div>
        </div>
        <div class="overflow-auto flex-1 flex flex-col">
            <slot name="trailing" />
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from "vue";

// State
const leadingWidth = ref<number>(384); // Default width
const isResizing = ref<boolean>(false);
const leadingSection = ref<HTMLElement | null>(null);

// Methods
const startResize = (e: MouseEvent): void => {
    isResizing.value = true;
    e.preventDefault();
};

const handleResize = (e: MouseEvent): void => {
    if (isResizing.value && leadingSection.value) {
        const containerRect =
            leadingSection.value.parentElement?.getBoundingClientRect();

        if (containerRect) {
            let newWidth = e.clientX - containerRect.left;

            // Set min and max width limits
            const minWidth = 100;
            const maxWidth = containerRect.width - 100;

            newWidth = Math.max(minWidth, Math.min(newWidth, maxWidth));
            leadingWidth.value = newWidth;
        }
    }
};

const stopResize = (): void => {
    isResizing.value = false;
};

// Lifecycle hooks
onMounted(() => {
    window.addEventListener("mousemove", handleResize);
    window.addEventListener("mouseup", stopResize);
});

onBeforeUnmount(() => {
    window.removeEventListener("mousemove", handleResize);
    window.removeEventListener("mouseup", stopResize);
});
</script>
