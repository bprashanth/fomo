<!-- QueryTemplatePanel.vue

 * This component displays a list of query templates.
 * It emits a 'template-selected' event when a template is clicked.
 * It is up to the parent component to handle the 'template-selected' event and
 * re-emit it as necessary (eg: as a global event).
 *
 * @props: None
 *
 * @emits:
 *  - template-selected: the query template selected
 *
 * Example usage:
 * <QueryTemplatePanel @template-selected="handleTemplateSelected" />
 *
 * In the parent component (DataViewer.vue):
 * const handleTemplateSelected = (template) => {
 *   window.dispatchEvent(new CustomEvent('template-selected', {
 *     detail: { query: template }
 *   }));
 * }
-->

<template>
  <div class="query-template-panel">
    <div class="template-item"
    v-for="template in templates"
    :key="template"
    @click="handleClick(template)">
      {{ template }}
    </div>
  </div>
</template>

<script setup>
import { defineEmits } from 'vue';

const emit = defineEmits(['template-selected']);

const templates = [
  'Show me <sitename> data',
  'Create a timelapse of images in site <sitename>'
];

function handleClick(template) {
  emit('template-selected', template);
}
</script>

<style scoped>
.query-template-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  color: white;
  font-family: monospace;
  height: 100%;
  justify-content: flex-start;
}

.template-item {
  background-color: #3b3b3b;
  padding: 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.template-item:hover {
  background-color: #4e4e4e;
}

</style>