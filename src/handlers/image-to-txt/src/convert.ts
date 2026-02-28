import type { Image, Character } from "./types.ts";
import { FONT } from "./generated.ts";

/// Euclidean distance squared
function distSquared(a: number[], b: number[]): number {
	return a.reduce((acc, x, i) => acc+(x-b[i])**2, 0);
}

/// Shape positions
export const SHAPE_POSITIONS: [number, number][] = [
	[0/2, 0/3],
	[1/2, 0/3],
	[0/2, 1/3],
	[1/2, 1/3],
	[0/2, 2/3],
	[1/2, 2/3]
];

/// Converts rgb to grayscale if needed
export function rgbaToGrayscale(r: number, g: number, b: number, a: number): number {
	// https://www.grayscaleimage.com/three-algorithms-for-converting-color-to-grayscale/
	return 0.299*(r*a) + 0.587*(g*a) + 0.114*(b*a);
}

/// Converts an image to text
export function imageToText(image: Image, cellWidth: number = 16, cellHeight: number = 24): string {
	const [width, height] = [image.width(), image.height()];
	function averageInRegion(startx: number, starty: number, width: number, height: number): number {
		let avg = 0;
		let n = 0;
		for(let x = startx; x < startx+width; x++) {
			for(let y = starty; y < starty+height; y++) {
				const pixel = image.getPixel(x, y) ?? 0;
				avg += pixel;
				n++;
			}
		}
		return avg/n;
	}
	let ret = "";
	for(let cellY = 0; cellY < Math.ceil(height/cellHeight); cellY++) {
		for(let cellX = 0; cellX < Math.ceil(width/cellWidth); cellX++) {
			const pixels = SHAPE_POSITIONS.map(([posX, posY]) => averageInRegion(Math.floor((cellX+posX)*cellWidth), Math.floor((cellY+posY)*cellHeight), Math.floor(cellWidth/2), Math.floor(cellHeight/3)));
			// find best character
			let min = Infinity;
			let best = FONT[0];
			for(const ch of FONT) {
				const dist = distSquared(ch.shape, pixels);
				if(dist < min) {
					min = dist;
					best = ch;
				}
			}
			ret += best.text;
		}
		ret += "\n";
	}
	return ret;
}
