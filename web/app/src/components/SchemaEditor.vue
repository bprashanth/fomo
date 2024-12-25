<template>
  <div class="schema-editor">
    <div class="fields-container">

      <!-- Child Dataset -->
      <div class="fields-section child-fields">
        <h5>Child Fields</h5>
        <div class="fields-list">
          <div v-for="field in childFields" :key="field" class="field-card">
            {{ field }}
          </div>
        </div>
      </div>

      <!-- Parent Dataset -->
      <div class="fields-section parent-fields">
        <h5>Parent Fields</h5>
        <div class="fields-list">
          <div v-for="field in parentFields" :key="field" class="field-card">
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
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.2);
  padding: 10px;
  border-radius: 5px;
  box-shadow: inset 0 2px 5px rgba(0, 0, 0, 0.1);
}

.field-card {
  padding: 10px;
  margin: 5px 0;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 5px;
  color: #7e748f;
  font-size: 14px;
  font-weight: 600;
  font-family: monospace;
  text-align: left;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
  cursor: grab;
  transition: background 0.3s ease, transform 0.3s ease;
}

.field-card:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: translateY(-2px);
}

</style>
