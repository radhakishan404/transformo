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

const processParagraph = async (p, media, listLevel) => {

  let html = "";

  const pProperties = getChild(p, "a:pPr");

  let pTag = "p";
  let pStyle = "";
  let pText = "";

  // Set HTML tag to h* for "Heading" styles
  useProperty(pProperties, ["a:pStyle", "a:val"], (value) => {
    if (!value.startsWith("Heading")) return;
    pTag = "h" + value.slice(7);
  });
  // Translate text-align style
  useProperty(pProperties, ["a:jc", "a:val"], (direction) => {
    if (direction === "left") return;
    if (direction === "both") direction = "justify";
    pStyle += `text-align:${direction};`;
  });
  // Handle unordered list depth
  useProperty(pProperties, ["a:numPr", "a:ilvl", "a:val"], (level) => {
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

  for (const r of p._children.filter(c => c._tag === "a:r")) {

    // Handle images
    await new Promise((resolve, reject) => {
      useProperty(r, ["a:drawing", "wp:anchor", "a:graphic", "a:graphicData", "pic:pic", "pic:blipFill", "a:blip", "r:embed"], async (embed) => {
        try {
          const target = media.rels.find(c => c.Id === embed)?.Target;
          if (!target) return resolve();

          const path = "word/" + target;
          const base64 = media.zip.extractBase64(path);
          const mime = media.types.find(c => c.PartName === "/" + path)?.ContentType;
          html += `<img src="data:${mime};base64,${base64}" style="max-width:100%"></img>`;
        } finally {
          resolve();
        }
      }, resolve);
    });

    const rText = getText(getChild(r, "a:t"));
    const rProperties = getChild(r, "a:rPr");

    let rStyle = "";

    let tmp;
    const format = {
      bold: (tmp = getChild(rProperties, "a:b")) && tmp["a:val"] !== "false",
      italic: (tmp = getChild(rProperties, "a:i")) && tmp["a:val"] !== "false",
      under: (tmp = getChild(rProperties, "a:u")) && tmp["a:val"] !== "false",
      strike: (tmp = getChild(rProperties, "a:strike")) && tmp["a:val"] !== "false"
    };

    useProperty(rProperties, ["a:color", "a:val"], (val) => rStyle += `color:#${val};`);
    useProperty(rProperties, ["a:shd", "a:fill"], (val) => rStyle += `background:#${val};`);
    useProperty(rProperties, ["a:sz", "a:val"], (val) => rStyle += `font-size:${Number(val) / 2}pt;`);
    useProperty(rProperties, ["a:rFonts", "a:ascii"], (val) => rStyle += `font-family:'${val}';`);

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

  const rows = table._children.filter(c => c._tag === "a:tr");
  for (const row of rows) {
    html += "<tr>";

    const columns = row._children.filter(c => c._tag === "a:tc");
    for (const column of columns) {
      html += "<td style='border:1px solid black'>";

      const paragraph = getChild(column, "a:p");
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

const parsePPTX = async (bytes) => {

  const zip = new ZIPExtractor(bytes);

  const presentationXML = zip.extractText("ppt/presentation.xml");
  const relationshipsXML = zip.extractText("ppt/_rels/presentation.xml.rels");
  const contentTypesXML = zip.extractText("[Content_Types].xml");

  const ppt = parseXML(presentationXML);
  const media = {
    rels: parseXML(relationshipsXML)[0]._children,
    types: parseXML(contentTypesXML)[0]._children.filter(c => c._tag === "Override"),
    zip
  };

  let listLevel = -1;
  let outputHTML = `<style>.__page{position:relative;width:100%;aspect-ratio:16/9}</style>`;

  const slides = getChild(ppt[0], "p:sldIdLst")._children;
  for (const slide of slides) {

    const rID = slide["r:id"];
    if (!rID) continue;
    const relationship = media.rels.find(r => r["Id"] === rID);
    if (!relationship) continue;
    const target = relationship["Target"];
    if (!target) continue;

    const slideXML = zip.extractText("ppt/" + target);
    const slideDoc = parseXML(slideXML);

    outputHTML += `<div class="__page">`;
    const elements = slideDoc[0]._children[0]._children[0]._children
      .filter(c => c._tag === "p:sp")
      .map(c => getChild(c, "p:txBody")._children)
      .flat();
    for (const element of elements) {

      switch (element._tag) {
        case "a:tbl": {
          const output = await processTable(element, media, listLevel);
          outputHTML += output.html;
          listLevel = output.listLevel;
          break;
        }

        case "a:p": {
          const output = await processParagraph(element, media, listLevel);
          outputHTML += output.html;
          listLevel = output.listLevel;
          break;
        }

        default: break;
      }

    }
    outputHTML += `</div>`;

  }

  return outputHTML;

};

export default parsePPTX;
