<template>
  <div class="schema-engine">
    <h3>Editing Schema for Tab :{{ tabData.name }}</h3>

    <div class="drag-drop-area">
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
      <div class="drop-zone">
        <h4>Fields</h4>
        <ul>
          <li v-for="field in fields" :key="field">
            {{ field }}
          </li>
        </ul>
      </div>

      <div class="draggable-tabs">
        <h4>Draggable Tabs</h4>
        <Draggable v-model="tabs" group="tabs" @end="onDrop">
          <div v-for="tab in otherTabs" :key="tab" class="draggable-item">
            {{ tab }}
          </div>
        </Draggable>
      </div>
    </div>

    <JsonViewer :value="computedJson" />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import Draggable from 'vue-draggable-next';
import JsonViewer from 'vue-json-viewer';
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

// Reactive fields and data
// - fields: list of fields in the current tab
// - otherTabs: list of tabs excluding the current tab
// - tabs: list of tabs that have been dragged onto fields
const fields = ref(Object.keys(props.tabData[0] || {}));
const otherTabs = computed(() => Object.keys(props.allTabs)
  .filter(tab =>
    tab !== props.tabData.name && // exclude current tab
    !tabs.value.includes(tab)     // exclude already dragged tabs
  )
);
const tabs = ref([]);

// Handle Drop
const onDrop = () => {
  console.log('Dropped tabs:', tabs.value);
};

// Compute Joined JSON
// This joins the entire drag and dropped data into a single JSON object.
// This is a computed property that is re-evaluated whenever the tabs or fields change.
const computedJson = computed(() => {
  return props.tabData.map((row) => ({
    ...row,
    joinedData: tabs.value.map((tab) => props.allTabs[tab]),
  }));
});
</script>
