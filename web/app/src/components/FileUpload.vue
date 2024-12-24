<template>
  <div class="file-upload">
    <label for="file-input">Upload Excel File:</label>
    <input type="file" id="file-input" @change="handleFileUpload">
    <!-- Placeholder for file upload component -->
  </div>
</template>

<script setup>

import * as XLSX from 'xlsx';
import { defineEmits } from 'vue';

const emit = defineEmits(['fileLoaded']);

const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, {type: 'array'});
        const parsedData = {};
        workbook.SheetNames.forEach(sheetName => {
            const sheet = workbook.Sheets[sheetName];
            parsedData[sheetName] = XLSX.utils.sheet_to_json(sheet);
        });
        emit('fileLoaded', parsedData);
    };
    reader.readAsArrayBuffer(file);
};

</script> 