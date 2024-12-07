<template>
  <div>
    <input type="text" v-model="q">

    <div v-if="q && result.length === 0">
      <span v-show="q">Sorry, no matches were found for your query.</span>
    </div>
    <div v-else>
      <div class="search-result-item search-result-wrapper" v-for="(item, indexResult) in result" :key="item.ref">
        <div v-if="metas[item.ref]">
          <div class="search-result-title__wrapper">
            <strong> {{ metas[item.ref].type }} - </strong>
            <NuxtLink
              class="search-result-title"
              :to="metas[item.ref].href"
              v-html="generateHightlightTitle(metas[item.ref].title, item)"
            >
            </NuxtLink>
          </div>
          <hr />
          <div v-for="(texts, index) in generateHightlightBody(metas[item.ref].body, item, indexResult)" :key="index">
            <div class="search-text" v-for="(text, index) in texts" v-html="text" :key="index"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
const q = ref('');
const result = ref([]);
const { $lunr } = useNuxtApp();
const metas = ref();

onMounted(async () => {
  metas.value = await $lunr.meta();
});

watch(q, async (search) => {
  console.log({search})
  if (search) {
    result.value = await $lunr.search(search);
    console.log(result.value)
  }
});
function generateHightlightTitle(title, result) {
  const positions = [];
  for (let field in result.matchData.metadata) {
    if (result.matchData.metadata[field].title) {
      positions.push(result.matchData.metadata[field].title.position);
    }
  }
  if (positions.length === 0) {
    return title;
  }
  const resultParts = [];
  const cutIntervals = [0];
  positions.forEach(positions => {
    positions.forEach(item => {
      const intervalsSumm = cutIntervals.reduce((oldV, newV) => oldV + newV);
      cutIntervals.push(item[0] - intervalsSumm);
      cutIntervals.push(item[1]);
    });
  });
  cutIntervals.push(title.length);
  cutIntervals.reduce((oldV, newV) => {
    const reduceResult = oldV + newV;
    resultParts.push(title.slice(oldV, reduceResult));
    return reduceResult;
  });
  const resultText = [];
  resultParts.forEach((part, index) => {
    if (index % 2) {
      resultText.push('<span>');
      resultText.push(part);
      resultText.push('</span>');
    } else {
      resultText.push(part);
    }
  });
  return resultText.join('');
};

function generateHightlightBody(body, result, index) {
  let positions = [];
  for (let field in result.matchData.metadata) {
    if (result.matchData.metadata[field].body) {
      positions.push(...result.matchData.metadata[field].body.position);
    }
  }
  positions = [...positions].sort((a, b) => {
    return a[0] - b[0];
  });
  const resultParts = [];
  let start = 0;
  positions.forEach(position => {
    if (start !== position[0]) resultParts.push(body.slice(start, position[0]));
    resultParts.push('<span>' + body.slice(position[0], position[0] + position[1]) + '</span>');
    start = position[0] + position[1];
  });
  return [[resultParts.join('')]];
  // return positions.map(positions => {
  //   return positions.map(item => {
  //     return this.highlightText(body, item);
  //   })
  // });
}
</script>

<style>
.search-text span {
  background: yellow;
}
</style>