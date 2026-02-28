import puppeteer from "puppeteer";

const rawBasePath = process.env.VITE_BASE_PATH || "/";
const BASE_PATH = rawBasePath.endsWith("/") ? rawBasePath : `${rawBasePath}/`;

const server = Bun.serve({
  async fetch (req) {
    const path = new URL(req.url).pathname.replace(BASE_PATH, "") || "index.html";
    const file = Bun.file(`${__dirname}/dist/${path}`.replaceAll("..", ""));
    if (!(await file.exists())) return new Response("Not Found", { status: 404 });
    return new Response(file);
  },
  port: 8080
});

const browser = await puppeteer.launch({
  headless: "new",
  args: ["--no-sandbox", "--disable-setuid-sandbox"]
});

const page = await browser.newPage();

await Promise.all([
  new Promise(resolve => {
    page.on("console", msg => {
      const text = msg.text();
      if (text === "Built initial format list.") resolve();
    });
  }),
  page.goto(`http://localhost:8080${BASE_PATH}index.html`)
]);

const cacheJSON = await page.evaluate(() => {
  return window.printSupportedFormatCache();
});
const outputPath = process.argv[2] || "cache.json";
await Bun.write(outputPath, cacheJSON);

await browser.close();
server.stop();
