"""
VPN Manager Configuration
"""

import os
from datetime import timedelta

class Config:
    """Base configuration"""

    # Flask
    DEBUG = os.environ.get('DEBUG', True)
    TESTING = False
    HOST = os.environ.get('HOST', 'localhost')
    PORT = int(os.environ.get('PORT', 5000))

    # JWT
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'your-secret-key-change-in-production')
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(days=30)

    # Database
    DATABASE_PATH = os.environ.get('DATABASE_PATH', 'vpn_manager.db')

    # VPN Settings
    MAX_USERS_PER_PROXY = int(os.environ.get('MAX_USERS_PER_PROXY', 50))
    DEFAULT_PROXY_TIMEOUT = int(os.environ.get('DEFAULT_PROXY_TIMEOUT', 30))
    MAX_BANDWIDTH = int(os.environ.get('MAX_BANDWIDTH', 1000))

    # Logging
    ENABLE_LOGGING = os.environ.get('ENABLE_LOGGING', 'true').lower() == 'true'
    ENABLE_AUTO_BACKUP = os.environ.get('ENABLE_AUTO_BACKUP', 'true').lower() == 'true'

    # CORS
    CORS_ORIGINS = os.environ.get('CORS_ORIGINS', '*').split(',')


class DevelopmentConfig(Config):
    """Development configuration"""
    DEBUG = True
    TESTING = False


class ProductionConfig(Config):
    """Production configuration"""
    DEBUG = False
    TESTING = False
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY')  # Must be set


class TestingConfig(Config):
    """Testing configuration"""
    DEBUG = True
    TESTING = True
    DATABASE_PATH = ':memory:'
