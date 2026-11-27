<!--
  Never rendered: vue-tsc checks it (pnpm typecheck), vite build never imports it.
  Each @vue-expect-error line must be an error, or vue-tsc fails, so the types can't go loose.
-->
<script setup lang="ts">
function save(value: string) {
  return value;
}
</script>

<template>
  <consistent-date-picker selectedDate="04/03/2023" label="Start" name="start" required @change="(e) => save(e.detail.value)" />

  <!-- @vue-expect-error a misspelled prop -->
  <consistent-date-picker selectedDat="04/03/2023" />

  <!-- @vue-expect-error selectedDate is a string -->
  <consistent-date-picker :selectedDate="20230403" />

  <!-- @vue-expect-error detail.value is a string, not a number -->
  <consistent-date-picker @change="(e) => e.detail.value.toFixed()" />
</template>
