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
