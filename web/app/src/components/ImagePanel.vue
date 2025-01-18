<!-- ImagePanel.vue

@TODO:
  - This entire component needs a thorough refactor.
  - Decouple clicking logic from the DOM created by the json-viewer library.
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
            <div class="popup-image-container">

                <!-- <button
                class="nav-button"
                @click="showPrevious" :disabled="!canNavigatePrevious">
                  Previous
                </button> -->

                <img :src="imageUrl" alt="Full Image" class="popup-image"/>

                <!-- <button
                class="nav-button"
                @click="showNext"
                :disabled="!canNavigateNext">
                  Next
                </button> -->
            </div>
        </div>
    </div>
</template>

<script setup>
import { defineProps, ref, computed, watchEffect } from 'vue';

const props = defineProps({
    field: Object,
    queryResult: Array,
});

const showPopup = ref(false);
const lastImageUrl = ref(null);
const matchingRecord = ref(null);
const clickedFieldPath = ref('');
const clickedFieldIndex = ref(-1);


const imageUrl = computed(() => {
    if (!props.field) return lastImageUrl.value;

    const textContent = props.field.textContent || '';
    const cleanContent = textContent.trim().replace(/['"]+/g, '');

    // Now test the cleaned content
    if (cleanContent.includes('/data/') ||
        /\.(jpg|jpeg|png|webp)$/i.test(cleanContent)) {
        console.log("imageUrl computed, returning: ", cleanContent);
        return cleanContent;
    }

    console.log("imageUrl computed failed, returning: ", lastImageUrl.value);
    return lastImageUrl.value;
})

// Why do we need watchEffect?
//
// The computed blocks above can't be used to set matchingRecord.
// The only way to set matchingRecord is in a standalone watch block, or in its
// own computed block. If we use another computed block for matchingRecord
// however we will run into the problem of having to check if the clicked field
// is a url field or not, and in the case of it not being a url field,
// returning the lastMatchingRecord. We can't return null or the modal will
// stop displaying the image's details.
//
// How does this work now?
//
// If imageURL has been updated (which will only happen when the user clicks
// on  a /data/ link), also update the lastImageUrl and lastMatchingRecord
// values.
// When the user clicks on other non-url fields we want to ignore and
// continue showing the previously clicked image details.

watchEffect(() => {
  if (imageUrl.value && imageUrl.value !== lastImageUrl.value) {
    lastImageUrl.value = imageUrl.value;

    const { matchingIndex, matchingPath } = constructClickedFieldKeyPath();
    clickedFieldPath.value = matchingPath;
    clickedFieldIndex.value = matchingIndex;

    console.log("ImagePanel: matching path: ", matchingPath);
    console.log("ImagePanel: matching index: ", matchingIndex);
    console.log("ImagePanel: value of clicked path: ",
      getValueByPath(props.queryResult[matchingIndex], matchingPath));

    if (props.queryResult) {
        matchingRecord.value = props.queryResult.find(
            record => record.picture &&
            record.picture.imageURL === imageUrl.value
        ) || {};
    }
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
function constructClickedFieldKeyPath() {
  if (!props.field || !props.queryResult) return {
    matchingIndex: -1, matchingPath: ''
  };

  const keyValue = props.field.textContent?.trim().replace(/['"]+/g, '') || '';
  const keyElement = props.field.closest('.jv-node')?.querySelector('.jv-key');
  const keyName = keyElement?.textContent?.trim().replace(/[:]+/g, '');
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
  if (!array || !keyName || !keyValue) return {
    matchingIndex: -1, matchingPath: []
  };

  let matchingIndex = -1;
  let matchingPath = '';

  const traverse = (obj, path = []) => {
    if (typeof obj !== 'object' || obj === null) return;

    for (const [key, value] of Object.entries(obj)) {
      const currentPath = [...path, key];

      // Doesn't work for ints/lat/long etc.
      if (key === keyName && value === keyValue) {
        matchingPath = currentPath.join('.');
        return true;
      }

      if (typeof value === 'object') {
        if (traverse(value, currentPath)) {
          return true;
        }
      }
    }
  }

  for (let i = 0; i < array.length; i++) {
    if (traverse(array[i])) {
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

.popup-image-container {
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    max-width: 100%;
    height: 100%;
    overflow: hidden;
}

.popup-image {
    object-fit: contain;
    height: auto;
    /* Why not use fit or cover?
     *
     * fit: The image will be distorted. i.e if it's a rectangular image, and
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
     * We want to use contain to avoid cropping the image.
     */
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
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

</style>
