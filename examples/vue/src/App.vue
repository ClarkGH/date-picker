<script setup>
import { ref } from 'vue';

const value = ref('');
const count = ref(0);
const last = ref('');
const submitted = ref('');

function onChange(e) {
  value.value = e.detail.value;
  count.value += 1;
  last.value = e.detail.value;
}

function onSubmit(e) {
  submitted.value = JSON.stringify(Object.fromEntries(new FormData(e.target)));
}
</script>

<template>
  <main>
    <form id="form" @submit.prevent="onSubmit">
      <consistent-date-picker id="picker" name="when" label="Meeting date" required
        :selectedDate="value" @change="onChange" />
      <button type="submit">Submit</button>
    </form>
    <button id="set-outside" type="button" @click="value = '4/3/2023'">Set from outside</button>
    <output id="changes">count: {{ count }}, last: {{ last }}</output>
    <pre id="submitted">{{ submitted }}</pre>
  </main>
</template>
