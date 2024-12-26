<template>
  <div class="schema-editor">
    <div class="fields-container">

      <!-- Child Dataset -->
      <div class="fields-section child-fields">
        <div class="fields-list">
          <div v-for="field in getIdFields(childFields)" :key="field" class="field-card">
            {{ field }}
          </div>
        </div>
      </div>

      <!-- Parent Dataset -->
      <div class="fields-section parent-fields">
        <div class="fields-list">
          <div v-for="field in getIdFields(parentFields)" :key="field" class="field-card">
            {{ field }}
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { defineProps } from 'vue';

defineProps({
  childFields: Array,
  parentFields: Array,
});

// Get fields that end with 'id'
// @param {Array} fields: The fields to filter, typically the column
//  names in an excel sheet.
// @returns {Array} - The fields that end with 'id'.
// @TODO: This is a temporary solution. We need to find a better way to
//  identify the fields that are IDs.
const getIdFields = (fields) => {
  return fields.filter(field => field.toLowerCase().endsWith('id'));
}
</script>

<style scoped>
.schema-editor {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
  width: 100%;
  max-width: 800px;
  height: 60vh;
}

.fields-container {
  display: flex;
  width: 100%;
  gap: 20px;
  height: 100%;
}

.fields-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.fields-section h5 {
  margin-bottom: 10px;
  text-align: left;
  font-weight: 600;
  font-size: 18px;
  text-transform: uppercase;
  color: #7e748f;
  font-family: monospace;
}

.fields-list {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
}

.field-card {
  padding: 10px;
  margin: 5px 0;
  border-radius: 5px;
  color: #7e748f;
  font-size: 14px;
  font-weight: 600;
  font-family: monospace;
  text-align: left;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
  cursor: grab;
  transition: background 0.3s ease, transform 0.3s ease;

  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

.field-card:hover {
    background-color: #A8D8D433;

  transform: translateY(-2px);
}

</style>
