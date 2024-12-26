<template>
  <div class="schema-editor">
    <div class="fields-container">

      <!-- Child Dataset -->
      <div class="fields-section child-fields">
        <div class="fields-list">
          <div
          v-for="field in getIdFields(props.childFields)"
          :key="field"
          class="field-card"
          draggable="true"
          @dragstart="handleDragStart(field)"
          >
            {{ field }}
          </div>
        </div>
      </div>

      <!-- Parent Dataset -->
      <div class="fields-section parent-fields">
        <div class="fields-list">
          <div
          v-for="fieldName in getIdFields(props.parentFields)"
          :key="fieldName"
          class="field-card"
          @dragover.prevent
          @drop="handleDrop(fieldName)"
          >
            {{ fieldName }}

            <!-- Redner joined sub-fields -->
            <div
            v-if="getJoinsForField(fieldName).length"
            class="sub-field-list"
            >
              <div
              v-for="join in getJoinsForField(fieldName)"
              :key="join"
              class="sub-field-card"
              >
                {{ join }}
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { defineProps, ref, watchEffect } from 'vue';

const props = defineProps({
  childFields: Array,
  parentFields: Array,
  childTabSelected: String,
  separator: String,
});

// State tracking each parent field with their dropped child fields.
// TODO: do we need to save state across parent tab changes?
const parentFieldsWithJoins = ref([]);

// On the use of watchEffect:
// watchEffect runs whenever one of the refs used within it changes.
// It also runs at mount time. If we had simply tried to initialize
// parentFieldsWithJoins at mount time, it would have been empty.
// watchEffect clears the joins array whenever the parent tab is switched,
// meaning users will have to re-do their joins on switching back.
watchEffect(() => {
  console.log('Separator prop:', props.separator);
  parentFieldsWithJoins.value = props.parentFields.map((field) => ({
    name: field,
    joins: [],
  }));
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

// Helper function to get the joins for a given parent field.
// @param {String} fieldName: The name of the parent field.
// @returns {Array} - The joins for the parent field - i.e the child fields
//  dropped onto this parent field.
const getJoinsForField = (fieldName) => {
  const parentField = parentFieldsWithJoins.value.find(
    (field) => field.name === fieldName
  );
  return parentField ? parentField.joins : [];
};

// State tracking the name of the child field being dragged.
const draggedField = ref(null);

// Record the name of the child field being dragged.
//
// @param {String} field: The name of the field being dragged.
const handleDragStart = (field) => {
  draggedField.value = field;
};

// Handle the drop event for the parent field.
//
// The "from" field is the child field that is being dragged. This field is
// stored in draggedField on dropStart. Each parent field has an array of
// "joins" or fields that have been dropped on it. We use the parentFieldName
// to lookup the right Join array and add the draggedField to it.
//
// @param {String} parentFieldName: The name of the field receiving the drop.
const handleDrop = (parentFieldName) => {
  console.log('handling drop');
  if (!draggedField.value) {
    console.error('No field to drop');
    return;
  }
  const parentField = parentFieldsWithJoins.value.find(
    (field) => field.name === parentFieldName
  );
  if (!parentField) {
    console.error('Parent field not found');
    return;
  }
  if (parentField.joins.includes(draggedField.value)) {
    console.warning('Field already joined');
    return;
  }
  parentField.joins.push(
    props.childTabSelected + props.separator + draggedField.value);
  draggedField.value = null;
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
