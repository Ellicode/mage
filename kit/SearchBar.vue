<script setup lang="ts">
import { onMounted, ref } from "vue";

const emit = defineEmits(["input", "enter"]);
const props = defineProps({
    placeholder: {
        type: String,
        default: "Search",
    },
});
const model = defineModel();
const inputRef = ref<HTMLInputElement | null>(null);

const focus = () => {
    inputRef.value?.focus();
};

defineExpose({ focus });

onMounted(() => {
    if (inputRef.value) {
        focus();
    }
});
</script>
<template>
    <div
        class="flex shrink-0 items-center rounded-t-2xl h-16 inset-shadow-xs inset-shadow-neutral-800 border-b border-b-neutral-800 p-3"
    >
        <input
            ref="inputRef"
            type="text"
            @input="emit('input')"
            @keydown.enter="emit('enter')"
            v-model="model"
            class="h-full flex-1 text-lg font-medium outline-0 text-white placeholder:text-neutral-500 px-2"
            :placeholder="props.placeholder"
        />
    </div>
</template>
