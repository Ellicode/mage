<script setup lang="ts">
const props = defineProps({
    title: {
        type: String,
        default: "No data",
    },
    description: {
        type: String,
        default: "No data",
    },
});
</script>
<template>
    <div class="flex-1 h-full flex flex-col items-center justify-center">
        <slot name="icon" />
        <div class="text-2xl mt-3 font-medium text-white">
            {{ props.title }}
        </div>
        <div class="text-neutral-500 mt-2">{{ props.description }}</div>
    </div>
</template>
