"""Generate original short Safari notification tones."""
from math import pi, sin
from pathlib import Path
from struct import pack
import wave

OUTPUT = Path(__file__).resolve().parents[1] / "web/public/safari/sounds"
RATE = 16000

if __name__ == "__main__":
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for name, notes in {"encounter": (440, 587), "caught": (523, 659, 784)}.items():
        with wave.open(str(OUTPUT / f"{name}.wav"), "wb") as audio:
            audio.setparams((1, 2, RATE, 0, "NONE", "not compressed"))
            for frequency in notes:
                count = RATE // 12
                audio.writeframes(b"".join(pack("<h", int(3500 * sin(2 * pi * frequency * i / RATE)
                                                           * sin(pi * i / count))) for i in range(count)))
