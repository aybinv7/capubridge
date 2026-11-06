/**
 * Measured input-token costs, per model, written by
 * `vp run desktop#bench:decisions -- --calibrate`. Only our own measurements
 * belong here: a model without an entry never receives an image, because its
 * delivery could not be verified.
 */
export interface ImageTokenCalibration {
  textTokensPerChar: number;
  imageTokensBase: number;
  imageTokensPerMegapixel: number;
  measuredOn: string;
}

export const IMAGE_TOKEN_CALIBRATION: Readonly<Record<string, ImageTokenCalibration>> = {};
