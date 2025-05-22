<script setup lang="ts">
const emit = defineEmits<{
    (e: "click"): void;
}>();

const props = defineProps({
    type: {
        type: String as () => "default" | "accent" | "destructive",
        default: "default",
    },
});
</script>
<template>
    <button
        @click="emit('click')"
        :class="{
            'text-white bg-blue-500 hover:bg-blue-400 border-blue-600':
                type === 'accent',
            'text-red-400 bg-neutral-800 hover:bg-neutral-700 border-neutral-950':
                type === 'destructive',
            'text-neutral-100 bg-neutral-800 hover:bg-neutral-700 border-neutral-950':
                type === 'default',
        }"
        class="px-2 py-1.5 gap-2 rounded-lg text-sm border font-medium cursor-pointer transition-all active:scale-95 inline-flex items-center justify-center inset-shadow-white/20 inset-shadow-2xs"
    >
        <slot name="icon" />
        <slot />
    </button>
</template>
