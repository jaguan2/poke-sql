"""Vendor FireRed's closed backpack frame for the Bag and navigation icon."""
import hashlib
import json
from PIL import Image
from safari_sources import ROOT, source


def build_bag(output):
    original = source("graphics/interface/bag_male.png", "firered")
    image = Image.open(original)
    if image.size != (64, 256):
        raise ValueError(f"Unexpected FireRed Bag sheet dimensions: {image.size}")
    output.mkdir(parents=True, exist_ok=True)
    image.crop((0, 0, 64, 64)).convert("RGBA").save(output / "bag.png")
    return "bag.png"


if __name__ == "__main__":
    output = ROOT / "web/public/safari"
    file = build_bag(output)
    path = ROOT / "web/src/features/safari/assets.json"
    metadata = json.loads(path.read_text(encoding="utf-8"))
    assets = {entry["file"]: entry for entry in metadata["assets"]}
    assets[file] = {"file": file, "sha256": hashlib.sha256((output / file).read_bytes()).hexdigest()}
    metadata["assets"] = list(assets.values())
    path.write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
    print("Vendored the pinned FireRed Bag frame; other Safari assets are unchanged.")
