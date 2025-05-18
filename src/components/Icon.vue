<script setup>
import { computed } from "vue";
import * as icons from "lucide-vue-next";

const props = defineProps({
    name: {
        type: String,
        required: true,
    },
    size: Number,
    color: String,
    strokeWidth: Number,
    defaultClass: String,
});

const icon = computed(() => {
    // Check if the provided name exists in icons
    if (icons[props.name]) {
        return icons[props.name];
    }

    // Fallback to a default icon or null
    console.warn(`Icon "${props.name}" not found`);
    return icons.HelpCircleIcon || null;
});
</script>

<template>
    <component
        v-if="icon"
        :is="icon"
        :size="size"
        :color="color"
        :stroke-width="strokeWidth"
        :default-class="defaultClass"
    />
    <span v-else class="icon-error"></span>
</template>
