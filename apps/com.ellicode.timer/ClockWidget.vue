<script setup lang="ts">
import { ClockIcon } from "lucide-vue-next";
import { ref, onMounted, onBeforeUnmount } from "vue";

const currentTime = ref("");
const timezone = ref("");
let intervalId;

const updateTime = () => {
    const date = new Date();
    currentTime.value = date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    });
    timezone.value = date
        .toLocaleTimeString("en-US", {
            timeZoneName: "short",
        })
        .split(" ")[2];
};

onMounted(() => {
    updateTime(); // Set initial time
    intervalId = setInterval(updateTime, 1000);
});

onBeforeUnmount(() => {
    clearInterval(intervalId); // Clean up interval when component is unmounted
});
</script>
<template>
    <div class="flex items-center gap-2">
        <ClockIcon class="text-amber-500 w-6 h-6 mr-2" />
        <h3 class="text-2xl font-medium">
            {{ currentTime }}
            <small class="text-neutral-400">
                {{ timezone }}
            </small>
        </h3>
    </div>
</template>
