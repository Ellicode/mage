<script setup lang="ts">
import { computed } from "vue";

const emit = defineEmits<{
    (e: "click"): void;
}>();

const props = defineProps({
    type: {
        type: String as () => "default" | "accent" | "destructive",
        default: "default",
    },
    accentColor: {
        type: String as () =>
            | "red"
            | "orange"
            | "amber"
            | "yellow"
            | "lime"
            | "green"
            | "emerald"
            | "teal"
            | "cyan"
            | "sky"
            | "blue"
            | "indigo"
            | "violet"
            | "purple"
            | "fuchsia"
            | "pink"
            | "rose"
            | "stone"
            | "neutral"
            | "zinc"
            | "gray"
            | "slate",
        default: "blue",
    },
});
const colorMap = {
    red: "bg-red-400 hover:bg-red-500 border-red-600 text-white",
    orange: "bg-orange-400 hover:bg-orange-500 border-orange-600 text-black",
    amber: "bg-amber-400 hover:bg-amber-500 border-amber-600 text-black",
    yellow: "bg-yellow-400 hover:bg-yellow-500 border-yellow-600 text-black",
    lime: "bg-lime-400 hover:bg-lime-500 border-lime-600 text-black",
    green: "bg-green-400 hover:bg-green-500 border-green-600 text-white",
    emerald:
        "bg-emerald-400 hover:bg-emerald-500 border-emerald-600 text-white",
    teal: "bg-teal-400 hover:bg-teal-500 border-teal-600 text-white",
    cyan: "bg-cyan-400 hover:bg-cyan-500 border-cyan-600 text-black",
    sky: "bg-sky-400 hover:bg-sky-500 border-sky-600 text-black",
    blue: "bg-blue-400 hover:bg-blue-500 border-blue-600 text-white",
    indigo: "bg-indigo-400 hover:bg-indigo-500 border-indigo-600 text-white",
    violet: "bg-violet-400 hover:bg-violet-500 border-violet-600 text-white",
    purple: "bg-purple-400 hover:bg-purple-500 border-purple-600 text-white",
    fuchsia:
        "bg-fuchsia-400 hover:bg-fuchsia-500 border-fuchsia-600 text-white",
    pink: "bg-pink-400 hover:bg-pink-500 border-pink-600 text-black",
    rose: "bg-rose-400 hover:bg-rose-500 border-rose-600 text-black",
    stone: "bg-stone-400 hover:bg-stone-500 border-stone-600 text-black",
    neutral:
        "bg-neutral-400 hover:bg-neutral-500 border-neutral-600 text-black",
    zinc: "bg-zinc-400 hover:bg-zinc-500 border-zinc-600 text-black",
    gray: "bg-gray-400 hover:bg-gray-500 border-gray-600 text-black",
    slate: "bg-slate-400 hover:bg-slate-500 border-slate-600 text-white",
};

const buttonClass = computed(() => {
    if (props.type === "accent") {
        return colorMap[props.accentColor];
    } else if (props.type === "destructive") {
        return "text-red-400 bg-neutral-800 hover:bg-neutral-700 border-neutral-950";
    } else {
        return "text-neutral-100 bg-neutral-800 hover:bg-neutral-700 border-neutral-950";
    }
});
</script>
<template>
    <button
        @click="emit('click')"
        :class="buttonClass"
        class="px-2 py-1.5 gap-2 rounded-lg text-sm border font-medium cursor-pointer transition-all active:scale-95 inline-flex items-center justify-center inset-shadow-white/20 inset-shadow-2xs"
    >
        <slot name="icon" />
        <slot />
    </button>
</template>
