<template>
  <!-- Overall architecture
    FileUpload.vue -> onFileLoaded -> parsedData -> tabs -> selectedTab -> SchemaEditor.vue

    * FileUpload.vue:
      - User uploads an excel file
      - onFileLoaded: Emits the parsed data to the parent component

    * TabPanel.vue:
      - Displays the tabs, which are the sheet names in the excel file
      - Tabs are taken from the parsed data emitted by FileUpload.vue
      - Tabs are clickable and emit the selected tab to the parent component
      - The selected tab is used to display the schema editor
      - The schema editor contains the schema of the selected tab

    * SchemaEditor.vue:
      - Displays the schema editor
      - The schema editor is used to edit the schema of the selected tab
  -->
  <div id="app">
    <h1>Schema Editor</h1>
    <!-- File Upload -->
    <FileUpload @fileLoaded="onFileLoaded" />

    <div class="main-container">
      <!-- Tabs -->
      <TabPanel
        v-if="tabs.length"
        :tabs="tabs"
        @tabSelected="onTabSelected"
      />

      <!-- Schema Editor -->
      <SchemaEditor
        v-if="selectedTab"
        :tabData="parsedData[selectedTab]"
        :allTabs="parsedData"
      />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import FileUpload from './components/FileUpload.vue';
import TabPanel from './components/TabPanel.vue';
import SchemaEditor from './components/SchemaEditor.vue';

const tabs = ref([]);
const parsedData = ref({});
const selectedTab = ref(null);

const onFileLoaded = (data) => {

  // Parsed excel file data
  parsedData.value = data;
  tabs.value = Object.keys(data);
  console.log("File upload returned tabs ", data);

  // Automatically select the first tab
  selectedTab.value = tabs.value[0];
}

const onTabSelected = (tab) => {
  selectedTab.value = tab;
};
</script>
