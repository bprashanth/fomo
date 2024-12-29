<template>
  <div class="json-viewport">
    <json-viewer
    v-if="props.fullData && props.parentTab"
    :value="joinedData[0]"
    theme="dark"
    sort
    />
  </div>
</template>

<script setup>
import { JsonViewer } from 'vue3-json-viewer';
import 'vue3-json-viewer/dist/index.css';
import { defineProps, computed, watchEffect } from 'vue';

const props = defineProps({
  fullData: Object,
  parentTab: String,
  parentFieldsWithJoins: Array,
});

watchEffect(() => {
  console.log('JsonViewer: parentFieldsWithJoins', props.parentFieldsWithJoins);
  console.log('JsonViewer: fullData', props.fullData);
  console.log('JsonViewer: parentTab', props.parentTab);
});

const joinedData = computed(() => {
  if(!props.fullData || !props.parentTab || !props.parentFieldsWithJoins) {
    console.log('No fullData, parentTab, or parentFieldsWithJoins');
    return [];
  }
  console.log('Running join on', props.parentFieldsWithJoins);
  // Create a deep copy of the parent data.
  // TODO: can we use structuredClone here since fullData is a JSON object?
  const result = JSON.parse(JSON.stringify(props.fullData[props.parentTab]));

  result.forEach(parentRecord => {
    props.parentFieldsWithJoins.forEach(({name: parentField, joins}) => {
      joins.forEach(joinSpec => {
        const [childTab, childField] = joinSpec.split('.');
        const childData = props.fullData[childTab];
        console.log('childTab', childTab, 'childField', childField, 'childData', childData);

        if (!childData) return;

        // Find all matching child records
        const matches = childData.filter(childRecord =>
          childRecord[childField] === parentRecord[parentField]
        );

        console.log('matches', matches, 'for', parentField, 'in', childTab, 'with', childField);

        // Create the new field name for the joined data.
        const joinedFieldName = `${childTab}.${childField}`;

        if (matches.length === 0) {
          parentRecord[joinedFieldName] = null;
        } else if (matches.length === 1) {
          parentRecord[joinedFieldName] = matches[0];
        } else {
          parentRecord[joinedFieldName] = matches;
        }
      });
    });
  });

  return result;
});

</script>

<style scoped>

.json-viewport {
  width: 100%;
  height: 100%;
  overflow: auto;
}

/* JsonViewer styling
 * div.json-viewport (this code)
 * div.jv-container.jv-dark (background)
 * div.jv-code
 * span.jv-item,jv-string (text coloring)
*/
:deep(.jv-container) {
  font-size: 10px;
  font-weight: 600;
  text-align: left;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
  background: rgb(21, 21, 21, 1.0);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  font-family: monospace;
  border-radius: 10px;
}

:deep(.jv-code) {
  padding: 10px;
}

</style>
