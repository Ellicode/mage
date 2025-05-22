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
            'text-blue-400': type === 'accent',
            'text-red-400': type === 'destructive',
            'text-neutral-100': type === 'default',
        }"
        class="w-full h-10 rounded-lg text-lg font-medium cursor-pointer transition-all bg-neutral-800 hover:bg-neutral-700 active:scale-95 flex items-center justify-center inset-shadow-neutral-700 inset-shadow-2xs"
    >
        <slot />
    </button>
</template>
