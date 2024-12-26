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
  background: rgba(46, 83, 81, 0.35);
  border: 1px solid rgba(46, 83, 81, 0.3);
  color: #CBE9E7;
  cursor: pointer;
  font-weight: 600;
  font-size: 18px;
  text-transform: uppercase;
  transition: all 0.3s ease;
  border-radius: 5px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  transform: translateY(0);
}

.tab:hover {
  background: rgba(168, 216, 212, 0.2);
  border-color: rgba(168, 216, 212, 0.3);
  color: #FFFFFF;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
  transform: translateY(-2px);
}

.tab.active {
  background: rgba(46, 83, 81, 0.6);
  border-color: rgba(46, 83, 81, 0.7);
  color: #CBE9E7;
  font-weight: bold;

  box-shadow: 0 3px 6px rgba(0, 0, 0, 0.25);
  border-bottom: 3px solid #A8D8D4;
}
</style>
