<!-- ImagePanel.vue

@TODO:
  - This entire component needs a thorough refactor.
  - Decouple clicking logic from the DOM created by the json-viewer library.
  - Combine the image-switcher here and the editor-switcher in App.vue.
-->

<template>
    <!-- TODO:
      - Reinstate this click handler.
      - Add a check for the imageUrl to be a valid image.
      - If not, display a placeholder image.
      - Replace the placeholder text in the popup.
      - Debug failing fonts in the modal.
    -->
    <!-- <div v-if="imageUrl" class="image-container" @click="openPopup"> -->
    <div v-if="imageUrl" class="image-container" @click="openPopup">
        <img :src="imageUrl" alt="Selected Image">
    </div>

    <!-- Popup modal -->
    <div v-if="showPopup" class="popup-overlay" @click.self="closePopup">
        <div class="popup-card">
            <div class="popup-image-container" @click.stop="addNote">

              <!-- Image navigation buttons
                TODO: These buttons are the same as the ones in App.vue.
                  We should combine them into a single component.
              -->
              <div class="editor-switcher">
                <button @click.stop="showPrevious">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M15 6L9 12L15 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </button>
                <button @click.stop="showNext">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M9 18L15 12L9 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </button>
              </div>

              <img :src="imageUrl" alt="Full Image" class="popup-image"/>

              <!-- Render notes -->
              <div v-for="(note, index) in notes" :key="index" class="note" :style="{ left: `${note.x}%`, top: `${note.y}%` }">
                {{ note.text }}
              </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { defineProps, ref, watchEffect } from 'vue';

const props = defineProps({
    field: Object,
    queryResult: Array,
});

const showPopup = ref(false);
// Record the path to the clicked field, for use in next/previous buttons.
const matchingFieldPath = ref('');
// Record the index of the matching record, for use in next/previous buttons.
const matchingRecordIndex = ref(-1);
// Record the imageUrl to display in the popup.
const imageUrl = ref('');
// Record the notes to display in the popup.
const notes = ref([]);
// Local copy of queryResult to store notes.
// Set in watchEffect to props.queryResult.
const localQueryResult = ref([]);

/**
 * Add a note to the popup.
 *
 * This function uses relative offset coordinates to position the note.
 * Therefore it's important that any element it's used on should be positioned
 * absolutely. Moreover, justify-content: center; should NOT be used on the
 * parent element, because it messes with the coordinates of the notes. Ideally
 * the element should be width: 100% and height: 100% with object-fit: fill.
 *
 * @params
 *  - event: The event that triggered the note addition.
 */
function addNote(event) {
  // Ignore clicks outside the image.
  const imageElement = event.currentTarget.querySelector('img');
  if (!imageElement) return;

  const x = ((event.offsetX / imageElement.offsetWidth) * 100);
  const y = ((event.offsetY / imageElement.offsetHeight) * 100);

  const text = prompt('Enter note text:');
  if (text) {
    notes.value.push({ x, y, text});
  }
  console.log("ImagePanel: added notes: ", notes.value);
}

function saveNotes(index) {
  const record = localQueryResult.value[index];
  record.notes = [...notes.value];
  console.log("ImagePanel: saved notes: ", record.notes, "for index: ", index, "query result length: ", localQueryResult.value.length);
}

function loadNotes(index) {
  const record = localQueryResult.value[index];
  notes.value = record.notes || [];
  console.log("ImagePanel: loaded notes: ", notes.value, "for index: ", index, "query result length: ", localQueryResult.value.length);
}

/**
 * Updates the imageUrl based on the clicked field.
 *
 * The matchingRecord/FieldPath are used to retrieve the value of the field
 * within props.queryResult. If this field is not a path to either a local
 * image or a url to an image, it is ignored.
 *
 * @params
 *  - obj: The object to get the value from.
 *  - path: The path to the value.
 */
const updateImageUrl = (obj, path) => {
  if (!obj || !path) return;

  console.log("ImagePanel: updateImageUrl, path: ", path, "object: ", obj);
  const content = getValueByPath(obj, path);
  if (typeof content != 'string' || !content) {
    console.warn(
      'ImagePanel: content is not a string, skipping img update: ', content);
    return;
  }
  const cleanContent = content.trim().replace(/['"]+/g, '');
  if (cleanContent.includes('/data/') ||
      /\.(jpg|jpeg|png|webp)$/i.test(cleanContent)) {
      console.log("imageUrl computed: ", cleanContent);
      imageUrl.value = cleanContent;
  } else {
    console.warn(
      "ImagePanel: content is not a valid image url: ", cleanContent);
  }
}

// Why do we need watchEffect?
//
// We want to update the imageUrl whenever the user clicks on a field that
// contains an image url. This comes in via props.field, which is literally
// just the eg html span element the user clicks on.
//
// We use this span element to reverse lookup the key:value pair in the
// props.queryResult array (see comments above those functions). These values
// are then recorded in matchingRecordIndex and matchingFieldPath.
//
// We can't use a computed block because we also want to update imageUrl from
// button navigation within this component. So say we set imageUrl directly via
// props.field, we would need a second mathod to set it via button navigation.
// Currently, when the user clicks a button to move to the next/previous
// picture, it updates the imageUrl based on the matchingRecordIndex and
// matchingFieldPath values - which updateImageUrl knows how to handle.
//
// However, care must be taken. The watchEffect triggers everytime any variable
// that is _read_ within it is written to outside. This is why loadNotes uses
// matchingIndex (this doesn't create a dependency on matchingRecordIndex, and
// hence doesn't trigger watchEffect when matchingRecordIndex changes outside).
// This is also why we DO NOT need 2 separate watchEffects.

watchEffect(() => {
  if (!props.field || !props.queryResult) return;

  console.log("ImagePanel: watchEffect triggered");

  const keyValue = props.field.textContent?.trim().replace(/['"]+/g, '') || '';
  const keyElement = props.field.closest('.jv-node')?.querySelector('.jv-key');
  const keyName = keyElement?.textContent?.trim().replace(/[:]+/g, '');

  // We are fine resetting localQueryResult on every props.queryResult change
  // because queryResult will change only when a different query is run in the
  // schema panel. When that happens, merging it with localQueryResult won't
  // make sense because the indices will change, so the notes won't match the
  // images.
  localQueryResult.value = props.queryResult.map(item => ({
    ...item,
    notes: []
  }));

  const { matchingIndex, matchingPath } = constructClickedFieldKeyPath(
    keyName, keyValue);

  if (matchingIndex > -1 && matchingPath) {
    console.log("ImagePanel: matchingIndex: ", matchingIndex, "matchingPath: ", matchingPath);
    matchingRecordIndex.value = matchingIndex;
    matchingFieldPath.value = matchingPath;
    updateImageUrl(props.queryResult[matchingIndex], matchingPath);
  } else {
    console.warn("ImagePanel: no matching index/path found for the clicked field.");
  }
});

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

const showPrevious = () => {
  if (props.queryResult.length === 0 || matchingRecordIndex.value === -1) return;

  saveNotes(matchingRecordIndex.value);
  matchingRecordIndex.value = (matchingRecordIndex.value - 1) % props.queryResult.length;
  updateImageUrl(
    props.queryResult[matchingRecordIndex.value], matchingFieldPath.value);
  loadNotes(matchingRecordIndex.value);
}

const showNext = () => {
  if (props.queryResult.length === 0 || matchingRecordIndex.value === -1) return;

  saveNotes(matchingRecordIndex.value);
  matchingRecordIndex.value = (matchingRecordIndex.value + 1) % props.queryResult.length;
  updateImageUrl(
    props.queryResult[matchingRecordIndex.value], matchingFieldPath.value);
  loadNotes(matchingRecordIndex.value);
}

/**
 * Constructs the key path for the clicked field.
 *
 * If the clicked field is a "value" in the json, this function can find it's
 * key name. It does this by traversing the DOM created by the json-viewer
 * library.
 *
 * When the user directly clicks on a "key", the closest element with a jv-node
 * is that key itself. So we don't find anything matching the value.
 *
 * The way to use this function is to only trigger it based on the imageURL
 * regex, so we're only running it when the user clicks on an image. Otherwise
 * it will end up matching the same key:value in the first field encountered.
 *
 * @params
 *  - props.field: The field that the user clicked on.
 *  - props.queryResult: The query result array.
 *
 * @returns {Object} An object with the matching index and path. Eg:
 *  { matchingIndex: 0, matchingPath: 'picture.imageURL' }
 *
 * The index is used to continue the traversal of the queryResult array from
 * that image onwards.
 */
function constructClickedFieldKeyPath(keyName, keyValue) {
  if (!keyName || !keyValue) {
    console.log("ImagePanel: no key name/value found for the clicked field.");
    return {
      matchingIndex: -1, matchingPath: ''
    };
  }

  console.log("ImagePanel: finding matching object for key: ", keyName, "value: ", keyValue);
  const { matchingIndex, matchingPath } = findMatchingObject(
    props.queryResult,
    keyName,
    keyValue
  );

  return { matchingIndex, matchingPath };
}

/**
 * Finds the matching object in the given array.
 *
 * In order to do this it runs "traverse" on each object of the array, till it
 * encounters the first one that has a matching key:value. This match occurs at
 * the "leaf" level, eg:
 *
 * {
 *   "key1": "value1",
 *   "key2": {
 *     "key3": "value3"
 *   }
 * }
 *
 * The match happens at key3:value3, but the path recorded is key2.key3.
 * This is achieved by recursing on each "object" value encountered, and on
 * each recursion resetting the current path to the current path + the key of
 * that object.
 *
 * @params
 *  - array: The queryResult array.
 *  - keyName: The key name to search for.
 *  - keyValue: The key value to search for.
 *
 * @returns {Object} An object with the matching index and path.
 */
function findMatchingObject(array, keyName, keyValue) {
  if (!array || !keyName || !keyValue) {
    console.warn("ImagePanel: no array, keyName or keyValue found.");
    return {
      matchingIndex: -1, matchingPath: []
    }
  }

  let matchingIndex = -1;
  let matchingPath = '';

  const traverse = (obj, path = []) => {
    if (typeof obj !== 'object' || obj === null) return;

    for (const [key, value] of Object.entries(obj)) {
      const currentPath = [...path, key];
      console.log("ImagePanel currentPath: ", currentPath);

      // Doesn't work for ints/lat/long etc.
      if (key === keyName && value === keyValue) {
        matchingPath = currentPath.join('.');
        return true;
      } else {
        console.log("ImagePanel: key/value not found, found values: ", key, value, " want values: ", keyName, keyValue);
      }

      if (typeof value === 'object') {
        console.log("ImagePanel: traversing object: ", value);
        if (traverse(value, currentPath)) {
          return true;
        }
      }
    }
  }

  for (let i = 0; i < array.length; i++) {
    if (traverse(array[i])) {
      console.log("ImagePanel: found matching index: ", i, "matchingPath: ", matchingPath);
      matchingIndex = i;
      break;
    }
  }

  return { matchingIndex, matchingPath };
}

function openPopup() {
    showPopup.value = true;
}

function closePopup() {
    showPopup.value = false;
    console.log("setting showPopup to: ", showPopup.value);
}

</script>

<style scoped>
.image-container {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    height: 100%;
    overflow: hidden;
    border-radius: 8px;
    cursor: pointer;
}

img {
    max-width: 100%;
    border-radius: 8px;
}

/* Image popup
 *
 * popup-overlay: is the blurry background.
 * popup-card: is the container for both the image and the text.
 * popup-image: is the left half of popup-card, the image.
 * popup-description: is the right half of the popup-card, the text.
 */

.popup-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    justify-content: center;
    align-items: center;
    backdrop-filter: blur(10px);
    z-index: 1000;
}

.popup-card {
    display: flex;
    width: 90%;
    height: 90%;
    border-radius: 15px;
    overflow: hidden;
    position: relative;
    box-shadow: 0px 0px 20px rgba(0, 0, 0, 0.5);
}

/*
 * Do NOT use justify-content: center; here because it messes with the
 * coordinates of the notes.
 */
.popup-image-container {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    max-width: 100%;
    height: 100%;
    overflow: hidden;
}

.popup-image {
    object-fit: contain;
    height: auto;
    /* Why not preserve aspect ratio?
     *
     * fill: The image will be distorted. i.e if it's a rectangular image, and
     * the container is square, the rectangle is stretched to fill the square.
     *
     * cover: the image will NOT be distored, but it may be zoomed in/cropped to
     * fill the container.
     *
     * contain: The image will NOT be distorted, if it is larger than the
     *  container, it will be scaled down, if it's smaller, scaled up, but its
     *  aspect ratio won't be changed (i.e a 200x100 image will become a
     *  400x200 image, even in a 400x400 container).
     *
     * And finally object-fit: scale-down will avoid scaling up like contain
     * does, it will only scale down if the image doesn't fit.
     *
     * We want to use fill to make sure the overlay notes position correctly.
     * This is the same reason for width == height == 100%.
     */
    width: 100%;
    height: 100%;
    object-fit: fill;
}


.popup-description {
    flex: 1;
    background-color: #0C0D10;
    color: white;
    padding: 2em;
    display: flex;
    flex-direction: column;
    text-align: left;
    height: 100%;
    box-sizing: border-box;
}

.popup-description-topbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    font-weight: bold;
    color: #B0B0B0;
}

.popup-description-username {
    display: inline-flex;
    align-items: center;
}

.popup-description-content {
    margin-top: 1em;
    font-size: calc(1vw + 0.5em);
    line-height: 1.5em;
    word-wrap: break-word;
    flex-grow: 1;
    overflow-y: auto;
}

.popup-description-content p {
    margin: 0;
    padding: 0;
}

.popup-close {
    position: absolute;
    top: 8px;
    right: 15px;
    z-index: 10;

    font-size: 1.5em;
    color: #B0B0B0;
    cursor: pointer;
    background: none;
    border: none;
    padding: 0;
    transition: color 0.3s ease;
    border-radius: 50%;
    display: flex;
}

.popup-close:hover {
    color: #fff;
}

/* AI results section */
.ai-section {
    padding: 1em 0.5em 0.5em 1em;
    border-radius: 8px;
    margin-top: 1em;
    font-size: calc(0.8vw + 0.5em);
    border: 1px solid #333;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);

    word-wrap: break-word;
    overflow-y: auto;
    font-family: "Courier New", Courier, monospace;
    text-align: left;
    font-family: monospace;
}

.ai-results-content {
    padding-left: 10px;
    padding-top: 10px;
}

.ai-results-footer {
    display: flex;
    justify-content: flex-end;
    padding-top: 10px;
}

.ai-results-footer strong {
  font-size: 10px;
  color: #ada579;
  text-align: right;
}

.ai-results-content strong {
  color: #ccc;
}

.ai-results-content span {
  color: #ada579;
}

.editor-switcher {
  position: absolute;
  bottom: 20px;
  display: flex;
  border-radius: 5px;
  overflow: hidden;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
  background-color: #151515;
}

.editor-switcher button {
  border: none;
  color: rgb(21, 21, 21, 0.5);
  cursor: pointer;
  position: relative;
  background-color: transparent;
  color: #1E628C;
}

.editor-switcher button:hover:not(:disabled) {
  color: #3388ff;
}

.note {
  position: absolute;
  background: rgb(255, 255, 0);
  color: black;
  font-size: 12px;
  transform: translate(-50%, -50%);
  border-radius: 3px;
}

</style>
