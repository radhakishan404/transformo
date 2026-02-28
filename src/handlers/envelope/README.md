## Envelope
Lightweight office document-to-HTML parser written in pure JavaScript. Compatible with both Microsoft and OpenDocument formats. Designed to run in a browser context out of the box.

Currently supports:
- [x] DOCX
- [x] PPTX _(partially)_
- [x] XLSX _(partially)_
- [x] ODT
- [x] ODP _(partially)_
- [x] ODS

Not planned:
- DOC
- PPT
- XLS

Known issues:
- Page/sheet/slide sizes aren't parsed. The output scales based on the browser's viewport.
- PPTX files currently only implement the bare minimum, and are thus missing support for most elements and most formatting details.
- XLSX files are missing (all?) formatting.
- ODP files inherit elements from ODT/ODS, but anything specific to presentations is likely missing.
- ODS files may be missing formatting in certain areas. This has to do with some kind of "default" cell styling that isn't being applied for now.

## Usage
```js
import parseDOCX from "./parseDOCX.js";
// OR: import { parseODT } from "../parseODF.js";

const getHTML = async (bytes) => {
  return await parseDOCX(bytes);
};

const bytes = u8array; // Uint8Array containing DOCX file data
getHTML(bytes); // Returns Promise to HTML string
```
See `test/test.js` for a practical example.

## Contributing
When submitting issues or pull requests, keep in mind that this project exists _primarily_ as a sister project under https://convert.to.it/, and _secondarily_ as a simple drop-in solution for document parsing on the web. That is to say, keep things lightweight and don't break compatibility with [p2r3/convert](https://github.com/p2r3/convert).
