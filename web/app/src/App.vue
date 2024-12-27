<!-- App.vue

  FileUpload.vue -> @fileParsed -> :tabs, :fullData
  :tabs -> TabComponent.vue -> @tabSelected -> :parentFields
  :tabs -> TabComponent.vue -> @tabSelected -> :childFields
  :parentFields, :childFields -> SchemaEditor.vue -> @joinFields
  :fullData, :parentFieldsWithJoins -> JsonViewer.vue

  * FileUpload.vue:
    - User uploads an excel file
    - onFileLoaded: Emits the parsed data to the parent (this component)

  * TabComponent.vue:
    - Displays the tabs from the excel file
    - Emits the selected tab+columns to the parent component

  * SchemaEditor.vue:
    - Displays the parent+child columns
    - Processes the join logic
-->
<template>
  <div id="app">
    <div class="background"></div>
    <div class="content">
      <FileUpload @fileParsed="handleFileParsed" />
      <TabComponent
        v-if="tabs"
        :tabs="tabs"
        title="Child Dataset"
        @tabSelected="handleChildTabSelected"
      />
      <hr class="divider">
      <div class="schema-section">
        <SchemaEditor
          v-if="parentFields && childFields"
          :parentFields="parentFields"
          :childFields="childFields"
          :childTabSelected="childTabSelected"
          :separator="separator"
          @parentFieldsWithJoins="handleParentFieldsWithJoins"
        />
        <div class="json-viewer-wrapper">
          <JsonViewer
            :fullData="fullData"
            :parentTab="parentTabSelected"
            :parentFieldsWithJoins="parentFieldsWithJoins"
          />
        </div>
      </div>
      <hr class="divider">
      <TabComponent
        v-if="tabs"
        :tabs="tabs"
        title="Parent Dataset"
        @tabSelected="handleParentTabSelected"
      />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import FileUpload from './components/FileUpload.vue';
import TabComponent from './components/TabComponent.vue';
import SchemaEditor from './components/SchemaEditor.vue';
import JsonViewer from './components/JsonViewer.vue';
const tabs = ref([]);
const parentFields = ref([]);
const childFields = ref([]);
const childTabSelected = ref(null);
const parentTabSelected = ref(null);
const fullData = ref({});
const parentFieldsWithJoins = ref([]);

// Separator used to join the child tab name with the child field name.
// TODO: What do we do if the child tab name contains a '.'? maybe this should
// be a prop.
const separator = ref('.');

// Handles the file upload components emitted data.
const handleFileParsed = (parsedData) => {
  tabs.value = parsedData.headerData;
  fullData.value = parsedData.fullData;
}

// Looks up the column names of the parent tab and passes it to the
// schema editor.
// @param {Object} tab: The tab object from the excel file.
// @param {Array} columns: The column names of the tab.
const handleParentTabSelected = ({tab, columns}) => {
  console.log("Parent tab selected", tab, columns);
  parentFields.value = columns;
  parentTabSelected.value = tab;
}

// Looks up the column names of the child tab and passes it to the
// schema editor.
// @param {Object} tab: The tab object from the excel file.
// @param {Array} columns: The column names of the tab.
const handleChildTabSelected = ({tab, columns}) => {
  console.log("Child tab selected", tab, columns);
  childFields.value = columns;
  childTabSelected.value = tab;
}

// Handles the schema editor components emitted data.
const handleParentFieldsWithJoins = (parentFieldsWithJoins) => {
  console.log("Parent fields with joins", parentFieldsWithJoins);
  parentFieldsWithJoins.value = parentFieldsWithJoins;
}

</script>

<style scoped>

/* Background styling
 * - The background is a gradient + blur + scale. Why is this necessary?
 *   1. The gradient and blur make the UI elements more prominent
 *   2. The scale is to manage the white halo effect on the edges of
 *      the background - this is a known issue with blur
 * - The background is positioned absolutely to cover the entire viewport.
 *   i.e the combination of position, top and left pin the image to the
 *   viewport.
 * - In order to achieve this, the parent (#app) must have position: relative.
 *
 * Content styling
 * - All the content positioning is achieved via display: flex on the parent.
 * - The main content area, the schema-section, is restricted to 60% of viewport
 * - :deep(> *) are used to target all children (similar to .first-child)
 * - flex: 1 is used on all children via :deep, to tell flexbox to distribute
 *    the available space evenly.
 * - A note on flex: 1: applying it on one child  means "first size the other
 *    children, then take up the remaining space for this child". Applying it
 *    to all children means "size each child equally".
 */
#app {
  min-height: 100vh;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.background {
  position: absolute;
  top: -50px;
  left: -50px;
  width: calc(100% + 100px);
  height: calc(100% + 100px);
  background:
    linear-gradient(
      to bottom,
      rgba(148, 186, 182, 0) 0%,
      rgba(148, 186, 182, 0.4) 40%,
      rgba(148, 186, 182, 0.8) 70%,
      #94BAB6 100%
    ),
    url('./assets/background.png') no-repeat center center;
  background-size: cover;
  background-attachment: fixed;
  filter: blur(5px);
  transform: scale(1.1);
  z-index: -1;
}

.content {
  padding-top: 70px;
}

.divider {
  width: 100%;
  border: none;
  border-top: 1px solid rgba(73, 94, 92, 0.4);
  margin: 1rem 0;
}

.schema-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 60vh;
  width: 60vh;
  width: 100%;
  gap: 1rem;
}

.schema-section :deep(> *) {
  flex: 1;
  min-height: 0;
}

.json-viewer-wrapper {
  width: 80%;
  max-width: 600px;
  min-width: 300px;
}
</style>

<style>
/* Custom Scrollbar Styling
 * - This is a global style that applies to all scrollbars in the app.
 *   Hence it's in the style and not style scoped, and its in the root app
 *   element.
 */
::-webkit-scrollbar {
  width: 10px;
}

::-webkit-scrollbar-track {
  background: rgba(148, 186, 182, 0.1);
}

::-webkit-scrollbar-thumb {
  background: rgba(73, 94, 92, 0.6);
  border-radius: 5px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(73, 94, 92, 0.8);
}
</style>
