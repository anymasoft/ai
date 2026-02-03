"""
JobRadar v0 - Движок фильтрации сообщений (include/require/exclude)
"""
import logging
from sqlalchemy.orm import Session
from models import FilterRule, FilterTerm

logger = logging.getLogger(__name__)


def init_keyword_filter(db: Session) -> None:
    """
    Создаёт Keywords правило (OR режим) при первом запуске, если filter_rules пуста
    Также обновляет старые записи с "Legacy keywords" на "Keywords"

    Создаёт одну запись:
    - name="Keywords"
    - mode="keyword_or"
    - enabled=True

    Без добавления термов
    """
    existing_rules = db.query(FilterRule).first()
    if not existing_rules:
        keyword_rule = FilterRule(
            name="Keywords",
            mode="keyword_or",
            enabled=True
        )
        db.add(keyword_rule)
        db.commit()
        logger.info("✅ Создано правило фильтрации Keywords (OR режим)")
    else:
        # Обновляем старые записи с "Legacy keywords" на "Keywords"
        old_rules = db.query(FilterRule).filter(FilterRule.name == "Legacy keywords").all()
        for rule in old_rules:
            rule.name = "Keywords"

        # Обновляем mode с "legacy_or" на "keyword_or"
        legacy_mode_rules = db.query(FilterRule).filter(FilterRule.mode == "legacy_or").all()
        for rule in legacy_mode_rules:
            rule.mode = "keyword_or"

        if old_rules or legacy_mode_rules:
            db.commit()
            logger.info(f"✅ Обновлено старых правил: name={len(old_rules)}, mode={len(legacy_mode_rules)}")


def normalize_text(text: str) -> str:
    """
    Нормализует текст: lowercase + collapse spaces
    """
    if not text:
        return ""
    return " ".join(text.lower().split())


def load_active_filter(db: Session) -> dict:
    """
    Загружает активное правило фильтрации из БД

    Возвращает dict:
    {
        "mode": "keyword_or" или "advanced",
        "include_any": [],
        "require_all": [],
        "exclude_any": []
    }

    Если активного правила нет - возвращает mode="keyword_or"
    """
    active_rule = db.query(FilterRule).filter(FilterRule.enabled == True).first()

    result = {
        "mode": "keyword_or",
        "include_any": [],
        "require_all": [],
        "exclude_any": []
    }

    if not active_rule:
        return result

    result["mode"] = active_rule.mode

    # Загружаем термины этого правила
    terms = db.query(FilterTerm).filter(
        FilterTerm.rule_id == active_rule.id,
        FilterTerm.enabled == True
    ).all()

    for term in terms:
        normalized_value = normalize_text(term.value)
        if term.term_type == "include":
            result["include_any"].append(normalized_value)
        elif term.term_type == "require":
            result["require_all"].append(normalized_value)
        elif term.term_type == "exclude":
            result["exclude_any"].append(normalized_value)

    logger.debug(
        f"Filter result: mode={result['mode']}, "
        f"include={len(result['include_any'])}, "
        f"require={len(result['require_all'])}, "
        f"exclude={len(result['exclude_any'])}"
    )

    return result


def match_text(text: str, filter_config: dict, legacy_keywords: list) -> bool:
    """
    Проверяет, соответствует ли текст правилам фильтрации

    Логика:
    - include_groups: OR между группами, AND внутри группы
      (python AND remote) OR (golang) OR (node AND backend)
    - exclude_groups: аналогично - если выполняется условие → исключить
    - legacy_keywords: не используются в новой системе

    Args:
        text: Текст сообщения
        filter_config: Конфигурация фильтра
        legacy_keywords: Не используется (для обратной совместимости)

    Returns:
        True если сообщение должно быть опубликовано, иначе False
    """
    normalized_text = normalize_text(text)

    # 1. Проверяем exclude_groups: если найдена ЛЮБАЯ группа где ВСЕ слова найдены → исключить
    exclude_groups = filter_config.get("exclude_groups", [])
    if exclude_groups:
        for group in exclude_groups:
            # Проверяем, все ли слова из группы найдены в тексте
            if all(word in normalized_text for word in group):
                logger.debug(f"❌ Found exclude group in text: {group}")
                return False

    # 2. Проверяем include_groups: если НЕТ группы где ВСЕ слова найдены → исключить
    include_groups = filter_config.get("include_groups", [])
    if include_groups:
        # Ищем хотя бы одну группу, где ВСЕ слова присутствуют
        found_match = False
        for group in include_groups:
            if all(word in normalized_text for word in group):
                logger.debug(f"✅ Found include group in text: {group}")
                found_match = True
                break

        if not found_match:
            logger.debug(f"❌ No include groups matched. groups={include_groups}")
            return False
    # else: если include_groups пусто = мониторим ВСЕ посты

    logger.debug(f"✅ Text passed all filters")
    return True
