import lunr from 'lunr';
import Markdownit from 'markdown-it';
import {HTMLTokenizer} from '~/utils/lunr';

type Document = {
  _id: string;
  slug: string;
  Title: string;
  body: string;
};

type Meta = {
  href: string;
  title: string;
  body: string;
  type: string;
};

type DocumentToParse = {
  id: string;
  title: string;
  body: string;
}

type PreparedDocument = {
  locale: string;
  document: DocumentToParse,
  meta: Meta
};

function generateHash(header:string) {
  return String(header)
    .replace(/#/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z\-]/g, '-');
}
export default defineEventHandler(async () => {
  // Документы и генерация взяты из доку lunr
  const docsForLunr: Document[] = [
    {
      '_id': '1',
      'slug': 'document-1',
      'Title': 'document one example',
      'body': `
text one
## text one header
text one body
## text one header two
second text one document
`
    },
    {
      '_id': '2',
      'slug': 'document-2',
      'Title': 'document two example',
      'body': `
text two
## text two header
text two body
`
    }
  ];

// Это скормим lunr
  const preparedDocs: PreparedDocument[] = [];
// Для превращения markdown в html используем markdown-it
  const md = new Markdownit({
    html: true
  });
// Тут заготавливаем массив для lunr
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
      let searchResult: RegExpExecArray = null;
      let start: number;
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

        const document: DocumentToParse = {
          id: id.join('-'), // получим либо id либо вид id-1
          title: header ? '': item.Title,
          body: body
        };

        // meta информация, поможет в результатах поиска получить доп инфу, ссылку, заголовок, содержимое в html(body).
        // body нужно, т.к. мы разбили контент по заголовкам
        const meta: Meta = {
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

  const documents: DocumentToParse[] = [];
  const metas = {};
  preparedDocs.forEach(({ document, meta }) => {
    documents.push(document);
    metas[document['id']] = meta;
  });

  HTMLTokenizer(lunr);
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

  return jsonIndex;
})