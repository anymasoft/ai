from pathlib import Path
text = Path('packages/api/dist/index.js.map').read_text(encoding='utf-8')
needle='getAdminId'
idx=text.find(needle)
print(idx)
print(text[idx-200:idx+200])
