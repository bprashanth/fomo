<!--MapsComponent.vue

  - Figure out the lat/lon columns from the joined data
  - Display the joined data as markers on the map

  @props:
    - joinedData: Array - The joined data to display on the map

  @emits: None
-->
<template>
  <div class="map-container">
    <div id="map" class="map fade-in"></div>
  </div>
</template>

<script setup>

import { onMounted, watch, defineProps, ref, shallowRef } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw';
import 'leaflet-draw/dist/leaflet.draw.css';

const props = defineProps({
  joinedData: {
    type: Array,
    required: true
  },
});

// It is important that the leaflet elements are shallowRef. Vue's reactivity
// system does not work with leaflet's update/rendering system. For example,
// vue can handle pushing new markers or replacing the entire map, but leaflet
// must handle metadata updates to the layers themselves.

// Base map and markers, initialized in onMounted, populated by the watcher.
const map = shallowRef(null);
const markers = shallowRef([]);

// drawnItems is the container (FeatureGroup) for all drawn shapes.
// Every shape or circlemarker edited onto the map by the user is added as a
// new layer on the map through it.
const drawnItems = shallowRef(null);

// Pending data is stored by the watch handler when it's received before the
// map is initialized, and processed from onMounted.
const pendingData = ref(null);

const geoJsonLayers = ref([]);


/* Flatten a nested json object to a single level.

 * Only unnests objects, not arrays.
 *
 * @param {Object} obj - The object to flatten.
 * @param {string} parentKey - A key used to store data in the result dict.
 * @param {Object} result - A dict that stores state between invocations.
 *
 * @returns {Object} The flattened object.
 */
function flattenObject(obj, parentKey = '', result = {}) {
  for (const key in obj) {
    const value = obj[key];
    const newKey = parentKey ? `${parentKey}.${key}` : key;

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      flattenObject(value, newKey, result);
    } else {
      result[newKey] = value;
    }
  }
  return result;
}

/* Detect latitude and longitude keys in a flattened json object.
 *
 * @param {Object} flattenedData - The flattened json object.
 * @returns {Object} An object with the latitude and longitude keys.
 */
function detectLatLong(flattenedData) {
  const latKeys = ['lat', 'latitude', 'lt'];
  const longKeys = ['long', 'longitude', 'lon', 'lng', 'ln'];

  for (const key in flattenedData) {
    if (latKeys.some(k => key.toLowerCase().includes(k))) {
      for (const otherKey in flattenedData) {
        if (longKeys.some(k => otherKey.toLowerCase().includes(k))) {
          return { latKey: key, lonKey: otherKey };
        }
      }
    }
  }
}

/* Process the joined data into points.
 *
 * - First identify the lat/lon keys in the joined data.
 * - Then extracts the coordinates from the data as an array of points.
 *
 * @param {Array} newData - The joined data.
 * @returns {Array} The points.
 */
function processMapPoints(newData) {
  let latKey = null;
  let lonKey = null;
  const points = [];

  for (const item of newData) {
    const flattened = flattenObject(item);

    // Find lat/lon keys if not already found
    if (!latKey || !lonKey) {
      const detectedKeys = detectLatLong(flattened);
      if (!detectedKeys) continue;
      ({ latKey, lonKey } = detectedKeys);
    }

    // Extract coordinates
    if (latKey in flattened && lonKey in flattened) {
      const lat = parseFloat(flattened[latKey]);
      const lon = parseFloat(flattened[lonKey]);
      points.push({ lat, lon });
    }
  }

  return points;
}

// Create styled markers for the map points.
function createMarkers(points) {
  const markersLayer = L.layerGroup();

  points.forEach(({ lat, lon }) => {
    const marker = L.circleMarker([lat, lon], {
      radius: 2,
      fillColor: "#3388ff",
      color: "#49AED6",
      weight: 1,
      opacity: 1,
      fillOpacity: 0.7,
    });
    markersLayer.addLayer(marker);
    markers.value.push(marker);
  });

  return markersLayer;
}

// Reset the marker layer on the map.
function clearExistingMarkers() {
  markers.value.forEach(marker => map.value.removeLayer(marker));
  markers.value = [];
}

/* Update the map view to fit the points.
 *
 * - Figure out the bounds of the points and zoom the map to fit them.
 *
 * @param {Array} points - The points to fit on the map.
 */
function updateMapView(points) {
  if (points.length === 0) {
    console.warn('No valid points found to display on the map.');
    return;
  }

  const bounds = L.latLngBounds(points.map(p => [p.lat, p.lon]));
  map.value.flyToBounds(bounds, {
    padding: [50, 50],
    maxZoom: 13,
    duration: 1,
    easeLinearity: 0.3,
  });
}

/* Main watch handler, triggered whenever the joinedData prop changes.
 *
 * Both watch and onMounted trigger the same set of functions. Watch triggers
 * them whenever there's a data change, onMounted triggers them when the
 * component is mounted.
 *
 * The second statement is a small lie. There is a race condition between watch * and onMounted. If the data is received in the watch while the map is being
 * initialized, it is not processed. Instead, the data is stored in pendingData
 * and processed from onMounted.
 */
watch(
  () => props.joinedData,
  (newData) => {
    if (!newData.length) return;

    if (!map.value) {
      // While nextTick would be a simpler way to handle this race, storing the
      // data in a member is more robust.
      pendingData.value = newData;
      return;
    }

    try {
      // Clear old markers
      clearExistingMarkers();

      // Process the data into points
      const points = processMapPoints(newData);

      // Create and add new markers
      const markersLayer = createMarkers(points);
      markersLayer.addTo(map.value);

      // Update the map view
      updateMapView(points);
    } catch (error) {
      console.error('Error updating map:', error);
    }
  },
  { immediate: true }
);

/* Initialize the map.
 *
 * - Create the map element.
 * - Add a tile layer.
 * - Set the view to the center of the world.
 */
const initializeMap = () => {
  map.value = L.map(
    'map',
    {
      attributionControl: false,
      // zoomControl: false,
    }).setView([0, 0], 2);
  L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    {maxZoom: 19}
  ).addTo(map.value);

  map.value.whenReady(() => {
    initializeDrawTools();
  });
}

const initializeDrawTools = () => {
  if (!drawnItems.value) {
    drawnItems.value = new L.featureGroup();
  }
  if (!map.value) {
    console.error('Map not initialized');
    return;
  }

  drawnItems.value.addTo(map.value);

  const drawControl = new L.Control.Draw({
    position: 'topright',
    edit: {
      featureGroup: drawnItems.value,
      remove: true,
    },
    draw: {
      polygon: false,
      polyline: false,
      circle: false,
      marker: false,
      rectangle: {
        shapeOptions: {
          color: '#3388ff',
          weight: 2
        },
      },
    },
  });
  map.value.addControl(drawControl);

  // The draw:created event is triggered when a drawing is completed, i.e
  // the user clicks the mouse button to complete a polygon. This works
  // differently for different shapes.
  // Each shape is a different layer, which we convert to GeoJSON and store
  // in geoJsonLayers.
  map.value.on('draw:created', (e) => {
    console.log('draw:created', e);
    const layer = e.layer;
    drawnItems.value.addLayer(layer);
    console.log('drawnItems added as layer ');

    // Convert to GeoJSON and store in memory.
    const geoJsonData = layer.toGeoJSON();
    geoJsonLayers.value.push(geoJsonData);
    console.log('Saved GeoJSON: ', geoJsonData);
    console.log("Number of layers on map:", Object.keys(map.value._layers).length);
  });
};

// Handle pending data in onMounted
onMounted(() => {
  console.log('MapComponent: onMounted');
  initializeMap();

  // Process pending data stored by the watch handler.
  if (pendingData.value) {
    const newData = pendingData.value;
    pendingData.value = null;

    const points = processMapPoints(newData);
    const markersLayer = createMarkers(points);
    markersLayer.addTo(map.value);
    updateMapView(points);
  }
});

</script>

<style scoped>
.map-container {
  height: 100%;
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}

.map {
  height: 50vh;
  width: 90%;
  overflow: hidden;
  border-radius: 10px;
  opacity: 0;
}

.fade-in {
  animation: fadeIn 0.5s ease-in forwards;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
</style>
