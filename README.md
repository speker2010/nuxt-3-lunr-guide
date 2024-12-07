# Гайд по lunr и nuxt 3
Я пробовал найти модуль поиска для nuxt 3, но те что я нашел были по сути адаптерами для сторонних сервисов.
Для nuxt 2 был модуль на базе lunr.js, но он несколько лет не обновлялся, да и когда я его пробовал использовать
у меня не вышло, пришлось часть функционала дописывать, чтобы заработало как мне надо.

В этом гайде я опишу как можно добавить lunr в проект nuxt 3. Работающие примеры можно найти в `/examples`
* простой пример `/examples/simple`
* пример с markdown и html `/examples/markdown`

Поиск будет состоять из нескольких частей
1. Роута, который формирует индексный файл для lunr
2. Конфига nuxt.config.ts
3. Страницы с поиском

## Конфиг и код роута
Файл `nuxt.config.ts` должен содержать следующий код
```javascript
export default defineNuxtConfig({
    nitro: {
        prerender: {
            routes: ['/search.index.json']
        }
    },
})
```

В этом конфиге мы говорим nitro что нам нужно при генерации создать роут `/search.index.json`.

Далее нам нужно установить lunr
```bash
npm install lunr
```

Чтобы роут появился в `/server/routes/search.index.json` добавляем следующий код
```javascript
import lunr from 'lunr';

export default defineEventHandler(async () => {
    // Документы и генерация взяты из доку lunr
    var documents = [{
        "name": "Lunr",
        "text": "Like Solr, but much smaller, and not as bright."
    }, {
        "name": "React",
        "text": "A JavaScript library for building user interfaces."
    }, {
        "name": "Lodash",
        "text": "A modern JavaScript utility library delivering modularity, performance & extras."
    }]

    var idx = lunr(function () {
        this.ref('name') // здесь мы задаем имя поля содержащего уникальную строку, например slug или id
        this.field('text')

        documents.forEach(function (doc) {
            this.add(doc)
        }, this)
    })
    
    return idx;
});
```

## Поиск
Теперь на странице, где нужен поиск мы добавляем следующее
```vue
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
```

Этот код при вводе текста в input будет запускать поиск через lunr с использованием файла
`/search.index.json`. В нашем случае в результатах поиска выводятся голые данные из lunr. 
Чтобы выводить конкретные записи, надо использовать `ref`. Ref это уникальный идентификатор.

Что брать за ref мы задали в `/server/routes/search.index.js`

В целом для примитивного поиска этого достаточно.

Но когда такое было чтобы что-то было примитивно? 😊.

Один из возможных сценариев это поиск по контенту оформленному в markdown, но при этом надо 
выводить в результатах поиска текст вокруг найденной строки.

Штош
## Поиск по markdown
Тут всё не просто.

Основная проблема в том что markdown, как правило, конвертируется в html, и соответственно, если
мы хотим отображать в результатах поиска подсвеченные результаты, то в lunr простой markdown мы передать не можем

Так же мы не можем скормить чистый html, нам нужно исключить из поиска разметку. Оставить только текст.

## Учим lunr понимать html
Чтобы lunr мог создать индекс по html разметке, нужно написать токенизатор(токенизер?)
```javascript
export let HTMLTokenizer = (lunr) => {
  const separator = lunr.tokenizer.separator;
  lunr.tokenizer = function (obj, metadata) {
    if (obj == null || obj == undefined) {
      return []
    }
    if (Array.isArray(obj)) {
      return obj.map(function (t) {
        return new lunr.Token(
          lunr.utils.asString(t).toLowerCase(),
          lunr.utils.clone(metadata)
        )
      })
    }
    var str = obj.toString().toLowerCase(),
      len = str.length,
      tokens = []
    for (var sliceEnd = 0, sliceStart = 0, mayBeTag = false, isTag = false; sliceEnd <= len; sliceEnd++) {
      var char = str.charAt(sliceEnd),
        sliceLength = sliceEnd - sliceStart
      if (isTag && char.match('>')) {
        mayBeTag = false;
        isTag = false;
        sliceStart = sliceEnd + 1;
        continue;
      }
      if (mayBeTag && isTag) continue;
      if (mayBeTag && !isTag && char.match(/[\/a-zA-Z!]/)) {
        isTag = true;
        continue;
      }
      if (!mayBeTag && char.match('<')) mayBeTag = true;
      if ((char.match(lunr.tokenizer.separator) || char.match('<') || sliceEnd == len)) {
        if (sliceLength > 0) {
          var tokenMetadata = lunr.utils.clone(metadata) || {}
          tokenMetadata["position"] = [sliceStart, sliceLength]
          tokenMetadata["index"] = tokens.length
          tokens.push(
            new lunr.Token (
              str.slice(sliceStart, sliceEnd),
              tokenMetadata
            )
          )
        }
        sliceStart = sliceEnd + 1
      }
    }
    // console.log(tokens.map(token => {
    //   return token.toString();
    // }).filter(token => token.match('table')))
    return tokens
  }
  lunr.tokenizer.separator = separator;
}
```

И везде где мы используем lunr, нужно будет вызывать эту функцию
```javascript
import lunr from 'lunr';

HTMLTokenizer(lunr);
//Далее идет код использующий lunr
```

Что делает код токенайзера я описывать не буду, это не просто. Может быть в следующий раз.

## Формируем индексный файл
В этот раз в индекс добавится мета информация. Так же парсинг сформирует индекс с учетом заголовков.
В результатах поиска мы сможем выводить ссылки вида `/document/slug#header-name`. Где `#header-name` это
якорь на соответствующий заголовок

```javascript
// Это скормим lun
docsForLunr.forEach(item => {
  const typeNames = {
    'Documentations': 'Documentation'
  };

  let increment = 0;
  parseItem();

  // Функция которая будет опбрабатывать аргумент item
  function parseItem() {

    // Регулярка для поиска заголовков в markdown. Считаем что заголовок только в начале строки
    const headerRegex = /(\r?\n|^)#+.*\r?\n/g;
    let searchResult = null;
    let start;
    // удаляем пустоту вокруг
    item.body = item.body.trim();
    let header = '';

    // нарезаем markdown до тех пор пока не закончатся заголовки
    while((searchResult = headerRegex.exec(item.body)) !== null) {
      if (typeof start === 'undefined') {
        const headerStart = headerRegex.lastIndex - searchResult[0].length;
        if (headerStart > 0) {
          pushWithoutHeader(item.body.slice(0, headerStart));
          start = headerStart;
        } else {
          start = 0;
          header = searchResult[0];
        }
        continue;
      }
      const last = headerRegex.lastIndex - searchResult[0].length;
      pushWithHeader(header, item.body.slice(start, last))
      start = last;
      header = searchResult[0];
    }
    pushWithHeader(header, item.body.slice(start, item.body.length));

    function generateURL () {
      // здесь мы генерируем ссылку, которую сможем выводить в результатах поиска
      const result = `/documentation/${item.slug}`;
      // если у блока есть заголовок, до ссылку будет с якорем
      if (header) {
        return `${result}/#${generateHash(header)}`;
      }
      return result;
    };

    function pushWithHeader (header: string, markdown: string) {
      // конвертируем markdown в html
      let body = md.render(markdown);

      // Создаем массив с одним элементом. Это id записи в cms, в нашем случае это была strapi
      const id = [item._id];

      // в случае если у нас есть заголовок, то добавляем число по возрастающей
      if (header) id.push(String(++increment));

      const document = {
        id: id.join('-'), // получим либо id либо вид id-1
        title: header ? '': item.Title,
        body: body
      };

      // meta информация, поможет в результатах поиска получить доп инфу, ссылку, заголовок, содержимое в html(body).
      // body нужно, т.к. мы разбили контент по заголовкам
      const meta = {
        href: generateURL(),
        title: `${item.Title}${header ? ' - ' + header.replace(/#/g, ''): ''}`,
        body: body,
        type: typeNames['Documentations'] // это можно будет увидеть в коде, который формирует индексный файл
      };

      // Пушимм в массив, который потом будет обрабатывать lunr
      preparedDocs.push(({
        locale: 'en',
        document,
        meta
      }));
    }

    function pushWithoutHeader(markdown: string) {
      pushWithHeader(undefined, markdown);
    }
  }
});

```

Что делает код я написал в комментариях. 
Далее нам нужно заготовленное выше превратить в индексный файл
```javascript
import lunr from 'lunr';
//HTMLTokenizer надо тоже импортировать
HTMLTokenizer(lunr);

const documents = [];
const metas = {};
preparedDocs.forEach(({ document, meta }) => {
  documents.push(document);
  metas[document['id']] = meta;
});

const idx = lunr(function () {
  this.ref('id');
  this.field('title');
  this.field('body');
  // this.stopdWordFilter = ['<table'];
  this.metadataWhitelist = ['position'];
  // idx init

  documents.forEach(doc => {
    this.add(doc);
  });
});
const jsonIndex = idx.toJSON();
jsonIndex.metas = metas;
// тут jsonIndex можно сохранять в файл
// На примере в начале гайда это может быть nitro
```

JSON для индексного файла готов.

## Страница поиска
```vue
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
  // подсвечивает текст в заголовках
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

  // подсвечивает текст в теле 
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
  /* стили чтобы подсветка работала */
  .search-text span {
  background: yellow;
}
</style>
```

В этом файле мы используем все что делали до этого. Lunr используется как плагин. Он берет индекс из роута `search.index.json`.
А Сама страница получает данные от lunr и делает подсветку найденных строк. В процессе написания статьи я заметил что ведет себя
подсветка не совсем верно, но основные моменты касательно поиска я описал. Работающий пример находится в папке `/example/markdown`
