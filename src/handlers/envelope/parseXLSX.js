import parseXML from "./parseXML.js";
import ZIPExtractor from "./extractZIP.js";

const getChild = (parent, tag) => {
  if (!parent) return parent;
  return parent._children.find(c => c._tag === tag);
};

const getText = (element) => {
  return element?._children
    ?.filter(c => typeof c === "string")
    .join("") || "";
};

const parseXLSX = async (bytes) => {

  const zip = new ZIPExtractor(bytes);

  const workbookXML = zip.extractText("xl/workbook.xml");
  const relationshipsXML = zip.extractText("xl/_rels/workbook.xml.rels");
  const contentTypesXML = zip.extractText("[Content_Types].xml");
  const sharedStringsXML = zip.extractText("xl/sharedStrings.xml");

  const workbook = parseXML(workbookXML);
  const media = {
    rels: parseXML(relationshipsXML)[0]._children,
    types: parseXML(contentTypesXML)[0]._children.filter(c => c._tag === "Override"),
    strings: parseXML(sharedStringsXML)[0]._children.map(c => getText(getChild(c, "t"))),
    zip
  };

  let outputHTML = "";

  const sheets = getChild(workbook[0], "sheets")._children;
  for (const sheet of sheets) {

    const rID = sheet["r:id"];
    if (!rID) continue;
    const relationship = media.rels.find(r => r["Id"] === rID);
    if (!relationship) continue;
    const target = relationship["Target"];
    if (!target) continue;

    outputHTML += `<table style="width:100%;border-collapse:collapse;margin-bottom:1em" border="1">`;

    const sheetXML = zip.extractText("xl/" + target);
    const sheetDoc = parseXML(sheetXML);

    const rows = getChild(sheetDoc[0], "sheetData")._children;
    for (const row of rows) {

      const height = row.ht;
      outputHTML += `<tr height="${height * 1.71875}px">`;

      const cells = row._children.filter(c => c._tag === "c");
      for (const cell of cells) {
        let value = getText(getChild(cell, "v"));
        const type = cell.t;
        if (type === "s") value = media.strings[parseInt(value)];
        if (!value) continue;
        outputHTML += `<td>${value}</td>`;
      }

      outputHTML += "</tr>";

    }

    outputHTML += "</table>";

  }

  return outputHTML;

};

export default parseXLSX;
