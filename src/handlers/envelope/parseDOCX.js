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

const useProperty = (parent, path, found, notFound = null) => {
  const property = path.pop();
  const target = path.reduce(getChild, parent);
  if (target?.[property]) found(target[property]);
  else if (notFound) notFound();
};

const emuToPt = (emu) => {
  return Number((emu / 12700).toFixed(3));
};

const processParagraph = async (p, media, listLevel) => {

  let html = "";

  const pProperties = getChild(p, "w:pPr");

  let pTag = "p";
  let pStyle = "";
  let pText = "";

  // Set HTML tag to h* for "Heading" styles
  useProperty(pProperties, ["w:pStyle", "w:val"], (value) => {
    if (!value.startsWith("Heading")) return;
    pTag = "h" + value.slice(7);
  });
  // Translate text-align style
  useProperty(pProperties, ["w:jc", "w:val"], (direction) => {
    if (direction === "left") return;
    if (direction === "both") direction = "justify";
    pStyle += `text-align:${direction};`;
  });
  // Handle unordered list depth
  const numberingId = getChild(getChild(pProperties, "w:numPr"), "w:numId")?.["w:val"];
  if (numberingId != 0) useProperty(pProperties, ["w:numPr", "w:ilvl", "w:val"], (level) => {
    if (isNaN(level)) return;
    level = Number(level);

    if (level > listLevel) {
      for (let i = listLevel; i < level; i ++) html += "<ul>";
    } else {
      for (let i = level; i < listLevel; i ++) html += "</ul>";
    }

    pTag = "li";
    listLevel = level;
  }, () => {
    for (let i = -1; i < listLevel; i ++) html += "</ul>";
    listLevel = -1;
  });

  for (const r of p._children.filter(c => c._tag === "w:r")) {

    // Handle images
    await new Promise((resolve, reject) => {
      useProperty(r, ["w:drawing", "wp:anchor", "a:graphic", "a:graphicData", "pic:pic", "pic:blipFill", "a:blip", "r:embed"], async (embed) => {
        try {
          const target = media.rels.find(c => c.Id === embed)?.Target;
          if (!target) return resolve();

          let width = "100%", height = "100%";
          useProperty(r, ["w:drawing", "wp:anchor", "wp:extent", "cx"], (cx) => width = emuToPt(cx) + "pt");
          useProperty(r, ["w:drawing", "wp:anchor", "wp:extent", "cy"], (cy) => height = emuToPt(cy) + "pt");

          const path = "word/" + target;
          const base64 = media.zip.extractBase64(path);
          const mime = media.types.find(c => c.PartName === "/" + path)?.ContentType;
          html += `<img src="data:${mime};base64,${base64}" style="width:${width};height:${height}"></img>`;
        } finally {
          resolve();
        }
      }, resolve);
    });

    const rText = getText(getChild(r, "w:t"));
    const rProperties = getChild(r, "w:rPr");

    let rStyle = "";

    let tmp;
    const format = {
      bold: (tmp = getChild(rProperties, "w:b")) && tmp["w:val"] !== "false",
      italic: (tmp = getChild(rProperties, "w:i")) && tmp["w:val"] !== "false",
      under: (tmp = getChild(rProperties, "w:u")) && tmp["w:val"] !== "false",
      strike: (tmp = getChild(rProperties, "w:strike")) && tmp["w:val"] !== "false"
    };

    useProperty(rProperties, ["w:color", "w:val"], (val) => rStyle += `color:#${val};`);
    useProperty(rProperties, ["w:shd", "w:fill"], (val) => rStyle += `background:#${val};`);
    useProperty(rProperties, ["w:sz", "w:val"], (val) => rStyle += `font-size:${Number(val) / 2}pt;`);
    useProperty(rProperties, ["w:rFonts", "w:ascii"], (val) => rStyle += `font-family:'${val}';`);

    if (format.bold) pText += "<b>";
    if (format.italic) pText += "<i>";
    if (format.under) pText += "<u>";
    if (format.strike) pText += "<s>";

    if (rStyle) {
      pText += `<span style="${rStyle}">${rText}</span>`;
    } else {
      pText += rText;
    }

    if (format.bold) pText += "</b>";
    if (format.italic) pText += "</i>";
    if (format.under) pText += "</u>";
    if (format.strike) pText += "</s>";

  }

  html += `<${pTag}${pStyle ? ` style="${pStyle}"` : ""}>${pText}</${pTag}>`;
  return { html, listLevel };

}

const processTable = async (table, media, listLevel) => {

  let html = "<table style='width:100%;border-collapse:collapse'>";

  const rows = table._children.filter(c => c._tag === "w:tr");
  for (const row of rows) {
    html += "<tr>";

    const columns = row._children.filter(c => c._tag === "w:tc");
    for (const column of columns) {
      html += "<td style='border:1px solid black'>";

      const paragraph = getChild(column, "w:p");
      const pOutput = await processParagraph(paragraph, media, listLevel);
      html += pOutput.html;
      listLevel = pOutput.listLevel;

      html += "</td>";
    }

    html += "</tr>";
  }

  html += "</table>";
  return { html, listLevel };

}

const parseDOCX = async (bytes) => {

  const zip = new ZIPExtractor(bytes);

  const documentXML = zip.extractText("word/document.xml");
  const relationshipsXML = zip.extractText("word/_rels/document.xml.rels");
  const contentTypesXML = zip.extractText("[Content_Types].xml");

  const doc = parseXML(documentXML);
  const media = {
    rels: parseXML(relationshipsXML)[0]._children,
    types: parseXML(contentTypesXML)[0]._children.filter(c => c._tag === "Override"),
    zip
  };

  let listLevel = -1;
  let outputHTML = "";

  const elements = doc[0]._children[0]._children;
  for (const element of elements) {

    switch (element._tag) {
      case "w:tbl": {
        const output = await processTable(element, media, listLevel);
        outputHTML += output.html;
        listLevel = output.listLevel;
        break;
      }

      case "w:p": {
        const output = await processParagraph(element, media, listLevel);
        outputHTML += output.html;
        listLevel = output.listLevel;
        break;
      }

      default: break;
    }

  }

  return outputHTML;

};

export default parseDOCX;
