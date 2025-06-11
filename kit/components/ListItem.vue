<script setup lang="ts">
const props = defineProps({
    active: {
        type: Boolean,
        default: false,
    },
    title: {
        type: String,
        default: "No data",
    },
    description: {
        type: String,
    },
});
</script>

<template>
    <button
        class="h-14 m-2 mb-0 outline-0 shrink-0 flex gap-4 items-center px-3 inset-shadow-neutral-700 rounded-lg cursor-pointer"
        :class="{
            'bg-neutral-800 inset-shadow-2xs': active,
            'hover:bg-neutral-800 hover:inset-shadow-2xs': !active,
        }"
    >
        <slot name="icon" class="shrink-0" />
        <div class="flex flex-col items-start truncate">
            <span>{{ title }}</span>
            <span v-if="description" class="text-neutral-500 text-xs">{{
                description
            }}</span>
        </div>
        <div class="flex-1"></div>
        <slot name="append" />
    </button>
</template>
