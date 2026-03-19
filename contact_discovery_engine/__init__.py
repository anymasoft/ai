# Contact Discovery Engine - ФАЗА 2
# SPA Detection + Header/Nav Analysis

from current_engine import ContactDiscoveryEngine
from spa_detector import SPADetector
from header_nav_analyzer import HeaderNavAnalyzer
from url_handler import URLHandler
from contact_paths_dictionary import ContactPathDictionary

__version__ = "0.2.0"
__all__ = [
    "ContactDiscoveryEngine",
    "SPADetector",
    "HeaderNavAnalyzer",
    "URLHandler",
    "ContactPathDictionary",
]
