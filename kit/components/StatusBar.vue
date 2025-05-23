<script setup lang="ts">
const props = defineProps({
    static: {
        type: Boolean,
        default: false,
    },
});
</script>

<template>
    <div
        :class="{
            static: props.static,
            absolute: !props.static,
        }"
        class="z-10 flex px-1.5 items-center gap-2 bottom-0 w-full left-0 h-16 border-t border-t-neutral-800 bg-neutral-900/50 backdrop-blur-lg"
    >
        <slot />
    </div>
</template>
