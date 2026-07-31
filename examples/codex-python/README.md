# Codex Python example

This folder contains a minimal Python example for the OpenAI Codex SDK.

## Install from the repository root

```bash
cd /Users/paaqoffice/Downloads/paaq-listening-platform
python3 -m pip install -r examples/codex-python/requirements.txt
```

## Run from the repository root

```bash
python3 examples/codex-python/quickstart.py --prompt "Explain this repository in three bullets."
```

You can also preview the prompt without contacting Codex:

```bash
python3 examples/codex-python/quickstart.py --dry-run
```

If you prefer to work inside the example folder directly, run:

```bash
cd examples/codex-python
python3 -m pip install -r requirements.txt
python3 quickstart.py --dry-run
```

The SDK reuses existing Codex authentication when it is already available. If you need to authenticate first, use one of the flows below.

### Browser login

```bash
python3 - <<'PY'
from openai_codex import Codex

with Codex() as codex:
    login = codex.login_chatgpt()
    print(login.auth_url)
    print(login.wait().success)
PY
```

### API key login

```bash
python3 - <<'PY'
from openai_codex import Codex

with Codex() as codex:
    codex.login_api_key("sk-...")
PY
```

After authentication succeeds, rerun the quickstart example.
