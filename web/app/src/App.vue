<!-- App.vue

  FileUpload.vue -> @fileParsed -> :tabs, :fullData
  :tabs -> TabComponent.vue -> @tabSelected -> :childFields
  :tabs -> TabComponent.vue -> @tabReordered -> :parentFields
  :parentFields, :childFields -> SchemaEditor.vue -> @joinFields
  :joinedData, :geoJsonData -> WriterMapComponent.vue -> @geoJsonData
  :fullData, :parentTabSelected, :parentFieldsWithJoins -> DataViewer.vue
    -> @joinedData, @data-viewer-open, @navigate-dashboard

    The DataViewer component contains:
      :fullData, :parentFieldsWithJoins -> JsonViewer.vue -> @joinedData
      :geoJsonData -> ReaderMapComponent.vue

  * FileUpload.vue:
    - User uploads an excel file
    - onFileLoaded: Emits the parsed data to the parent (this component)

  * TabComponent.vue:
    - Displays the tabs from the excel file
    - Emits the selected tab+columns to the child component
    - Emits the last tab+columns to the parent component (this is emitted on
      every drag/drop)

  * SchemaEditor.vue:
    - Displays the parent+child columns
    - Processes the join logic

  * JsonViewer.vue:
    - Computes the join using the parentFieldsWithJoins and fullData
    - Displays the joined data
    - Emits the joined data to the parent

  * WriterMapComponent.vue:
    - Displays the map
    - Detects lat/lon columns from the joined
    - Displays lat/lon as markers on the map

  * DataViewer.vue:
    - Displays the joined data and the reader map
    - Manages the transition states for the open/close of the data viewer
    - Emits the joined data to the parent, as well as the open/close state

  @TODO:
  - Figure out consistent UI controls for Dashboard and Home. Right now the
    data viewer and file upload cause UI mis matches because of behavior
    explained in comments in the code.

  - Figure out how to manage the separator prop when tab names contain '.'.

  - Figure out how to flag malformed excel sheets, and surface expectations.

  - Keep only permanent fixtures in app.vue: data viewer, background etc. Move
    everything else into its own component, and emit data back up for
    communication.

  - Move the data viewer into a component. It's only going to grow. Make the
    NEXT chevron button understand the right next page to go to via the click
    handler.

  - Isolate the lat/lon detection logic into a separate component. It is
    currently duplicated in the JsonViewer, WriterMapComponent and SchemaPanel (code cargo culted from the POC). When this is done, use FeatureCollection
    to store the geoJson data in props, instead of an array of features. This
    will need modifications to processing code in the JsonViewer.

  - Handle situations where there are no lat/lon keys in the joined data.
    Surface this to the user so they might join more tabs/fields.
-->
<template>
  <div id="app">
    <div class="background"></div>


    <!-- Content positioning
      - Two dynamic classes are added to the content div
        1. dragging: This pushes the editor so users can see both panels
          simultaneously.
        2. with-padding: This prevents the file upload from hiding editor
          panels on page load.

      - Neither of these apply to the Dashboard page.
        1. The dashboard page is not setup to dynamically handle the "pushing"
          behaviour. This is a nice to have.
        2. The dashboard page does not have the file upload, so the extra
          padding just messes up the layout.

      - The router view is intentionally placed within the content div.
        Otherwise vue3 gets confused. It is wrapped in a transition to time it's entry with the closing of the data panel (responsive UI).
    -->
    <div class="content" :class="{
      'dragging': isDataViewerOpen && $route.name != 'Dashboard',
      'with-padding': $route.name != 'Dashboard'
      }">
      <router-view
        :schema="joinedData ? {schema: joinedData[0]} : { schema: {} }"
        :geoJsonData="savedGeoJsonData"
        :data="joinedData"
        v-if="$route.name === 'Dashboard'"
      ></router-view>

      <!-- Only show main content when not on dashboard -->
      <template v-else>
        <FileUpload @fileParsed="handleFileParsed" />
        <TabComponent
          v-if="tabs"
          :tabs="tabs"
          title="Child Dataset"
          @tabSelected="handleChildTabSelected"
          @tabReordered="handleParentTabSelected"
        />
        <div class="schema-section" v-if="tabs">
          <!-- A note on the v-show/v-if split:
            - v-show is used on SchemaEditor because v-if will unmount/remount
              the component on button toggle. This will reset the joined tabs UI.
            - v-if is used on MapsComponent because v-show will keep sending
              joinedData as an update every time it's modified by the json viewer.
              This causes very slow map renders.
          -->
          <SchemaEditor
            v-show="currentEditor === 'schema'"
            :parentFields="parentFields"
            :childFields="childFields"
            :childTabSelected="childTabSelected"
            :separator="separator"
            @parentFieldsWithJoins="handleParentFieldsWithJoins"
          />
          <WriterMapComponent
            v-if="currentEditor === 'maps'"
            :joinedData="joinedData"
            :geoJsonData="savedGeoJsonData"
            @geoJsonData="handleGeoJsonData"
          />
          <div class="editor-switcher">
            <button
              :disabled="currentEditor === 'schema'"
              @click="currentEditor = 'schema'"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M15 6L9 12L15 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            <button
              :disabled="currentEditor === 'maps'"
              @click="currentEditor = 'maps'"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 18L15 12L9 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
      </template>
    </div>

    <!-- Positioning of the data viewer panel

      - The data viewer panel shows up on all pages, so it's positioned outside
        the content div.
      - It's opening is conditioned on the DataViewerOpen flag, which is reset
        every route exection (from within the DataViewer, before it emits
        navigate-dashboard).
    -->
    <DataViewer
      :fullData="fullData"
      :parentTabSelected="parentTabSelected"
      :parentFieldsWithJoins="parentFieldsWithJoins"
      :savedGeoJsonData="savedGeoJsonData"
      @update-joined-data="handleJoinedData"
      @navigate-dashboard="goToDashboard"
      @data-viewer-open="handleDataViewerOpen"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue';
import FileUpload from './components/FileUpload.vue';
import TabComponent from './components/TabComponent.vue';
import SchemaEditor from './components/SchemaEditor.vue';
import WriterMapComponent from './components/WriterMapComponent.vue';
import DataViewer from './components/DataViewer.vue';
import { useRouter } from 'vue-router';

const router = useRouter();

const tabs = ref(null);
const parentFields = ref([]);
const childFields = ref([]);
const childTabSelected = ref(null);
const parentTabSelected = ref(null);
const fullData = ref({});
const parentFieldsWithJoins = ref([]);
const joinedData = ref({});
const savedGeoJsonData = ref([]);

// Separator used to join the child tab name with the child field name.
// TODO: What do we do if the child tab name contains a '.'?. This is a prop
// right now, but we need to handle modifying it.
const separator = ref('.');

// Flag to determine if the side panel json viewer is open.
// Setting it to true/false triggers the shrink/expand of the schema section.
const isDataViewerOpen = ref(false);

// The current editor mode - an enum of maps or schema.
const currentEditor = ref('schema');

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
const handleParentFieldsWithJoins = (fields) => {
  console.log("App: Parent fields with joins", fields);
  parentFieldsWithJoins.value = fields;
}

/* Handles the geoJsonData emitted from the maps component.
 *
 * This function is only invoked by "writer" map components.
 * This data is used to re-render the map in "readers".
 *
 * @param {Array} geoJsonData: The geoJson data from the maps component.
 */
const handleGeoJsonData = (geoJsonData) => {
  savedGeoJsonData.value = geoJsonData;
}

// Handles the json viewer components emitted data.
const handleJoinedData = (data) => {
  console.log("App: Joined data", data);
  joinedData.value = data;
};

// Handles the data viewer open/close event.
// Setting this flag shrinks/expands the schema section.
const handleDataViewerOpen = (open) => {
  isDataViewerOpen.value = open;
}

// Navigates to the dashboard page.
// Triggered when the "Next" button is clicked from the data viewer.
const goToDashboard = () => {
  router.push({
    name: 'Dashboard',
  });
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
 * - A note on flex: 1: Applying it on one child  means "first size the other
 *    children, then take up the remaining space for this child". Applying it
 *    to all children means "size each child equally".
 * - The content area is shifted to the left when the json viewer is open.
 *   This is achieved by adding a class to the content area (.expanded) and
 *   using CSS transitions to animate the margin-right property.
 * - The file edge is positioned absolutely and moves with the json viewer in
 *   a similar manner.
 */
#app {
  min-height: 100vh;
  position: relative;
  overflow: hidden;
  display: flex;
  justify-content: center;
  align-items: center;
  font-family: Avenir, Helvetica, Arial, sans-serif;
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
    url('./assets/background.webp') no-repeat center center;
  background-size: cover;
  background-attachment: fixed;
  filter: blur(5px);
  transform: scale(1.1);
  z-index: -1;
}

.content {
  transition: margin-right 0.3s ease;
}

.content.with-padding {
  padding-top: 70px;
}

.content.dragging {
  margin-right: 25%;
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
  min-height: 60vh;
  min-width: 60vw;
  gap: 1rem;

  backdrop-filter: blur(40px);
  border-radius: 10px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
}

.schema-section :deep(> *) {
  flex: 1;
  min-height: 0;
}

.editor-switcher {
  position: absolute;
  bottom: 20px;
  display: flex;
  border-radius: 5px;
  overflow: hidden;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
}

.editor-switcher button {
  border: none;
  color: rgb(21, 21, 21, 0.5);
  cursor: pointer;
  position: relative;
  background-color: transparent;
  color: #1E628C;
}

.editor-switcher button:hover:not(:disabled) {
  color: #3388ff;
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
