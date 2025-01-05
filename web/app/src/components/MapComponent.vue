<template>
  <div id="map-container">
    <div id="map"></div>
    <!-- Custom dropdown button -->
    <div id="basemap-dropdown">
      <button @click="toggleDropdown" class="dropdown-toggle">Basemap</button>
      <ul v-show="dropdownOpen" class="dropdown-menu">
        <li @click="switchBasemap('dark')">Dark</li>
        <li @click="switchBasemap('light')">Light</li>
        <li @click="switchBasemap('terrain')">Terrain</li>
      </ul>
    </div>
  </div>
</template>

<script>
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export default {
    name: "MapComponent",
    props: {
        queryResult: {
            type: Array, 
            default: () => [],
        },
        hoveredBoundary: {
            type: Object, 
            default: null,
        },
    },
    data() {
        return {
            map: null,
            dropdownOpen: false,
            baseLayers: {
                // Stamen man: see docs
                // https://docs.stadiamaps.com/map-styles/stamen-toner/
                light: L.tileLayer(
                "https://tiles.stadiamaps.com/tiles/stamen_toner/{z}/{x}/{y}{r}.png",
                { maxZoom: 16 }
                ),
                dark: L.tileLayer(
                "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
                { maxZoom: 16 }
                ),
                terrain: L.tileLayer(
                "https://tiles.stadiamaps.com/tiles/stamen_terrain/{z}/{x}/{y}{r}.png",
                { maxZoom: 16 }
                ),
            },
            geoJsonLayers: [],

            // Layer holds the markers for the query result lat/long s 
            markerLayer: null,

            // hoverLayer holds the incoming map boundary, from hover on the
            // surf tab.
            hoverLayer: null,
        }
    },
    mounted() {
        this.initializeMap();
    },
    watch: {
        queryResult: {
            immediate: true,
            handler(newData) {
                this.updateMarkers(newData);
            }
        },
        hoveredBoundary: {
            immediate: true,
            handler(newBoundary) {
                console.log(`received newBoundary ${newBoundary} on hover`);
                if (this.hoverLayer) {
                    this.map.removeLayer(this.hoverLayer);
                }
                if (newBoundary) {
                    this.hoverLayer = L.geoJSON(newBoundary, {
                        style: { color: "#ff7800", weight: 2, fillOpacity: 0.1 },
                    }).addTo(this.map);
                }
            },
        },
    },
    methods: {
        initializeMap() {
            // Initialize the map and set the view to the Periyar area
            this.map = L.map("map", { 
                attributionControl: false,
                zoomControl: false, 
            }).setView(
                [9.486, 77.307], 
                10
            );

            // Add the Esri Gray (Light) basemap
            this.baseLayers.dark.addTo(this.map);

            // Load GeoJSON layers
            this.loadGeoJsonData();
        },
        loadGeoJsonData() {
            // Load periyar_boundary
            fetch("/data/trap/boundary.geojson")
            .then(response => response.json())
            .then(data => {
                const boundaryLayer = L.geoJSON(data, {
                    style: { 
                        color: "#1b5653", 
                        weight: 2, 
                        fillOpacity: 0.3 
                    },
                }).addTo(this.map);
                this.geoJsonLayers.push(boundaryLayer);
            });

            // Load periyar_stations
            fetch("/data/trap/stations.geojson")
            .then(response => response.json())
            .then(data => {
                const stationLayer = L.geoJSON(data, {
                    pointToLayer: (feature, latlng) => {
                        return L.circleMarker(latlng, {
                            radius: 6,
                            fillColor: "#000000",
                            color: "#f7e306",
                            weight: 1,
                            opacity: 1,
                            fillOpacity: 0.8,
                        });
                    },
                    onEachFeature: (feature, layer) => {
                        if (feature.properties && feature.properties.name) {
                            layer.bindPopup(
                                feature.properties.name).openPopup();
                            layer.bindTooltip(feature.properties.name, {
                                permanent: false,
                                direction: "top",
                                className: "station-label",
                            });
                        }
                    },
                }).addTo(this.map);
                this.geoJsonLayers.push(stationLayer);
            });
        },
        toggleDropdown() {
            this.dropdownOpen = !this.dropdownOpen;
        },
        switchBasemap(type) {
            Object.values(this.baseLayers).forEach((layer) => {
                if (this.map.hasLayer(layer)) {
                    this.map.removeLayer(layer);
                }
            });
            this.baseLayers[type].addTo(this.map);
            this.dropdownOpen = false;
        },
        updateMarkers(data) {
            if (!data) {
                return 
            }
            if (this.markerLayer) {
                this.map.removeLayer(this.markerLayer);
            }

            this.markerLayer = L.layerGroup();
            data.forEach(item => {
                if (item.picture && 
                item.picture.latitude && 
                item.picture.longitude) {
                    const lat = item.picture.latitude;
                    const lng = item.picture.longitude;
                    const marker = L.circleMarker([lat, lng], {
                        radius: 2, 
                        fillColor: "#3388ff",
                        color: "#3388ff",
                        weight: 1,
                        opacity: 1,
                        fillOpacity: 0.7,
                    }).bindPopup(`Lat: ${lat}, Lng: ${lng}`);

                    this.markerLayer.addLayer(marker);
                }
            });

            this.markerLayer.addTo(this.map);
        },
    },
};
</script>

<style scoped>
#map-container {
    position: relative;
    width: 100%;
    height: 100%;
}

#map{
    width: 100%;
    height: 100%;
    border-radius: 8px;
}

.station-label {
    background-color: transparent !important;
    border: none !important;
    color: black;
    font-size: 10px;
    font-weight: bold;
}

#basemap-dropdown {
    position: absolute;
    top: 0px;
    left: 0px;
    z-index: 1000;
}

.dropdown-toggle,
.dropdown-menu li {
  font-size: 14px; 
  border-radius: 8px;
}

.dropdown-toggle {
    background: rgba(0, 0, 0, 0.6);
    color: #fff;
    padding: 8px 16px;
    border: none;
    cursor: pointer;
}

.dropdown-menu {
  position: absolute;
  top: 40px;
  left: 0;
  background: rgba(0, 0, 0, 0.8);
  list-style-type: none;
  padding: 0px 0;
  margin: 0;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
  color: #fff;
}

.dropdown-menu li {
  padding: 8px 16px;
  cursor: pointer;
  transition: background 0.2s;
}

.dropdown-menu li:hover {
  background: rgba(255, 255, 255, 0.2);
}
</style>