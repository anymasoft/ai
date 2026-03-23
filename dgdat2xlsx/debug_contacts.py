#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Диагностический скрипт: анализ типов контактов в dgdat-файлах.
Показывает все типы контактов с примерами eaddr и eaddr_name.

Использование:
    python debug_contacts.py <файл.dgdat>
    python debug_contacts.py          # все .dgdat из DGDAT_DIR
"""

import os
import sys
from collections import defaultdict

# Импортируем парсер из convert.py
from convert import parse_dgdat, export_field, DGDAT_DIR


def analyze_contacts(filepath: str):
    """Анализирует все типы контактов в dgdat файле."""
    print(f"\n{'='*70}")
    print(f"Анализ: {filepath}")
    print(f"{'='*70}")

    dump, prop = parse_dgdat(filepath)
    print(f"Город: {prop.get('name', '?')}")

    # Данные контактов
    contact_type = dump.get("fil_contact_type", {})
    contact_eaddr = dump.get("fil_contact_eaddr", {})
    contact_eaddr_name = dump.get("fil_contact_eaddr_name", {})
    contact_phone = dump.get("fil_contact_phone", {})
    contact_comment = dump.get("fil_contact_comment", {})

    # Собираем статистику по типам
    type_stats = defaultdict(lambda: {
        "count": 0,
        "has_eaddr": 0,
        "has_eaddr_name": 0,
        "has_phone": 0,
        "has_comment": 0,
        "eaddr_examples": [],
        "eaddr_name_examples": [],
        "phone_examples": [],
        "comment_examples": [],
    })

    # Все ключи контактов
    all_keys = set(contact_type.keys())

    for key in sorted(all_keys):
        ctype_val = contact_type.get(key)
        if ctype_val is None:
            continue

        ctype = chr(ctype_val) if isinstance(ctype_val, int) else str(ctype_val)
        stats = type_stats[ctype]
        stats["count"] += 1

        eaddr = contact_eaddr.get(key, "")
        eaddr_name = contact_eaddr_name.get(key, "")
        phone = contact_phone.get(key, "")
        comment = contact_comment.get(key, "")

        if eaddr:
            stats["has_eaddr"] += 1
            if len(stats["eaddr_examples"]) < 5:
                stats["eaddr_examples"].append(str(eaddr)[:100])

        if eaddr_name:
            stats["has_eaddr_name"] += 1
            if len(stats["eaddr_name_examples"]) < 5:
                stats["eaddr_name_examples"].append(str(eaddr_name)[:100])

        if phone:
            stats["has_phone"] += 1
            if len(stats["phone_examples"]) < 3:
                stats["phone_examples"].append(str(phone)[:50])

        if comment:
            stats["has_comment"] += 1
            if len(stats["comment_examples"]) < 3:
                stats["comment_examples"].append(str(comment)[:100])

    # Вывод результатов
    print(f"\nВсего контактов: {len(all_keys)}")
    print(f"Уникальных типов: {len(type_stats)}")

    # Известные типы
    known_types = {
        'p': 'Phone',
        'f': 'Fax',
        'm': 'Email',
        'w': 'Website',
        't': 'Twitter',
        'v': 'VKontakte',
        'a': 'Facebook',
        'n': 'Instagram',
        's': 'Skype',
        'i': 'ICQ',
        'j': 'Jabber',
        'g': 'Telegram?',
        'e': 'Telegram?',
        'l': 'Link?',
    }

    for ctype in sorted(type_stats.keys()):
        stats = type_stats[ctype]
        label = known_types.get(ctype, '??? НЕИЗВЕСТНЫЙ')

        print(f"\n{'─'*60}")
        print(f"Тип: '{ctype}' (ord={ord(ctype)}) → {label}")
        print(f"  Кол-во: {stats['count']}")
        print(f"  С eaddr: {stats['has_eaddr']}")
        print(f"  С eaddr_name: {stats['has_eaddr_name']}")
        print(f"  С phone: {stats['has_phone']}")
        print(f"  С comment: {stats['has_comment']}")

        if stats["eaddr_examples"]:
            print(f"  Примеры eaddr:")
            for ex in stats["eaddr_examples"]:
                print(f"    → {ex}")

        if stats["eaddr_name_examples"]:
            print(f"  Примеры eaddr_name:")
            for ex in stats["eaddr_name_examples"]:
                print(f"    → {ex}")

        if stats["phone_examples"]:
            print(f"  Примеры phone:")
            for ex in stats["phone_examples"]:
                print(f"    → {ex}")

        if stats["comment_examples"]:
            print(f"  Примеры comment:")
            for ex in stats["comment_examples"]:
                print(f"    → {ex}")

    # Отдельный отчёт: что попадает в колонку "Сайт" сейчас
    print(f"\n{'='*70}")
    print("АНАЛИЗ: что сейчас попадает в колонку 'Сайт' (eaddr_name для всех типов)")
    print(f"{'='*70}")

    www_by_type = defaultdict(list)
    for key in sorted(all_keys):
        ctype_val = contact_type.get(key)
        if ctype_val is None:
            continue
        ctype = chr(ctype_val) if isinstance(ctype_val, int) else str(ctype_val)
        eaddr_name = contact_eaddr_name.get(key, "")
        if eaddr_name:
            www_by_type[ctype].append(str(eaddr_name)[:100])

    for ctype in sorted(www_by_type.keys()):
        examples = www_by_type[ctype]
        label = known_types.get(ctype, '???')
        # Показываем уникальные примеры
        unique_examples = list(set(examples))[:10]
        print(f"\n  Тип '{ctype}' ({label}): {len(examples)} значений eaddr_name")
        for ex in unique_examples:
            print(f"    → \"{ex}\"")

    # Отдельный отчёт: URL в eaddr по типам
    print(f"\n{'='*70}")
    print("АНАЛИЗ: что хранится в eaddr (URL) для каждого типа")
    print(f"{'='*70}")

    url_by_type = defaultdict(list)
    for key in sorted(all_keys):
        ctype_val = contact_type.get(key)
        if ctype_val is None:
            continue
        ctype = chr(ctype_val) if isinstance(ctype_val, int) else str(ctype_val)
        eaddr = contact_eaddr.get(key, "")
        if eaddr:
            url_by_type[ctype].append(str(eaddr)[:100])

    for ctype in sorted(url_by_type.keys()):
        examples = url_by_type[ctype]
        label = known_types.get(ctype, '???')
        unique_examples = list(set(examples))[:10]
        print(f"\n  Тип '{ctype}' ({label}): {len(examples)} значений eaddr")
        for ex in unique_examples:
            print(f"    → \"{ex}\"")


def main():
    if len(sys.argv) >= 2:
        filepath = sys.argv[1]
        if not os.path.exists(filepath):
            print(f"Файл не найден: {filepath}")
            sys.exit(1)
        analyze_contacts(filepath)
    else:
        if not os.path.isdir(DGDAT_DIR):
            print(f"Папка не найдена: {DGDAT_DIR}")
            print(f"Использование: python {os.path.basename(__file__)} <файл.dgdat>")
            sys.exit(1)

        dgdat_files = sorted(
            f for f in os.listdir(DGDAT_DIR) if f.lower().endswith('.dgdat')
        )
        if not dgdat_files:
            print(f"Нет .dgdat файлов в {DGDAT_DIR}")
            sys.exit(0)

        # Анализируем только первый файл для быстрого результата
        filepath = os.path.join(DGDAT_DIR, dgdat_files[0])
        print(f"Найдено файлов: {len(dgdat_files)}")
        print(f"Анализируем первый: {dgdat_files[0]}")
        analyze_contacts(filepath)

        if len(dgdat_files) > 1:
            print(f"\n\nДля анализа других файлов:")
            for f in dgdat_files[1:]:
                print(f"  python {os.path.basename(__file__)} {os.path.join(DGDAT_DIR, f)}")


if __name__ == "__main__":
    main()
