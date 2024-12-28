<!-- TabComponent.vue
  - This component handles the tabs rendering, positioning and reordering
  - It emits the selected tab+columns to the parent component
  - It also emits the last tab+columns to the parent component on drag/drop
  - This component makes an assumption: that evrey drag/drop is to re-position
    the last tab. Intermediate drag/drops are not emitted, instead we re-emit
    the last tab+columns. This is a simplification, but it works for now.

  @props:
    - tabs: Object - The tabs to render, eg  { tabName: [columnNames] }

  @emits:
    - tabSelected: Object - The selected tab+columns
    - tabReordered: Object - The last tab+columns

  @TODO:
  - Handle intermediate drag/drops
-->
<template>
  <div class="tab-container">
    <draggable
    class="tabs"
    v-model="localTabs"
    item-key="tab"
    @end="onDragEnd"
    ghost-class="ghost"
    >
      <template #item="{ element: { tab, columns }, index: idx }">
        <li
        :class="{
          'active': tab === selectedTab,
          'last-tab': idx === localTabs.length - 1
        }"
        class="tab"
        @click="selectTab(tab, columns)"
        >
        {{ tab }}
          <!-- <span :class="{ 'truncate-text': idx === localTabs.length - 1}">
            {{ tab }}
          </span> -->
        </li>
      </template>
    </draggable>
  </div>
</template>

<script setup>
import { defineProps, ref, defineEmits } from 'vue';
import draggable from 'vuedraggable';

const props = defineProps({
  // Parsed tab data: { tabName: [columnNames] }
  tabs: Object,
});

const emit = defineEmits(['tabSelected', 'tabReordered']);
const selectedTab = ref(null);

const localTabs = ref(
  Object.entries(props.tabs).map(([tab, columns]) => ({ tab, columns }))
);

// Handler for tab click, emits the selected tab+columns.
// Does not emit if the tab is already selected or the last tab.
const selectTab = (tab, columns) => {
  if (tab === selectedTab.value || tab === localTabs.value.at(-1).tab) {
    return;
  }
  selectedTab.value = tab;
  console.log('Emitting tabSelected', { tab, columns });
  emit('tabSelected', { tab, columns });
};

// Handler for drag/drop end, emits the last tab+columns.
// Does not emit if:
// A. The dragged tab is not dropped at the end of the list.
// B. The dragged tab is dropped back in its original position.
const onDragEnd = (evt) => {
  const { oldIndex, newIndex } = evt;
  if (newIndex != localTabs.value.length - 1 || newIndex === oldIndex) {
    return;
  }

  const lastTab = localTabs.value.at(-1);
  console.log('Emitting lastTab', lastTab);
  emit('tabReordered', {tab: lastTab.tab, columns: lastTab.columns});
};

</script>


<style scoped>
/*
 * Positioning
 * - The drag and drop positioning is hanlded by draggable.js
 * - All the positioning is handled by display: flex on the draggable element.
 *
 * Styling
 * - The "ghost" class styles the tab while it is dragged.
 * - The "last-tab" class styles the last tab (i.e the re-ordered tab).
 * - The "active" class styles the currently selected tab (i.e the clicked tab).
 */
.tab-container {
  width: 100%;
  text-align: center;
}

.tabs {
  list-style: none;
  padding: 0;
  display: flex;
  justify-content: space-around;
  font-family: monospace;
  margin-bottom: 0;
  margin-left: 0;
}

.tab {
  padding: 10px 20px;
  background: rgba(46, 83, 81, 0.35);
  border: 1px solid rgba(46, 83, 81, 0.3);
  color: #CBE9E7;
  cursor: pointer;
  font-weight: 600;
  font-size: 18px;
  text-transform: uppercase;
  transition: all 0.3s ease;
  border-radius: 5px 5px 0px 0px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  transform: translateY(0);
  transition: all 0.3s ease;
}

.tab:hover {
  background: rgba(168, 216, 212, 0.2);
  border-color: rgba(168, 216, 212, 0.3);
  color: #FFFFFF;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
  transform: translateY(-2px);
}

.tab.active {
  background: rgba(46, 83, 81, 0.6);
  border-color: rgba(46, 83, 81, 0.7);
  color: #CBE9E7;
  font-weight: bold;

  box-shadow: 0 3px 6px rgba(0, 0, 0, 0.25);
  border-bottom: 3px solid #A8D8D4;
}

.ghost {
  opacity: 0.4;
  background:  #1E628C !important;
  border: 2px dashed rgba(23, 31, 30, 0.5) !important;
}

.tab.last-tab {
  background: rgba(46, 83, 81, 0.6);
  border-color: rgba(46, 83, 81, 0.7);
  color: #CBE9E7;
  font-weight: bold;

  box-shadow: 0 3px 6px rgba(0, 0, 0, 0.25);
  border-bottom: 3px solid #A8D8D4;
}


.truncate-text {
  white-space: nowrap;
  overflow: hidden;
  width: 2ch;
  display: inline-block;
}

</style>
