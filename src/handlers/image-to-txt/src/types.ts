//! Contains types used in this library

/// An ASCII character
export interface Character {
	/// Character text
	text: string;
	/// Character shape
	shape: number[];
}

/// A grayscale image
export interface Image {
	/// Returns the width of the image
	width(): number;
	/// Returns the height of the image
	height(): number;
	/// Returns the grayscale color at the given pixel, between 0 and 1.
	///
	/// Returns undefined if the indexes are out of bounds.
	getPixel(x: number, y: number): number | undefined;
}
