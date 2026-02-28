import parseDOCX from "../parseDOCX.js";
import parsePPTX from "../parsePPTX.js";
import parseXLSX from "../parseXLSX.js";
import { parseODT, parseODP, parseODS } from "../parseODF.js";

import { readFileSync, writeFileSync } from "node:fs";

const handlers = {
  "docx": parseDOCX,
  "pptx": parsePPTX,
  "xlsx": parseXLSX,
  "odp": parseODP,
  "odt": parseODT,
  "ods": parseODS
};

const path = process.argv[2] || "";
const extension = path.split(".").at(-1);
const bytes = readFileSync(path);

handlers[extension](bytes).then(html => {
  const output = `<div style="width: 50%; margin-left: 25%">${html}</div>`;
  writeFileSync("output.html", output);
});
