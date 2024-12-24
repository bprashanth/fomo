<template>
  <div class="schema-engine">
    <h3>Editing Schema for Tab :{{ tabData.name }}</h3>

    <!-- The drop zone for the fields

      Left side: drop-zone
      - shows a list of fields in the current tab

      Right side: draggable-tabs
      - shows a list of tabs excluding the current tab (otherTabs)
      - when a tab is dragged and dropped, it is
      a. added to the tabs list via the v-model binding (via Draggable)
      b. removed from the otherTabs list
        - TODO(prashanth@): I am not sure whether we should allow joining the
        same tab on multiple fields. If we want to prevent this, we must
        remove the tab from the otherTabs list.
      c. the onDrop function is called
      -->
    <div class="fields">
      <h4>Fields</h4>
      <div
      v-for="field in fields"
      :key="field"
      @drop="(e) => onFieldDrop(field, e)"
      @dragover.prevent
      @dragenter="(e) => onDragEnter(e)"
      @dragleave="(e) => onDragLeave(e)"
      class="field-drop-zone"
      >
        <strong>{{ field }}</strong>
        <ul>
          <li v-for="item in fieldMappings[field]" :key="item">
            {{ item }}
          </li>
        </ul>
      </div>
    </div>

    <div class="draggable-tabs">
      <h4>Draggable Tabs</h4>
      <div class="tabs-list">
        <div
        v-for="tab in otherTabs"
        :key="tab"
        draggable="true"
        @dragstart="(e) => onDragStart(tab, e)"
        class="draggable-item">
          {{ tab }}
        </div>
      </div>
    </div>

    <div class="json-preview">
      <h4>Preview</h4>
      <JsonViewer :value="computedJson" :expand-depth="5" theme="dark"/>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { JsonViewer } from 'vue3-json-viewer';
import "vue3-json-viewer/dist/index.css";
import { defineProps } from 'vue';

// const tempJson = ref({
//   name: "Test Object",
//   number: 42,
//   nested: {
//     array: [1, 2, 3],
//     string: "Hello World"
//   },
//   boolean: true
// });

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

// Reactive fields and data
// - fields: list of fields in the current tab
// - otherTabs: list of tabs excluding the current tab
// - fieldMappings: map of fields to their corresponding tabs
const fields = ref(Object.keys(props.tabData[0] || {}));
const otherTabs = ref(
  Object.keys(props.allTabs).filter((tab) => tab !== props.tabData.name)
);
const fieldMappings = ref(
  fields.value.reduce((acc, field) => {
    acc[field] =[];
    return acc;
  }, {})
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
  if (draggedTab &&
  !fieldMappings.value[field].includes(draggedTab)) {
    console.log("Adding", draggedTab, "to", field);
    fieldMappings.value[field].push(draggedTab);
  }
}

const onDragEnter = (e) => {
  e.target.closest('.field-drop-zone').classList.add('drag-over');
}

const onDragLeave = (e) => {
  e.target.closest('.field-drop-zone').classList.remove('drag-over');
}

// Compute Joined JSON
const computedJson = computed(() => {
  console.log("computedJson", props.tabData);
  return props.tabData.map((row) => {
    const joinedRow = { ...row };
    Object.keys(fieldMappings.value).forEach((field) => {
      const mappedTabs = fieldMappings.value[field];
      joinedRow[field] = mappedTabs.map((tab) => props.allTabs[tab]);
    });
    console.log("joinedRow", joinedRow);
    return joinedRow;
  });
});
</script>

<style scoped>
.schema-engine {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 20px;
  border: 1px solid #ccc;
}

.fields {
  display: flex;
  gap: 20px;
}

.field-drop-zone {
  border: 1px dashed #aaa;
  padding: 10px;
  min-height: 100px;
  flex: 1;
  background-color: #f9f9f9;
}

.draggable-tabs {
  border: 1px solid #ccc;
  padding: 10px;
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

.json-preview {
  border: 1px solid #ccc;
  padding: 10px;
  background-color: #fff;
}

</style>
