<script setup lang="ts">
import { computed, ref } from "vue";
import { useEvents } from "../events";

const order = ref<any>(null);
const owner = ref<any>(null);
const notes = ref<any[]>([]);

const statusMeta = computed(() => ({
    shipped: { label: "Shipped", tone: "success", hint: "The order was shipped successfully." },
}));

const steps = [
    { label: "Placed", sub: "Order registered in the system" },
];

const details = computed(() => [
    { label: "Owner", value: owner.value?.name || order.value?.owner_id || "—" },
]);

async function load() {}
async function remove() {}
function copy(text: string) {}

useEvents(() => load());
</script>

<template>
    <div>
        <button @click="load">Refresh</button>
        <UiButton variant="ghost" @click="remove">Delete</UiButton>
        <h1 class="bg-gradient-to-r from-primary to-secondary">Welcome back!</h1>
        <p class="uppercase tracking-wider">Details</p>
        <span>{{ order.carrier.name }}</span>
        <span>{{ order.carrier.name }}</span>
        <span>{{ order.status }}</span>
        <span>{{ order.created_by }}</span>
        <pre>{{ JSON.stringify(order.meta) }}</pre>
        <UiBadge>{{ notes.length }}</UiBadge>
        <input type="checkbox" />
        <code class="code-chip truncate">{{ order.path }}</code>
        <button @click="copy(order.id)">a</button>
        <button @click="copy(order.path)">b</button>
        <button @click="copy(order.sha)">c</button>
        <button @click="copy(order.url)">d</button>
        <div class="grid gap-4 lg:grid-cols-3">
            <section class="panel-card">A</section>
            <section class="panel-card">B</section>
            <section class="panel-card">C</section>
        </div>
    </div>
</template>
