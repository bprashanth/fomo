<template>
  <div class="schema-engine">
    <h3>Editing Schema for Tab: {{ tabData.name }}</h3>

    <div class="layout-container">
      <div class="draggable-tabs">
        <h4>Available Tabs</h4>
        <div class="tabs-list">
          <div
            v-for="tab in otherTabs"
            :key="tab"
            draggable="true"
            @dragstart="(e) => onDragStart(tab, e)"
            class="draggable-item"
          >
            {{ tab }}
          </div>
        </div>
      </div>

      <div class="json-preview">
        <h4>Preview</h4>
        <!-- Custom JSON display with droppable fields -->
        <div class="json-content">
          <div
            v-for="(value, key) in initialPreviewData"
            :key="key"
            class="json-field"
            @drop="(e) => onFieldDrop(key, e)"
            @dragover.prevent
            @dragenter="(e) => onDragEnter(e)"
            @dragleave="(e) => onDragLeave(e)"
          >
            <span class="json-key">{{ key }}:</span>
            <span class="json-value">
              <!-- If field has mappings, show them -->
              <template v-if="fieldMappings[key]?.length">
                [
                  <span v-for="(tab, index) in fieldMappings[key]" :key="tab">
                    {{ tab }}{{ index < fieldMappings[key].length - 1 ? ', ' : '' }}
                  </span>
                ]
              </template>
              <!-- Otherwise show original value -->
              <template v-else>
                {{ JSON.stringify(value) }}
              </template>
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

import { defineProps } from 'vue';

// props received:
// - tabData: current tab's data (i.e fields or column names)
// - allTabs: data from all available tabs
const props = defineProps({
  tabData: {
    type: Object,
    required: true
  },
  allTabs: {
    type: Object,
    required: true
  }
});

// Initialize with the first row of tabData
const initialPreviewData = ref(props.tabData[0] || {});

// Simplified fieldMappings (we don't need to pre-initialize all fields)
const fieldMappings = ref({});

// Reactive fields and data
// - fields: list of fields in the current tab
// - otherTabs: list of tabs excluding the current tab
// - fieldMappings: map of fields to their corresponding tabs
const otherTabs = ref(
  Object.keys(props.allTabs).filter((tab) => tab !== props.tabData.name)
);

// Handle Drop event on field drop zones
// onDragStart:
// - When a draggable item is picked up, the @dragstart event is triggered
// - We use this to set the dataTransfer object with the tab name
//
// onFieldDrop:
// - When the item is dropped onto a field, the @drop event is triggered
// - The draggedTab name is retrieved from the dataTransfer object
// - We then add the draggedTab to the field's mapping if it is not already
//    present
//
// onDragEnter:
// - When the draggable item is hovered over a field, the @dragenter event is
//   triggered
// - We use this to highlight the field
//
// onDragLeave:
// - When the draggable item is no longer hovered over a field, the @dragleave
//   event is triggered
// - We use this to unhighlight the field
const onDragStart = (tab, event) => {
  console.log("onDragStart", tab);
  event.dataTransfer.setData("text/plain", tab);
}

const onFieldDrop = (field, event) => {
  const draggedTab = event.dataTransfer.getData("text/plain");
  console.log("onFieldDrop", field, draggedTab);

  // Initialize the array if it doesn't exist
  if (!fieldMappings.value[field]) {
    fieldMappings.value[field] = [];
  }

  // Add the dragged tab if it's not already mapped
  if (draggedTab && !fieldMappings.value[field].includes(draggedTab)) {
    console.log("Adding", draggedTab, "to", field);
    fieldMappings.value[field].push(draggedTab);
  }

  // Remove the drag-over class
  event.target.closest('.json-field')?.classList.remove('drag-over');
}

const onDragEnter = (e) => {
  e.target.closest('.json-field')?.classList.add('drag-over');
}

const onDragLeave = (e) => {
  e.target.closest('.json-field')?.classList.remove('drag-over');
}
</script>

<style scoped>
.schema-engine {
  padding: 20px;
}

.layout-container {
  display: flex;
  gap: 20px;
}

.draggable-tabs {
  flex: 0 0 200px;
  border: 1px solid #ccc;
  padding: 10px;
}

.json-preview {
  flex: 1;
  border: 1px solid #ccc;
  padding: 10px;
}

.json-content {
  font-family: monospace;
  background: #1e1e1e;
  color: #fff;
  padding: 15px;
  border-radius: 4px;
}

.json-field {
  padding: 5px;
  cursor: default;
  transition: background-color 0.2s;
}

.json-field:hover {
  background-color: #2a2a2a;
}

.json-key {
  color: #9cdcfe;
  margin-right: 8px;
}

.json-value {
  color: #ce9178;
}

.json-field.drag-over {
  background-color: #264f78;
}

.tabs-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.draggable-item {
  margin: 5px 0;
  padding: 8px;
  border: 1px solid #ccc;
  background-color: #f5f5f5;
  cursor: grab;
  transition: background-color 0.2s;
}

.draggable-item:hover {
  background-color: #eee;
}

.field-drop-zone.drag-over {
  background-color: #e9f5ff;
  border-color: #2196f3
}

</style>
