//! Simple deno-based app to imageToText an image

import { Image } from "jsr:@cross/image";
import { imageToText, rgbaToGrayscale } from "./convert.ts";

if(Deno.args.length != 1) {
	console.log("Usage: image-to-txt <image file>");
}
const image = await Image.decode(await Deno.readFile(Deno.args[0]));
console.log(imageToText({
	width() { return image.width; },
	height() { return image.height; },
	getPixel(x: number, y: number) {
		const pixel = image.getPixel(x, y);
		if(pixel == undefined)
			return undefined;
		return rgbaToGrayscale(pixel.r/255, pixel.g/255, pixel.b/255, pixel.a/255);
	}
}));

