<template>
  <!-- TabPanel.vue:
    - Displays the tabs, which are the sheet names in the excel file
    - Tabs are clickable and emit the selected tab to the parent component
    - The selected tab is used to display the schema editor
    - The schema editor contains the schema of the selected tab
  -->
  <div class="tab-panel">
    <ul>
      <li
        v-for="tab in tabs"
        :key="tab"
        :class="{ 'active': tab === selectedTab }"
        @click="selectTab(tab)"
        >
        {{ tab }}
      </li>
    </ul>
  </div>
</template>

<script setup>
import { defineProps, ref, watch, defineEmits } from 'vue';

const props = defineProps({
  tabs: {
    type: Array,
    required: true
  }
});

const emit = defineEmits(['tabSelected']);
const selectedTab = ref(props.tabs[0]);

watch(() => props.tabs, () => {
  selectedTab.value = props.tabs[0];
});

const selectTab = (tab) => {
  selectedTab.value = tab;
  emit('tabSelected', tab);
};
</script>
