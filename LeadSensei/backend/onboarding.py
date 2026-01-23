import sqlite3
import json
import os

DATABASE_PATH = os.path.join(os.path.dirname(__file__), "../data/leadsensei.db")

NICHE_DATABASE = {
    "realty": {
        "keywords": ["купить квартиру", "аренда квартиры", "ищу риэлтора", "недвижимость москва", "продать дом"],
        "channels": ["t.me/realty_moscow", "t.me/arenda_msk", "t.me/domik_v_derevne"],
        "description": "Недвижимость: покупка, аренда, риэлторы"
    },
    "design": {
        "keywords": ["дизайн интерьера", "3d визуализация", "нужен дизайнер", "ремонт квартиры", "проект интерьера"],
        "channels": ["t.me/design_interior", "t.me/remont_kvartir", "t.me/3d_visualization"],
        "description": "Дизайн и ремонт"
    },
    "legal": {
        "keywords": ["юридические услуги", "ищу юриста", "консультация юриста", "договор", "арбитраж"],
        "channels": ["t.me/legal_consult", "t.me/lawyer_help", "t.me/biz_law_ru"],
        "description": "Юридические услуги"
    },
    "marketing": {
        "keywords": ["продвижение в инстаграм", "таргетированная реклама", "smm специалист", "копирайтер", "маркетолог"],
        "channels": ["t.me/smm_school", "t.me/targetolog", "t.me/marketing_news_ru"],
        "description": "Маркетинг и реклама"
    },
    "it": {
        "keywords": ["разработка приложений", "фронтенд разработка", "заказать сайт", "веб разработка", "программист на python"],
        "channels": ["t.me/it_jobs", "t.me/frontend_dev", "t.me/python_ru"],
        "description": "IT и разработка"
    },
    "freelance": {
        "keywords": ["ищу фрилансера", "заказать работу", "выполнить задание", "фриланс биржа", "нужен исполнитель"],
        "channels": ["t.me/freelance_ru", "t.me/zakaz_frelans", "t.me/kwork_help"],
        "description": "Фриланс и заказы"
    }
}

def get_niche_recommendations(niche: str):
    return NICHE_DATABASE.get(niche, NICHE_DATABASE["freelance"])

def save_user_onboarding(user_id: int, niche: str):
    recs = get_niche_recommendations(niche)
    conn = sqlite3.connect(DATABASE_PATH)
    cur = conn.cursor()
    cur.execute("""
        INSERT OR REPLACE INTO onboarding (user_id, niche, channels_recommended, keywords_recommended, completed)
        VALUES (?, ?, ?, ?, 1)
    """, (user_id, niche, json.dumps(recs["channels"]), json.dumps(recs["keywords"])))
    for kw in recs["keywords"]:
        cur.execute("INSERT OR IGNORE INTO keywords (user_id, keyword) VALUES (?, ?)", (user_id, kw))
    conn.commit()
    conn.close()