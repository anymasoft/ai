from pathlib import Path
root = Path('.')
for path in root.rglob('*'):
    if path.is_file():
        try:
            text = path.read_text(encoding='utf-8')
        except UnicodeDecodeError:
            continue
        if "require('~/" in text:
            for i,line in enumerate(text.splitlines(),1):
                if "require('~/" in line:
                    print(f"{path}:{i}:{line.strip()}")
