<!-- SchemaPanel.vue

@TODO:
  - This entire component needs a thorough refactor.
  - Find a way to manage large query sizes in JsonViewer.
  - Display the restricted query results info.
  - Merge duplication with ImagePanel (all the getValueByPath logic).
-->

<template>
    <div class="schema-panel">
        <div class="query-section">
            <textarea v-model="query" placeholder="select * from ? where survey->..."></textarea>
            <button @click="runQuery">Run</button>
        </div>
        <div class="schema-display">
            <div v-if="queryResult && Array.isArray(queryResult) && queryResult.length > 100" class="result-notice"
            >
                100/{{ queryResult.length }} results...
            </div>
            <JsonViewer :value="limitedQueryResult" sort theme="dark" @click="handleFieldClick"/>
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted, defineEmits, defineProps, computed, watch } from 'vue';
import alasql from 'alasql';

// https://www.npmjs.com/package/vue3-json-viewer
import { JsonViewer } from 'vue3-json-viewer';
import "vue3-json-viewer/dist/index.css";

// const schemaData = schemaDefinitions;
const query = ref('');
const editorData = ref(null);
const emit = defineEmits(['field-selected', 'query-result-updated']);

const props = defineProps({
  schema: {
    type: Object,
    required: false
  },
  data: {
    type: Array,
    required: false
  },
  // NoteUpdate is an object:
  // {
  //   notes: [notes added to image],
  //   fieldKey: 'key to image field',
  //   fieldValue: 'value of image field'
  // }
  noteUpdate: {
    type: Object,
    required: false,
    default: null
  }
});
console.log("Props from schema panel ", props);

// Why do we need watch?
// Notes are sent in from the ImagePanel, piped up to the DashboardComponent,
// and then down to the SchemaPanel.
// When the user annotates an image with notes, we update the editorData (which
// is the local copy of the joinedData coming in from the App.vue) with notes.
// This way when the user runs a new query, the notes are included in the query
// result.
watch(() => props.noteUpdate, (newNoteUpdate) => {
  if (!newNoteUpdate || !editorData.value) return;

  const { notes, fieldKey, fieldValue } = newNoteUpdate;

  // Find the matching record in editorData
  const recordIndex = editorData.value.findIndex(record => {
    // Handle nested paths using reduce
    const content = getValueByPath(record, fieldKey);
    if (typeof content != 'string' || !content) {
      return false;
    }
    if (content.trim().replace(/['"]+/g, '') === fieldValue) {
        console.log("SchemaPanel: found matching record for notes: fieldKey: ", fieldKey, "fieldValue: ", fieldValue);
        return true;
    } else if (content.includes(fieldValue)) {
        console.log("SchemaPanel: found similar record notes: fieldKey: ", fieldKey, "fieldValue: ", fieldValue);
        return true;
    }
    return false;
  });

  if (recordIndex !== -1) {
    // Create a new copy of the record to maintain reactivity
    const updatedRecord = { ...editorData.value[recordIndex] };
    updatedRecord.notes = notes;

    // Update the editorData array
    editorData.value = [
      ...editorData.value.slice(0, recordIndex),
      updatedRecord,
      ...editorData.value.slice(recordIndex + 1)
    ];
  }
}, { deep: true });

/**
 * Gets the value of a field by its path.
 *
 * @params
 *  - obj: The object to get the value from.
 *  - path: The path to the value.
 *
 * @returns {Object} The value of the field.
 */
const getValueByPath = (obj, path) => {
    return path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : null), obj);
};

// Rather than import from assets like so:
// we keep all the data files in public/data and fetch them in onMounted.
const schemaDefinitions = ref(null);
const queryResult = ref(null);


// HACK: We limit the number of results to 100, because the JsonViewer is slow
// and crashes the browser when there are too many results. It also blocks
// rendering of subsequent queries. We need a long term solution here.
const limitedQueryResult = computed(() => {
    if (!queryResult.value) return null;
    if (Array.isArray(queryResult.value)) {
        return queryResult.value.slice(0, 100);
    }
    return queryResult.value;
});


onMounted(async () => {
    editorData.value = props.data;
    schemaDefinitions.value = props.schema;
    queryResult.value = schemaDefinitions.value;

    console.log("SchemaPanel: onMounted, editorData: ", editorData.value, "schemaDefinitions: ", schemaDefinitions.value);
});

function extractSensorValues(obj, pathParts, parentIndex) {
  /**
   * Extract sensor data according to the given path.
   * @param {Object} obj - The input object to extract values from.
   * @param {Array} pathParts - List of path segments like ['cameraTrap', 'inference', 'field1'].
   * @param {Number} parentIndex - The index of the parent row in the master list.
   * @return {Array} - Returns a flat list of all matching values, each with a reference to its parent index.
   */
  if (!obj.sensors || !Array.isArray(obj.sensors)) return [];

  let currentValues = obj.sensors;

  for (const part of pathParts) {
    const newValues = [];

    for (const currentValue of currentValues) {
      if (typeof currentValue === 'object' && currentValue[part]) {
        const extractedValue = currentValue[part];

        if (Array.isArray(extractedValue)) {
          for (const value of extractedValue) {
            newValues.push({ ...value, __parentIndex__: parentIndex }); // Attach parent index
          }
        } else {
          newValues.push({ ...extractedValue, __parentIndex__: parentIndex }); // Attach parent index
        }
      }
    }

    if (newValues.length === 0) return [];
    currentValues = newValues;
  }

  return currentValues;
}

function runQuery() {
    console.log('Running query...')
    if (!editorData.value) {
        queryResult.value = { error: 'Data not loaded yet' };
        return;
    }

    try {
        let result;

        // Check if the query contains "sensors->", meaning it needs special logic
        if (query.value.includes('sensors->')) {
            console.log('Running sensor-based query');

            // Step 1: Split the query into prefix, path, and suffix
            const parts = query.value.split('->');
            const prefix = parts[0].replace(/sensors$/, '').trim(); // Get everything before sensors
            const suffix = parts[parts.length - 1]; // The last part is like "prediction='other'"
            const pathParts = parts.slice(1, -1).map(part => part.replace(/[^a-zA-Z0-9_]/g, '')); // Remove special chars

            console.log('Query Parts:', { prefix, pathParts, suffix });

            // Step 2: Flatten the data using the path
            const extractedData = editorData.value.flatMap((record, index) => extractSensorValues(record, pathParts, index));

            // Step 3: Run the final query on the flattened data
            const finalQuery = `${prefix} ${suffix}`.replace(/COUNT\(\*\)/i, '*');
            console.log('New Query (after replacement):', finalQuery);

            const queryResultWithChildren = alasql(finalQuery, [extractedData]);

            // Step 5: Extract the parent objects from the query results using parent indexes
            const parentObjects = queryResultWithChildren.map(item => editorData.value[item.__parentIndex__]); // Extract parent using index
            const uniqueParents = Array.from(new Set(parentObjects.map(obj => JSON.stringify(obj)))).map(json => JSON.parse(json));
            console.log('Parent Objects:', uniqueParents);

            if (query.value.toLowerCase().includes('count(*)')) {
                queryResult.value = [{ total: uniqueParents.length }];
            } else {
                queryResult.value = uniqueParents;
            }

        } else if (query.value.includes('notes->text')) {
            console.log('Notes query: ', query.value);

            // Split the query on AND to separate notes query from additional
            // conditions. Don't toLower this query, as the params are case
            // sensitive.
            // TODO(prashanth@): check if AND is included in the query.
            const [notesQuery, ...additionalClauses] = query.value.split(' and ');

            // First get results from notes query
            let results = queryNotes(notesQuery);

            // If there are additional clauses, run them through alasql
            if (additionalClauses.length > 0) {
              // Reconstruct the remaining query
              const conditions = additionalClauses.join(' AND ').trim();
              results = alasql("select * from ? where " + conditions, [results]);
              console.log('Results after additional filters: ', conditions, ' are ', results);
            }

            queryResult.value = results;
        } else {
            console.log('Running normal AlaSQL query: ', query.value);
            result = alasql(query.value, [editorData.value]);
            queryResult.value = result;
        }

        if (queryResult.value) {
            console.log("SchemaPanel: emitting query-result-updated with: ", queryResult.value)
            emit('query-result-updated', queryResult.value);
        }
    } catch (error) {
        console.error('Query Error:', error);
        queryResult.value = { error: 'Invalid Query' };
    }
}


const queryNotes = (query) => {
  console.log('Querying notes: ', query);

  const regexMatch = query.match(/notes->text\s*=\s*["'](.+?)["']/i);
  if (!regexMatch) {
    console.warning('Invalid notes query: ', query);
    return [];
  }

  // Get the pattern and convert SQL wildcards (*) to regex wildcards (.*)
  let pattern = regexMatch[1].replace(/\*/g, '.*');
  const regex = new RegExp(pattern, 'i');

  // Filter the editorData to find records with matching notes
  return editorData.value.filter(record => {
    if (!record.notes || !Array.isArray(record.notes)) {
      return false;
    }
    // Check if any note's text matches the regex
    return record.notes.some(note => regex.test(note.text));
  });
}


const handleFieldClick = (event) => {
    const target = event.target;
    if (!target) {
        console.log("No target event for click.")
        return
    }
    emit('field-selected', {
        field: target,
        queryResult: queryResult.value === schemaDefinitions.value ? null : queryResult.value
    })
};
</script>


<style scoped>
.schema-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    background-color: #282C34;
    border-radius: 8px;
}

textarea {
    width: 100%;
    resize: none;
    padding: 8px;
    font-family: monospace;
    background-color: #333;
    color: #ddd;
    border: 1px solid #555;
    border-radius: 4px;
}

button {
    padding: 6px 12px;
    cursor: pointer;
    background-color: #317183;
    color: #282C34;
    border: none;
    border-radius: 4px;
    font-weight: bold;
}

.query-section {
    display: flex;
    gap: 10px;
    padding: 10px;
}

.schema-display {
    overflow-y: auto;
    text-align: left;
}

.result-notice {
    padding: 8px;
    color: #317183;
    font-family: monospace;
    font-weight: bold;
    text-align: right;
}
</style>
