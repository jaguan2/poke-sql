import kanto from "./kanto-tracks.json" with { type: "json" };
import hoenn from "./hoenn-tracks.json" with { type: "json" };
import johto from "./johto-tracks.json" with { type: "json" };

export interface MusicTrack {
  id: string; title: string; theme: string; artist: string; file: string; source: string;
  provider: string; creditUrl: string; nativeMusic: string; region: string;
}
export const MUSIC_TRACKS: readonly MusicTrack[] = [
  ...kanto.map(track => ({ ...track, region: "Kanto", provider: "FireRed / LeafGreen soundtrack", creditUrl: track.source })),
  ...hoenn.map(track => ({ ...track, region: "Hoenn", provider: "Ruby / Sapphire / Emerald soundtrack", creditUrl: "https://www.zophar.net/music/gameboy-advance-gsf/pokemon-sapphire" })),
  ...johto.map(track => ({ ...track, region: "Johto", provider: "Gold / Silver / Crystal soundtrack", creditUrl: "https://www.zophar.net/music/gameboy-gbs/pokemon-gold" })),
];
export const areaTrack = (nativeMusic: string | undefined): MusicTrack | undefined =>
  nativeMusic ? MUSIC_TRACKS.find(track => track.nativeMusic === nativeMusic) : undefined;
