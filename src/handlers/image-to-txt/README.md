# PNG to TXT converter
Simple library to convert an image to a text file. Some techniques were borrowed
from [this article](https://alexharri.com/blog/ascii-rendering).

This was created for p2r3's [convert](https://github.com/p2r3/convert) but can
be used independently.

## Usage
### Application
To run the application, do:
```ts
deno run --allow-read src/app.ts <image name>
```
The text version is outputted to STDOUT.
### Library
This repository can be included as a git submodule or by other means, then:
```ts
import { imageToText } from "/path/to/image-to-txt/convert.ts";
const str = imageToText({
    width() { ... },
    height() { ... },
    getPixel(x: number, y: number) { ... }
})
// str contains the returned text
```

### Generating a font
A font atlas must be placed at `./assets/atlas.png`; this should be an image
containing all ASCII characters horizontally. This repository contains one by
default. Then, you should run `deno run src/generate.ts`; this will create
`src/generated.ts` which will contain the font data necessary for creating an
image.

## TODO
Needs to be optimized; performance is currently very bad.

Could implement better contrast as suggested by the linked blogpost.
