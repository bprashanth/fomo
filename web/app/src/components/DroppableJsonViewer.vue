<template>
  <div class="droppable-json-viewer">
    <json-viewer
      :value="decoratedValue"
      v-bind="$attrs"
    >
      <template #key="{ key }">
        <div
          class="json-key-wrapper"
          @drop="(e) => onFieldDrop(key, e)"
          @dragover.prevent
          @dragenter="(e) => onDragEnter(e)"
          @dragleave="(e) => onDragLeave(e)"
        >
          {{ key }}
          <span v-if="fieldMappings[key]?.length" class="mapping-indicator">
            [{{ fieldMappings[key].join(', ') }}]
          </span>
        </div>
      </template>
    </json-viewer>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { JsonViewer } from 'vue3-json-viewer';
import 'vue3-json-viewer/dist/index.css';
import { defineProps, defineEmits } from 'vue';

const props = defineProps({
  value: {
    type: Object,
    required: true
  },
  fieldMappings: {
    type: Object,
    default: () => ({})
  }
});

const emit = defineEmits(['field-drop']);

const decoratedValue = computed(() => {
  return { ...props.value };
});

const onDragEnter = (e) => {
  e.target.closest('.json-key-wrapper')?.classList.add('drag-over');
}

const onDragLeave = (e) => {
  e.target.closest('.json-key-wrapper')?.classList.remove('drag-over');
}

const onFieldDrop = (key, event) => {
  const draggedTab = event.dataTransfer.getData("text/plain");
  emit('field-drop', key, draggedTab);
  event.target.closest('.json-key-wrapper')?.classList.remove('drag-over');
}
</script>

<style scoped>
.droppable-json-viewer {
  font-family: monospace;
}

.json-key-wrapper {
  display: inline-block;
  padding: 2px 4px;
  border-radius: 4px;
  cursor: pointer;
}

.json-key-wrapper:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.json-key-wrapper.drag-over {
  background-color: rgba(33, 150, 243, 0.3);
}

.mapping-indicator {
  font-size: 0.9em;
  color: #64b5f6;
  margin-left: 4px;
}
</style>
