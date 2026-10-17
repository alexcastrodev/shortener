<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { useData } from 'vitepress';

const props = defineProps<{ code: string }>();
const { isDark } = useData();
const source = decodeURIComponent(props.code);
const svg = ref('');
const failed = ref(false);

// Mermaid needs the DOM, so diagrams are drawn in the browser only; the
// server render keeps the source so the page still reads without script.
async function draw() {
  try {
    const { default: mermaid } = await import('mermaid');
    // Natural size: a wide diagram (the ER model) scrolls instead of shrinking
    // until its labels cannot be read.
    const natural = { useMaxWidth: false };
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: isDark.value ? 'dark' : 'default',
      flowchart: natural,
      er: natural,
      state: natural,
      sequence: natural,
      class: natural,
    });
    const id = `mermaid-${Math.random().toString(36).slice(2)}`;
    svg.value = (await mermaid.render(id, source)).svg;
  } catch {
    failed.value = true;
  }
}

onMounted(draw);
watch(isDark, draw);
</script>

<template>
  <div v-if="svg && !failed" class="mermaid" v-html="svg" />
  <pre v-else class="mermaid-source"><code>{{ source }}</code></pre>
</template>

<style scoped>
.mermaid {
  margin: 16px 0;
  overflow-x: auto;
}
</style>
