#!/bin/zsh
# دوس دبل كليك على الملف ده عشان تفتح الموقع
cd "$(dirname "$0")"
python3 tools/serve.py
