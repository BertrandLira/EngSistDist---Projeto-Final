"""
Configuração de testes: adiciona o diretório raiz do worker ao sys.path
e mocka dependências nativas não instaladas no ambiente de testes (psycopg2, pika, etc.)
"""
import sys
import os
from unittest.mock import MagicMock

# Garante que `python-worker/` está no path, não apenas `python-worker/tests/`
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

# Mocka módulos de infraestrutura que não estão instalados no ambiente de testes local
_MOCK_MODULES = [
    "psycopg2",
    "psycopg2.extras",
    "pika",
    "pika.exceptions",
    "faster_whisper",
]

for _mod in _MOCK_MODULES:
    if _mod not in sys.modules:
        sys.modules[_mod] = MagicMock()
