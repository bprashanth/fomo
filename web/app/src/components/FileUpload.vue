<!-- FileUpload.vue
  - This component handles exactly one excel file upload
  - This file can have multiple sheets

  @props: none
  @emits: fileParsed
    {
      sheetName1: [columnName1, columnName2, ...],
      sheetName2: [columnName1, columnName2, ...],
      ...
    }
  @TODO:
  - Handle multiple file uploads
  - Handle file upload errors
  - Handle file upload progress
  - Styling
-->
<template>
  <div class="file-upload">
    <label for="file-input">Upload Excel File:</label>
    <input type="file" id="file-input" @change="handleFileUpload">
  </div>
</template>

<script setup>

import * as XLSX from 'xlsx';
import { defineEmits } from 'vue';

const emit = defineEmits(['fileParsed']);

const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, {type: 'array'});
        const parsedData = {};

        workbook.SheetNames.forEach((sheetName) => {
          const sheetJson = XLSX.utils.sheet_to_json(
            workbook.Sheets[sheetName], {header: 1,});
          parsedData[sheetName] = sheetJson[0];
        })

        emit('fileParsed', parsedData);
    };
    reader.readAsArrayBuffer(file);
};

</script>
