<script setup lang="ts">
import { ref } from "vue";
import { BlankSlate, Button, ListItem, SearchBar } from "../../kit/sdk";
import { AppWindow } from "lucide-vue-next";

const message = ref("Hello from Template App!");
</script>

<template>
    <SearchBar placeholder="Search template..." />

    <div class="flex h-full">
        <div class="overflow-auto flex-1 space-y-1 flex flex-col">
            <BlankSlate
                title="Template App"
                description="Start building your app from this template"
            >
                <template #icon>
                    <AppWindow class="w-8 h-8 text-blue-500" />
                </template>

                <Button type="accent"> Get Started </Button>
            </BlankSlate>
        </div>
    </div>
</template>
