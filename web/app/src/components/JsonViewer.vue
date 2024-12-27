<template>
  <div class="json-viewport">
    <json-viewer
    v-if="props.fullData && props.parentTab"
    :value="props.fullData[props.parentTab][0]"
    theme="dark"
    sort
    />
  </div>
</template>

<script setup>
import { JsonViewer } from 'vue3-json-viewer';
import 'vue3-json-viewer/dist/index.css';
import { defineProps, watchEffect } from 'vue';

const props = defineProps({
  fullData: Object,
  parentTab: String,
  parentFieldsWithJoins: Array,
});

watchEffect(() => {
  console.log('Parent fields with joins:', props.parentFieldsWithJoins);
});

</script>

<style scoped>

.json-viewport {
  width: 100%;
  height: 100%;
  overflow: auto;
}

/* JsonViewer styling
 * div.json-viewport (this code)
 * div.jv-container.jv-dark (background)
 * div.jv-code
 * span.jv-item,jv-string (text coloring)
*/
:deep(.jv-container) {
  font-size: 10px;
  font-weight: 600;
  text-align: left;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
  background: rgb(21, 21, 21, 1.0);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  font-family: monospace;
  border-radius: 10px;
}

:deep(.jv-code) {
  padding: 10px;
}

</style>
