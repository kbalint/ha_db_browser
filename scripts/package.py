"""Allowlisted release archives; never include the recorder DB or local reports."""
import json
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parents[1]
component = ROOT / "custom_components" / "ha_adatterkep"
manifest = json.loads((component / "manifest.json").read_text())
version = manifest["version"]
out = ROOT / "releases"
out.mkdir(exist_ok=True)


def files(folder):
    return [p for p in folder.rglob("*") if p.is_file() and "__pycache__" not in p.parts and p.suffix not in {".pyc", ".db", ".sqlite"}]


runtime = files(component)
assert (component / "frontend" / "panel.js") in runtime
archive = out / f"ha-adatterkep-{version}.zip"
with ZipFile(archive, "w", ZIP_DEFLATED) as zipfile:
    for path in runtime + [ROOT / "README.md"]:
        zipfile.write(path, path.relative_to(ROOT).as_posix())
source = out / f"ha-adatterkep-{version}-source.zip"
with ZipFile(source, "w", ZIP_DEFLATED) as zipfile:
    selected = runtime + files(ROOT / "src") + files(ROOT / "scripts") + files(ROOT / "tests")
    selected += [ROOT / f for f in ["README.md", "hacs.json", "package.json", "package-lock.json", "build.cjs", "server.cjs", "analyze.cjs", ".gitignore"]]
    for path in selected:
        zipfile.write(path, path.relative_to(ROOT).as_posix())
for path in [archive, source]:
    with ZipFile(path) as z:
        names = z.namelist()
        assert not any("home-assistant_v2" in n or n.startswith("data/") or "__pycache__" in n for n in names)
    print(path, path.stat().st_size, "bytes")
if "OWNER" in manifest["documentation"]:
    print("Local install ZIP ready. Before HACS publication configure the real repository URL/codeowner with scripts/configure-repository.cjs.")
