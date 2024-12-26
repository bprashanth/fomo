<template>
  <div class="tab-container">
    <ul class="tabs">
      <li
        v-for="(columns, tab) in tabs"
        :key="tab"
        :class="{ 'active': tab === selectedTab }"
        class="tab"
        @click="selectTab(tab, columns)"
        >
        {{ tab }}
      </li>
    </ul>
  </div>
</template>

<script setup>
import { defineProps, ref, defineEmits } from 'vue';

defineProps({
  // Parsed tab data: { tabName: [columnNames] }
  tabs: Object,
});

const emit = defineEmits(['tabSelected']);
const selectedTab = ref(null);

const selectTab = (tab, columns) => {
  selectedTab.value = tab;
  emit('tabSelected', { tab, columns });
};
</script>


<style scoped>
.tab-container {
  width: 100%;
  text-align: center;
}

.tabs {
  list-style: none;
  padding: 0;
  display: flex;
  gap: 10px;
  justify-content: center;
  font-family: monospace;
}

.tab {
  padding: 10px 20px;
  background: #ffffff52;
  border: 1px solid rgba(255, 255, 255, 0.2);

  color: #48817e;
  cursor: pointer;
  font-weight: 600;
  font-size: 18px;
  text-transform: uppercase;
  transition: background 0.3s ease, border-color 0.3s ease;
  border-radius: 5px;

}

.tab:hover {
  background: #A8D8D433;
  background-color: #A8D8D433;
}

.tab.active {
  background: #2E535133;
  border-color: #2E535133;
  font-weight: bold;
}
</style>
