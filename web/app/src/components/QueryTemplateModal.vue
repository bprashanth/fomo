<!-- QueryTemplateModal.vue

A two-step modal for selecting key-value pairs for query templates.
Step 1: Select a key that matches the placeholder (e.g., sitename -> site_name, site_id, etc.)
Step 2: Select a value from the available values for that key.

@props:
  - show: boolean to control modal visibility
  - placeholderName: the placeholder name (e.g., 'sitename')
  - data: the data array to search through
  - template: the template object with sqlTemplate

@emits:
  - close: when modal is closed
  - resolved: when key-value pair is selected with the resolved SQL query
-->
<template>
  <div v-if="show" class="modal-overlay" @click.self="closeModal">
    <div class="modal-card">
      <div class="modal-header">
        <h3>{{ modalTitle }}</h3>
        <button class="modal-close" @click="closeModal">&times;</button>
      </div>

      <div class="modal-content">
        <!-- Step 1: Key Selection -->
        <div v-if="step === 1" class="step-container">
          <p>Suggested:</p>
          <div class="options-list">
            <div
              v-for="key in matchingKeys"
              :key="key"
              class="option-item"
              @click="selectKey(key)"
            >
              {{ key }}
            </div>
          </div>

          <div class="expandable-section">
            <div class="section-header" @click="toggleDropdown">
              <span class="section-title">All fields</span>
              <span class="expand-arrow" :class="{ 'expanded': showDropdown }">▼</span>
            </div>
            <div v-if="showDropdown" class="expandable-content">
              <div class="options-list">
                <div
                  v-for="key in allKeys"
                  :key="key"
                  class="option-item"
                  @click="selectDropdownKey(key)"
                >
                  {{ key }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Step 2: Value Selection -->
        <div v-if="step === 2" class="step-container">
          <div class="options-list">
            <div
              v-for="value in uniqueValues"
              :key="value"
              class="option-item"
              @click="selectValue(value)"
            >
              {{ value }}
            </div>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button v-if="step === 2" @click="goBack" class="back-button">Back</button>
        <button @click="closeModal" class="cancel-button">Cancel</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, defineProps, defineEmits } from 'vue';

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  placeholderName: {
    type: String,
    required: true
  },
  data: {
    type: Array,
    required: true
  },
  template: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['close', 'resolved']);

const step = ref(1);
const selectedKey = ref(null);
const selectedValue = ref(null);
const showDropdown = ref(false);
// Remove selectedDropdownKey as it's not needed

// Hardcoded fuzzy matching for sitename placeholder
const sitenameKeyPatterns = [
  'site', 'siteid', 'site_id', 'site-id', 'site_name', 'site-name',
  'name', 'sitename', 'siteName', 'siteName', 'location', 'loc'
];

const modalTitle = computed(() => {
  if (step.value === 1) {
    return `Select Field for "${props.placeholderName}"`;
  } else {
    return `Select Value for "${selectedKey.value}"`;
  }
});

// Get all first-level keys from the data
const allKeys = computed(() => {
  if (!props.data || props.data.length === 0) return [];

  const keys = new Set();
  props.data.forEach(row => {
    Object.keys(row).forEach(key => {
      keys.add(key);
    });
  });

  return Array.from(keys).sort();
});

// Find all keys that could match the placeholder
const matchingKeys = computed(() => {
  if (!props.data || props.data.length === 0) return [];

  const allKeys = new Set();
  props.data.forEach(row => {
    Object.keys(row).forEach(key => {
      allKeys.add(key);
    });
  });

  // Filter keys that match our patterns (case insensitive)
  const matching = Array.from(allKeys).filter(key => {
    const lowerKey = key.toLowerCase();
    return sitenameKeyPatterns.some(pattern =>
      lowerKey.includes(pattern.toLowerCase()) ||
      pattern.toLowerCase().includes(lowerKey)
    );
  });

  return matching.sort();
});

// Get unique values for the selected key
const uniqueValues = computed(() => {
  if (!selectedKey.value || !props.data) return [];

  const values = new Set();
  props.data.forEach(row => {
    const value = row[selectedKey.value];
    if (value !== null && value !== undefined) {
      values.add(String(value));
    }
  });

  return Array.from(values).sort();
});

function toggleDropdown() {
  showDropdown.value = !showDropdown.value;
}

function selectDropdownKey(key) {
  selectedKey.value = key;
  showDropdown.value = false;
  step.value = 2;
}

function selectKey(key) {
  selectedKey.value = key;
  step.value = 2;
}

function selectValue(value) {
  selectedValue.value = value;
  resolveQuery();
}

function goBack() {
  step.value = 1;
  selectedKey.value = null;
  selectedValue.value = null;
}

function resolveQuery() {
  if (!selectedKey.value || !selectedValue.value) return;

  // Replace placeholders in the SQL template
  let sql = props.template.sqlTemplate;
  sql = sql.replace('<key>', selectedKey.value);
  sql = sql.replace('<value>', selectedValue.value);

  // Replace any other placeholders with the selected value
  sql = sql.replace(new RegExp(`<${props.placeholderName}>`, 'g'), selectedValue.value);

  emit('resolved', sql);
  closeModal();
}

function closeModal() {
  step.value = 1;
  selectedKey.value = null;
  selectedValue.value = null;
  showDropdown.value = false;
  // selectedDropdownKey.value = null; // This line was removed by the user's edit hint
  emit('close');
}

// Reset when modal opens
watch(() => props.show, (newShow) => {
  if (newShow) {
    step.value = 1;
    selectedKey.value = null;
    selectedValue.value = null;
    showDropdown.value = false;
    // selectedDropdownKey.value = null; // This line was removed by the user's edit hint
  }
});
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-card {
  background-color: #333;
  border-radius: 8px;
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #555;
}

.modal-header h3 {
  margin: 0;
  color: #fff;
  font-family: monospace;
}

.modal-close {
  background: none;
  border: none;
  color: #fff;
  font-size: 24px;
  cursor: pointer;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-close:hover {
  color: #333;
}

.modal-content {
  padding: 20px;
  flex-grow: 1;
  overflow-y: auto;
}

.step-container p {
  margin-bottom: 15px;
  color: #fff;
  font-size: 16px;
  font-family: monospace;
}

.options-list {
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid #555;
  border-radius: 4px;
  background-color: #444;
}

.option-item {
  padding: 12px 15px;
  cursor: pointer;
  border-bottom: 1px solid #555;
  transition: background-color 0.2s;
  color: #fff;
  font-family: monospace;
}

.option-item:hover {
  background-color: #555;
}

.option-item:last-child {
  border-bottom: none;
}

.modal-footer {
  padding: 20px;
  border-top: 1px solid #555;
  display: flex;
  justify-content: space-between;
  gap: 10px;
}

.back-button, .cancel-button, .next-button {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-family: monospace;
  font-weight: bold;
}

.back-button {
  background-color: #666;
  color: #fff;
}

.back-button:hover {
  background-color: #e9ecef;
}

.cancel-button {
  background-color: #666;
  color: #fff;
}

.next-button {
  background-color: #317183;
  color: #282C34;
}

.next-button:disabled {
  background-color: #555;
  cursor: not-allowed;
}

/* Expandable section styles */
.expandable-section {
  margin-top: 20px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background-color: #444;
  border: 1px solid #555;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.section-header:hover {
  background-color: #555;
  border-color: #666;
}

.section-title {
  font-size: 14px;
  color: #fff;
  font-weight: 500;
  font-family: monospace;
}

.expand-arrow {
  font-size: 12px;
  color: #fff;
  transition: transform 0.2s ease;
}

.expand-arrow.expanded {
  transform: rotate(180deg);
}

.expandable-content {
  margin-top: 8px;
  border: 1px solid #555;
  border-radius: 4px;
  background-color: #333;
}

.expandable-content .options-list {
  border: none;
  border-radius: 0;
  max-height: 250px;
  background-color: #333;
}
</style>

