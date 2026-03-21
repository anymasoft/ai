#!/bin/bash
# Примеры использования search_2gis.py

echo "======================================================================="
echo "ПРИМЕРЫ ИСПОЛЬЗОВАНИЯ search_2gis.py"
echo "======================================================================="

# Пример 1: Поиск автомоек в Иркутске
echo ""
echo "Пример 1: Автомойки в Иркутске"
echo "---"
echo "echo 'автомойки в иркутске' > query.txt"
echo "python search_2gis.py"
echo ""

# Пример 2: Поиск стоматологий в Челябинске
echo "Пример 2: Стоматологии в Челябинске"
echo "---"
echo "echo 'стоматологии в челябинске' > query.txt"
echo "python search_2gis.py"
echo ""

# Пример 3: Поиск салонов красоты в Москве
echo "Пример 3: Салоны красоты в Москве"
echo "---"
echo "echo 'салоны красоты в москве' > query.txt"
echo "python search_2gis.py"
echo ""

# Пример 4: Поиск кафе в Санкт-Петербурге
echo "Пример 4: Кафе в Санкт-Петербурге"
echo "---"
echo "echo 'кафе в санкт-петербурге' > query.txt"
echo "python search_2gis.py"
echo ""

# Пример 5: Поиск клиник в Екатеринбурге
echo "Пример 5: Клиники в Екатеринбурге"
echo "---"
echo "echo 'клиники в екатеринбурге' > query.txt"
echo "python search_2gis.py"
echo ""

echo "======================================================================="
echo "КОМБИНИРОВАННЫЕ ПРИМЕРЫ"
echo "======================================================================="

# Комбо 1: Поиск через DuckDuckGo + 2GIS
echo ""
echo "Комбо 1: Поиск через DuckDuckGo (сайты) + 2GIS (контакты)"
echo "---"
echo "# Этап 1: Поиск сайтов"
echo "echo 'парикмахерские в новосибирске' > query.txt"
echo "python search_duckduckgo.py"
echo ""
echo "# Этап 2: Поиск контактов"
echo "python search_2gis.py"
echo "# → results.csv с именами, адресами, телефонами"
echo ""

echo "======================================================================="
echo "BATCH ОБРАБОТКА НЕСКОЛЬКИХ ГОРОДОВ"
echo "======================================================================="

echo ""
echo "#!/bin/bash"
echo "# Цикл по нескольким городам"
echo ""
echo "CITIES=('москве' 'санкт-петербурге' 'новосибирске' 'екатеринбурге')"
echo "NICHE='кофейни'"
echo ""
echo "for city in \"\${CITIES[@]}\"; do"
echo "  echo \"$NICHE в \$city\" > query.txt"
echo "  python search_2gis.py"
echo "  mv results.csv \"results_\$city.csv\""
echo "done"
echo ""

echo "======================================================================="
echo "ТРЕБУЕМАЯ ПОДГОТОВКА"
echo "======================================================================="
echo ""
echo "1. Установить зависимости:"
echo "   pip install pymorphy2 python-Levenshtein iuliia parser-2gis"
echo ""
echo "2. Скачать russia-cities.json:"
echo "   curl -o russia-cities.json https://raw.githubusercontent.com/arbaev/russia-cities/master/cities.json"
echo ""
echo "3. Убедиться что Chrome/Chromium установлен:"
echo "   which chromium-browser  # или which google-chrome"
echo ""

echo "======================================================================="
echo "Для подробной информации смотри: README_2GIS.md и PARSER_2GIS_DOCS.md"
echo "======================================================================="
