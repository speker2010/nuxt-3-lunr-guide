<template>
  <div>
    {{searchText}}
    <div>
        <input type="text" v-model="searchText">
    </div>
  </div>
  <div>
    <div v-if="results.length">
      <ul>
        <li v-for="result in results" :key="result.id">
          {{result}}
        </li>
      </ul>
    </div>
    <div v-else>
      <p>
        Нет результатов
      </p>
    </div>
  </div>
</template>

<script setup>
import lunr from 'lunr';

const results = ref([]);
const idx = ref(null);
const indexLoaded = ref(false);
const searchText = ref('');
watch(searchText, (search) => {
  if (idx.value && search) {
    results.value = idx.value.search(search);
  }
});

onMounted(async () => {
  try {
    const response = await fetch('/search.index.json');
    const data = await response.json();


    idx.value = lunr.Index.load(data);
    indexLoaded.value = true;

  } catch (e) {
    console.error(e);
  }
});

const onSearch = () => {
  console.log('search');
  if (idx.value && searchText.value) {
    results.value = idx.value.search(searchText.value);
  }
}
</script>