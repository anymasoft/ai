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

    Args:
        text: Текст сообщения
        filter_config: Конфигурация фильтра из load_active_filter()
        legacy_keywords: Список ключевых слов из таблицы Keyword (нижний регистр)

    Returns:
        True если сообщение должно быть опубликовано, иначе False
    """
    normalized_text = normalize_text(text)
    mode = filter_config.get("mode", "keyword_or")

    if mode == "keyword_or":
        # Режим ключевых слов (OR): публикуем если хотя бы одно ключевое слово есть в тексте
        return any(kw.lower() in normalized_text for kw in legacy_keywords)

    # Режим "advanced"
    exclude_any = filter_config.get("exclude_any", [])
    require_all = filter_config.get("require_all", [])
    include_any = filter_config.get("include_any", [])

    logger.debug(f"📊 Match check - exclude={exclude_any}, require={require_all}, include={include_any}")

    # 1. Если есть исключаемое слово - не публикуем
    if any(exc in normalized_text for exc in exclude_any):
        logger.debug(f"❌ Found exclude word in text")
        return False

    # 2. Если есть требуемые слова - проверяем все ли присутствуют
    if require_all and not all(req in normalized_text for req in require_all):
        logger.debug(f"❌ Not all require words found. require={require_all}, text_sample={normalized_text[:100]}")
        return False

    # 3. Если нет include слов - публикуем (были выполнены все остальные условия)
    if not include_any:
        logger.debug(f"✅ No include words - publishing")
        return True

    # 4. Если есть include слова - публикуем если хотя бы одно есть
    result = any(inc in normalized_text for inc in include_any)
    logger.debug(f"{'✅' if result else '❌'} Include check result={result}")
    return result
