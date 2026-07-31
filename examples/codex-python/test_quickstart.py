import importlib.util
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parent
MODULE_PATH = ROOT / "quickstart.py"

spec = importlib.util.spec_from_file_location("quickstart_example", MODULE_PATH)
quickstart = importlib.util.module_from_spec(spec)
spec.loader.exec_module(quickstart)


class QuickstartCliTests(unittest.TestCase):
    def test_parser_supports_auth_flags(self) -> None:
        parser = quickstart.build_parser()
        args = parser.parse_args(["--api-key", "sk-test", "--auth-only"])

        self.assertEqual(args.api_key, "sk-test")
        self.assertTrue(args.auth_only)


if __name__ == "__main__":
    unittest.main()
