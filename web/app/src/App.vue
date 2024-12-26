<!-- App.vue

  FileUpload.vue -> @fileParsed -> :tabs
  :tabs -> TabComponent.vue -> @tabSelected -> :parentFields
  :tabs -> TabComponent.vue -> @tabSelected -> :childFields
  :parentFields, :childFields -> SchemaEditor.vue

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
        title="Parent Dataset"
        @tabSelected="handleParentTabSelected"
      />
      <hr class="divider">
      <SchemaEditor
        v-if="parentFields && childFields"
        :parentFields="parentFields"
        :childFields="childFields"
      />
      <hr class="divider">
      <TabComponent
        v-if="tabs"
        :tabs="tabs"
        title="Child Dataset"
        @tabSelected="handleChildTabSelected"
      />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import FileUpload from './components/FileUpload.vue';
import TabComponent from './components/TabComponent.vue';
import SchemaEditor from './components/SchemaEditor.vue';

const tabs = ref([]);
const parentFields = ref([]);
const childFields = ref([]);

const handleFileParsed = (parsedData) => {
  tabs.value = parsedData;
}

const handleParentTabSelected = ({tab, columns}) => {
  console.log("Parent tab selected", tab, columns);
  parentFields.value = columns;
}

const handleChildTabSelected = ({tab, columns}) => {
  console.log("Child tab selected", tab, columns);
  childFields.value = columns;
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
 */
#app {
  min-height: 100vh;
  position: relative;
  /* overflow: hidden; */
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
</style>
