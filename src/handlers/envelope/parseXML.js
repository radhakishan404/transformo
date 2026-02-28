const parseXML = (xml) => {

  const tags = xml
    .replaceAll("<", ">")
    .split(">")
    .map(c => c.trim().length === 0 ? "" : c);

  const stack = [{ _children: [] }];

  for (let i = 0; i < tags.length; i ++) {

    let tag = tags[i];

    let closeImmediately = false;
    if (tag.endsWith("/")) {
      tag = tag.slice(0, -1);
      closeImmediately = true;
    }

    const isLabel = i % 2;
    const values = tag
      .split('"')
      .map((c, i) => {
        return i % 2 ? c :
        (c.replaceAll("\n", " ")
          .replaceAll("\t", " ")
          .split(" ")
          .filter(c => c.length !== 0));
      }).flat();

    if (isLabel && values[0].startsWith("?")) continue;

    if (isLabel && values[0].startsWith("/")) {
      stack.pop();
      continue;
    }

    const stackLast = stack.at(-1);

    if (isLabel) {

      const obj = { _tag: values[0], _children: [] };
      stack.push(obj);
      stackLast._children.push(obj);

      for (let j = 1; j < values.length - 1; j += 2) {
        const property = values[j].split("=")[0].trim();
        const value = values[j + 1];
        obj[property] = value;
      }

      if (closeImmediately) {
        stack.pop();
        continue;
      }

    } else if (tag) {
      stackLast._children.push(tag);
    }

  }

  if (stack.length !== 1) {
    console.warn(`Abnormal XML stack length (is ${stack.length}, should be 1)`);
  }

  return stack[0]._children;

};

export default parseXML;
