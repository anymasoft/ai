from pathlib import Path
for path in Path('.').rglob('*'):
    if path.is_file():
        try:
            text = path.read_text(encoding='utf-8')
        except UnicodeDecodeError:
            continue
        if 'getAdminId' in text:
            print(path)
