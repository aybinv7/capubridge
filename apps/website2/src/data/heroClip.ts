export interface HeroClip {
  webm: string;
  mp4: string;
  poster: string;
  /** Flip to true once the sanitized recording is in public/hero/. */
  ready: boolean;
  alt: string;
  caption: string;
}

export const heroClip: HeroClip = {
  webm: "/hero/attach-loop.webm",
  mp4: "/hero/attach-loop.mp4",
  poster: "/hero/attach-loop.jpg",
  ready: false,
  alt: "A phone being tapped on the left while storage rows, a request and a console line land on the right in the same moment",
  caption: "One tap on the device. Storage, network and console answer in the same frame.",
};
