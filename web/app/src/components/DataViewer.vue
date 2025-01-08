<!-- DataViewer.vue

Manages all elements in the data viewer side panel.

@props:
  - fullData: the full data from the excel file
  - parentTabSelected: the selected tab from the excel file
  - parentFieldsWithJoins: the fields with joins from the schema editor
  - savedGeoJsonData: the geojson data from the writer map

@emits:
  - update-joined-data: the joined data from the json viewer
  - data-viewer-open: the open/close state of the data viewer
  - navigate-dashboard: the navigate-dashboard event
-->
<template>
  <div class="position-wrapper">
    <div
    class="data-viewer-wrapper"
    :class="{ 'expanded': isDataViewerOpen }"
    @transitionend="handleTransitionEnd"
    >
      <!-- A note on the JsonViewer:
      Do not v-if the JsonViewer as it computes joins from data in the
      drag/drop. v-show is fine, but feels "less responsive" (product).
      -->
      <JsonViewer
        :fullData="props.fullData"
        :parentTab="props.parentTabSelected"
        :parentFieldsWithJoins="props.parentFieldsWithJoins"
        @joinedData="handleJoinedData"
      />
      <ReaderMapComponent
        v-if="isDataViewerOpen && isTransitionComplete && props.savedGeoJsonData.length"
        :geoJsonData="props.savedGeoJsonData"
        map-id="reader-map-1"
      />
      <div
      class="dashboard-button-container"
      v-if="isDataViewerOpen">
        <button
        class="dashboard-button"
        @click="props.savedGeoJsonData.length && joinedData.length ? goToDashboard() : null"
        :class="{ 'active': props.savedGeoJsonData.length && joinedData.length }"
        >
          NEXT
          <!-- SVG Chevron for >> -->
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M8 6L14 12L8 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M14 6L20 12L14 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
    <div
    class="file-edge"
    @click="toggleJsonViewer"
    :class="{ 'expanded': isDataViewerOpen }"
    >
      <span class="file-label">data</span>
    </div>
  </div>
</template>

<script setup>
import { ref, defineEmits, defineProps } from 'vue';
import JsonViewer from './JsonViewer.vue';
import ReaderMapComponent from './ReaderMapComponent.vue';

const isDataViewerOpen = ref(false);
const isTransitionComplete = ref(false);
const joinedData = ref([]);

const emit = defineEmits([
  'update-joined-data',
  'transition-complete',
  'navigate-dashboard',
  'data-viewer-open',
]);

const props = defineProps({
  fullData: Object,
  parentTabSelected: String,
  parentFieldsWithJoins: Array,
  savedGeoJsonData: Array,
});

// Records when the data viewer has fully transitioned to open. This is used
// as a signal to trigger the map render.
const handleTransitionEnd = (e) => {
  if (e.propertyName === 'width' && isDataViewerOpen.value) {
    isTransitionComplete.value = true;
  }
}

// Handles the json viewer components emitted data.
const handleJoinedData = (data) => {
  console.log("DataViewer: Joined data", data);
  joinedData.value = data;
  emit('update-joined-data', data);
};


// Toggles the json viewer open/closed.
const toggleJsonViewer = () => {
  if (!isDataViewerOpen.value) {
    isTransitionComplete.value = false;
  }
  isDataViewerOpen.value = !isDataViewerOpen.value;
  emit('data-viewer-open', isDataViewerOpen.value);
};

const goToDashboard = () => {
  toggleJsonViewer();
  emit('navigate-dashboard');
}
</script>

<style scoped>
/*
 * Content positioning
 *
 * - The data-viewer-wrapper is the main container for the data viewer.
 * - It's positioned absolutely to the right of the screen.
 * - It is toggled by the "file-edge" button click, which is also positioned
 *   absolutely and moves with the data viewer.
 * - The "dashboard-button" (NEXT button) triggers the route transition in the
 *   parent. It's only enabled when there is a saved map/data.
 */
.data-viewer-wrapper {
  width: 15px;
  background-color: #151515;
  height: 100%;
  position: absolute;
  display: flex;
  flex-direction: column;
  right: 0;
  top: 0;
  box-shadow: -2px 0 5px rgba(0, 0, 0, 0.3);
  overflow: hidden;
  transition: width 0.5s ease;
  z-index: 5;
  justify-content: center;
}

.data-viewer-wrapper.expanded {
  width: 25%;
}

/* File Edge keeps up with the data-viewer-wrapper */
.file-edge.expanded {
  right: 25%;
}

.file-edge {
  width: 20px;
  max-width: 20px;
  height: 60px;
  background-color: #9c7b59;
  border-radius: 5px 0 0 5px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
  position: absolute;
  right: 15px;
  top: 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: right 0.5s ease;
  z-index: 10;
}

.file-label {
  font-family: monospace;
  font-size: 10px;
  color: #151515;
  background-color: #C6C7C9;
  padding: 2px 6px;
  border-radius: 3px;
  transform: rotate(-90deg);
  position: absolute;
  top: 50%;
  left: 50%;
  transform-origin: left center;
}

/* "Next page" button styling */
.dashboard-button-container {
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}

.dashboard-button {
  width: 40%;
  background-color: #2c2c2c;
  border: 1px solid #3d3d3d;
  color: #808080;
  padding: 8px 12px;
  border-radius: 4px;
  margin-bottom: 20px;
  cursor: default;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: center;
  opacity: 0.7;
}

.dashboard-button.active {
  background-color: #2c2c3a;
  border: 1px solid #3d3d4f;
  color: #5FB1E0;
  cursor: pointer;
  opacity: 1;
}

.dashboard-button.active:hover {
  background-color: #3d3d4f;
  border-color: #4a4a5f;
}

.dashboard-button svg {
  width: 1.2em;
  height: 1.2em;
  transition: transform 0.2s ease;
}

.dashboard-button:hover svg {
  transform: translateX(6px);
}
/* End of "Next page" button styling */

</style>
