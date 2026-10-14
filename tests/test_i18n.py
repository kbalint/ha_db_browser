"""Backend and HA setup translation coverage."""
import importlib
import json
from pathlib import Path
import sys
import types
import unittest

ROOT = Path(__file__).resolve().parents[1]
pkg = sys.modules.setdefault("explorer_test", types.ModuleType("explorer_test"))
pkg.__path__ = [str(ROOT / "custom_components" / "ha_adatterkep")]
i18n = importlib.import_module("explorer_test.i18n")


class TranslationTests(unittest.TestCase):
    def test_all_backend_messages_have_all_three_translations(self):
        for lang in ("en", "hu", "de"):
            self.assertEqual(set(i18n.MESSAGES[lang]), set(i18n.MESSAGES["en"]))
            self.assertTrue(all(v.strip() for v in i18n.MESSAGES[lang].values()))

    def test_region_and_english_fallback(self):
        for value, expected in (("hu-HU", "hu"), ("de_AT", "de"), ("en-GB", "en"), ("fr", "en"), (None, "en")):
            self.assertEqual(i18n.normalize_language(value), expected)
        self.assertIn("busy", i18n.translate("db_busy", "fr"))
        self.assertIn("belegt", i18n.translate("db_busy", "de"))
        self.assertIn("foglalt", i18n.translate("db_busy", "hu"))

    def test_scan_status_is_localized_without_mutating_cache(self):
        original = {"error": "English", "errorCode": "db_busy", "running": False}
        translated = i18n.localized_status(original, "de")
        self.assertIn("belegt", translated["error"])
        self.assertEqual(original["error"], "English")

    def test_ha_setup_strings_are_english_and_translation_keys_match(self):
        base = ROOT / "custom_components" / "ha_adatterkep"
        english = json.loads((base / "strings.json").read_text(encoding="utf-8"))
        def keys(value, prefix=""):
            return {prefix + k for k, v in value.items() if not isinstance(v, dict)} | set().union(*(keys(v, prefix+k+".") for k, v in value.items() if isinstance(v, dict)))
        for lang in ("en", "hu", "de"):
            translated = json.loads((base / "translations" / f"{lang}.json").read_text(encoding="utf-8"))
            self.assertEqual(keys(english), keys(translated))
            self.assertEqual(translated["title"], "HA DB browser")
            if lang == "en":
                self.assertEqual(english, translated)
        self.assertIn("Reads the current", english["config"]["step"]["user"]["description"])


if __name__ == "__main__":
    unittest.main()
