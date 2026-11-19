"""Vendor pinned trainer art and update bundled asset hashes."""
import hashlib
import json
from PIL import Image

from safari_sources import ROOT, source


def build_trainers(output):
    profiles = json.loads((ROOT / "web/src/shared/trainer/profiles.json").read_text(encoding="utf-8"))
    output.mkdir(parents=True, exist_ok=True)
    generated = []
    for profile in profiles.values():
        for pose in ("walking", "battle", "portrait"):
            asset = profile[pose]
            original = source(asset["source"], archive=profile["archive"])
            image = Image.open(original)
            if pose == "walking" and "transparency" not in image.info:
                image.save(output / asset["file"], transparency=0)
            else:
                (output / asset["file"]).write_bytes(original.read_bytes())
            generated.append(asset["file"])
    return generated


if __name__ == "__main__":
    output = ROOT / "web/public/safari"
    generated = build_trainers(output)
    path = ROOT / "web/src/features/safari/assets.json"
    metadata = json.loads(path.read_text(encoding="utf-8"))
    assets = {entry["file"]: entry for entry in metadata["assets"]}
    for file in generated:
        assets[file] = {"file": file, "sha256": hashlib.sha256((output / file).read_bytes()).hexdigest()}
    metadata["assets"] = list(assets.values())
    path.write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
    print(f"Vendored {len(generated)} trainer sheets; other Safari assets are unchanged.")
