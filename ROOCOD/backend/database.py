"""
VPN Manager Database Module
Handles all database operations
"""

import sqlite3
import json
from datetime import datetime, timedelta
import hashlib
import os

class Database:
    def __init__(self, db_path='vpn_manager.db'):
        self.db_path = db_path
        self.init_database()

    def get_connection(self):
        """Get database connection"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def init_database(self):
        """Initialize database with tables"""
        conn = self.get_connection()
        cursor = conn.cursor()

        # Admins table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS admins (
                id INTEGER PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                name TEXT,
                email TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # Proxies table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS proxies (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                country TEXT NOT NULL,
                host TEXT NOT NULL,
                port INTEGER NOT NULL,
                type TEXT NOT NULL,
                username TEXT,
                password TEXT,
                status TEXT DEFAULT 'active',
                users_count INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # Users table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                status TEXT DEFAULT 'active',
                selected_proxy_id TEXT,
                traffic_used INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (selected_proxy_id) REFERENCES proxies(id)
            )
        ''')

        # Activity logs
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS logs (
                id INTEGER PRIMARY KEY,
                user_id TEXT,
                admin_id TEXT,
                action TEXT NOT NULL,
                details TEXT,
                level TEXT DEFAULT 'info',
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # Settings table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # Insert default admin if not exists
        cursor.execute('SELECT COUNT(*) FROM admins')
        if cursor.fetchone()[0] == 0:
            admin_password = self._hash_password('admin123')
            cursor.execute('''
                INSERT INTO admins (username, password, name, email)
                VALUES (?, ?, ?, ?)
            ''', ('admin', admin_password, 'Administrator', 'admin@vpnmanager.local'))

        # Insert default settings
        default_settings = {
            'max_users_per_proxy': '50',
            'default_proxy_timeout': '30',
            'max_bandwidth': '1000',
            'enable_logging': 'true',
            'enable_auto_backup': 'true'
        }

        for key, value in default_settings.items():
            cursor.execute('''
                INSERT OR IGNORE INTO settings (key, value)
                VALUES (?, ?)
            ''', (key, value))

        conn.commit()
        conn.close()

    def _hash_password(self, password):
        """Hash password with salt"""
        return hashlib.sha256(password.encode()).hexdigest()

    # ==================== Admin Operations ====================

    def verify_admin_credentials(self, username, password):
        """Verify admin credentials"""
        conn = self.get_connection()
        cursor = conn.cursor()

        cursor.execute(
            'SELECT * FROM admins WHERE username = ?',
            (username,)
        )

        admin = cursor.fetchone()
        conn.close()

        if not admin:
            return None

        hashed_password = self._hash_password(password)
        if admin['password'] != hashed_password:
            return None

        return dict(admin)

    # ==================== Proxy Operations ====================

    def get_all_proxies(self):
        """Get all proxies"""
        conn = self.get_connection()
        cursor = conn.cursor()

        cursor.execute('SELECT * FROM proxies WHERE status = "active"')
        proxies = [dict(row) for row in cursor.fetchall()]

        conn.close()
        return proxies

    def get_all_proxies_admin(self):
        """Get all proxies with sensitive data (admin)"""
        conn = self.get_connection()
        cursor = conn.cursor()

        cursor.execute('SELECT * FROM proxies')
        proxies = [dict(row) for row in cursor.fetchall()]

        conn.close()
        return proxies

    def get_proxy_by_id(self, proxy_id):
        """Get proxy by ID"""
        conn = self.get_connection()
        cursor = conn.cursor()

        cursor.execute('SELECT * FROM proxies WHERE id = ?', (proxy_id,))
        proxy = cursor.fetchone()

        conn.close()

        if not proxy:
            return None

        return dict(proxy)

    def create_proxy(self, name, country, host, port, type, username=None, password=None):
        """Create new proxy"""
        proxy_id = self._generate_id(name)

        conn = self.get_connection()
        cursor = conn.cursor()

        cursor.execute('''
            INSERT INTO proxies (id, name, country, host, port, type, username, password)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (proxy_id, name, country, host, port, type, username, password))

        conn.commit()
        conn.close()

        return proxy_id

    def update_proxy(self, proxy_id, data):
        """Update proxy"""
        conn = self.get_connection()
        cursor = conn.cursor()

        update_fields = []
        values = []

        for key in ['name', 'country', 'host', 'port', 'type', 'username', 'password', 'status']:
            if key in data:
                update_fields.append(f"{key} = ?")
                values.append(data[key])

        if update_fields:
            update_fields.append("updated_at = CURRENT_TIMESTAMP")
            values.append(proxy_id)

            query = f"UPDATE proxies SET {', '.join(update_fields)} WHERE id = ?"
            cursor.execute(query, values)
            conn.commit()

        conn.close()

    def delete_proxy(self, proxy_id):
        """Delete proxy"""
        conn = self.get_connection()
        cursor = conn.cursor()

        cursor.execute('DELETE FROM proxies WHERE id = ?', (proxy_id,))

        conn.commit()
        conn.close()

    # ==================== User Operations ====================

    def get_all_users(self):
        """Get all users"""
        conn = self.get_connection()
        cursor = conn.cursor()

        cursor.execute('''
            SELECT u.*, p.name as proxy_name FROM users u
            LEFT JOIN proxies p ON u.selected_proxy_id = p.id
        ''')

        users = [dict(row) for row in cursor.fetchall()]

        conn.close()
        return users

    def get_user_by_id(self, user_id):
        """Get user by ID"""
        conn = self.get_connection()
        cursor = conn.cursor()

        cursor.execute('''
            SELECT u.*, p.name as proxy_name FROM users u
            LEFT JOIN proxies p ON u.selected_proxy_id = p.id
            WHERE u.id = ?
        ''', (user_id,))

        user = cursor.fetchone()

        conn.close()

        if not user:
            return None

        return dict(user)

    def update_user(self, user_id, data):
        """Update user"""
        conn = self.get_connection()
        cursor = conn.cursor()

        update_fields = []
        values = []

        for key in ['name', 'email', 'status', 'selected_proxy_id']:
            if key in data:
                update_fields.append(f"{key} = ?")
                values.append(data[key])

        if update_fields:
            update_fields.append("updated_at = CURRENT_TIMESTAMP")
            values.append(user_id)

            query = f"UPDATE users SET {', '.join(update_fields)} WHERE id = ?"
            cursor.execute(query, values)
            conn.commit()

        conn.close()

    # ==================== Statistics ====================

    def get_total_proxies(self):
        """Get total proxies count"""
        conn = self.get_connection()
        cursor = conn.cursor()

        cursor.execute('SELECT COUNT(*) FROM proxies')
        count = cursor.fetchone()[0]

        conn.close()
        return count

    def get_active_users_count(self):
        """Get active users count"""
        conn = self.get_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT COUNT(*) FROM users WHERE status = 'active'")
        count = cursor.fetchone()[0]

        conn.close()
        return count

    def get_daily_traffic(self):
        """Get daily traffic in bytes"""
        conn = self.get_connection()
        cursor = conn.cursor()

        cursor.execute('SELECT COALESCE(SUM(traffic_used), 0) FROM users')
        traffic = cursor.fetchone()[0]

        conn.close()
        return traffic

    def get_unique_ips_count(self):
        """Get unique IPs count"""
        conn = self.get_connection()
        cursor = conn.cursor()

        cursor.execute('SELECT COUNT(DISTINCT selected_proxy_id) FROM users WHERE selected_proxy_id IS NOT NULL')
        count = cursor.fetchone()[0]

        conn.close()
        return count

    def get_activity_data(self):
        """Get activity data for the last 7 days"""
        conn = self.get_connection()
        cursor = conn.cursor()

        # Simulated activity data
        activity = []
        for i in range(7):
            date = datetime.now() - timedelta(days=i)
            cursor.execute(
                "SELECT COUNT(*) FROM logs WHERE DATE(timestamp) = DATE(?)",
                (date.isoformat(),)
            )
            count = cursor.fetchone()[0]
            activity.append(count)

        conn.close()
        return list(reversed(activity))

    # ==================== Settings ====================

    def get_settings(self):
        """Get all settings"""
        conn = self.get_connection()
        cursor = conn.cursor()

        cursor.execute('SELECT * FROM settings')
        settings_rows = cursor.fetchall()

        conn.close()

        settings = {}
        for row in settings_rows:
            key = row['key']
            value = row['value']
            # Convert string booleans
            if value.lower() in ['true', 'false']:
                settings[key] = value.lower() == 'true'
            # Try to convert to int
            elif value.isdigit():
                settings[key] = int(value)
            else:
                settings[key] = value

        return settings

    def save_settings(self, settings):
        """Save settings"""
        conn = self.get_connection()
        cursor = conn.cursor()

        for key, value in settings.items():
            cursor.execute('''
                INSERT OR REPLACE INTO settings (key, value)
                VALUES (?, ?)
            ''', (key, str(value)))

        conn.commit()
        conn.close()

    # ==================== Logging ====================

    def log_action(self, user_id, action, details='', level='info'):
        """Log action"""
        conn = self.get_connection()
        cursor = conn.cursor()

        cursor.execute('''
            INSERT INTO logs (user_id, action, details, level)
            VALUES (?, ?, ?, ?)
        ''', (user_id, action, details, level))

        conn.commit()
        conn.close()

    def get_logs(self, level='', limit=100):
        """Get logs"""
        conn = self.get_connection()
        cursor = conn.cursor()

        if level:
            cursor.execute('''
                SELECT * FROM logs WHERE level = ?
                ORDER BY timestamp DESC LIMIT ?
            ''', (level, limit))
        else:
            cursor.execute('''
                SELECT * FROM logs
                ORDER BY timestamp DESC LIMIT ?
            ''', (limit,))

        logs = [dict(row) for row in cursor.fetchall()]

        conn.close()
        return logs

    def clear_logs(self):
        """Clear all logs"""
        conn = self.get_connection()
        cursor = conn.cursor()

        cursor.execute('DELETE FROM logs')

        conn.commit()
        conn.close()

    # ==================== Utilities ====================

    def _generate_id(self, name):
        """Generate unique ID from name"""
        import uuid
        return f"{name.replace(' ', '-').lower()}-{uuid.uuid4().hex[:8]}"
