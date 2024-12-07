import lunr from 'lunr';
import {HTMLTokenizer} from "~/utils/lunr";

export default defineNuxtPlugin(nuxtApp => {
  let idx;
  let indexJson;
  HTMLTokenizer(lunr);

  return {
    provide: {
      lunr: {
        async search(search) {
            if (!idx) {
                idx = lunr.Index.load(await this.getIndexJson());
            }
            return idx.search(search)
        },
        async meta() {
            const indexJson = await this.getIndexJson();

            return indexJson.metas;
        },
        async getIndexJson() {
            if (indexJson) {
                return indexJson
            }
            const response = await fetch('/search.index.json');
            indexJson = await response.json();
            return indexJson;
        }
    }
    }
  };
})