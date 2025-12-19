#!/usr/bin/env python3
"""
VPN Manager Backend Server
Handles proxy management and user connections
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from functools import wraps
import json
import sqlite3
import os
from datetime import datetime, timedelta
import hashlib
import secrets
from database import Database
from config import Config

app = Flask(__name__)
CORS(app)

# Configuration
app.config.from_object(Config)

# Initialize JWT
jwt = JWTManager(app)

# Initialize Database
db = Database()

# ==================== Health Check ====================

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'ok',
        'timestamp': datetime.now().isoformat(),
        'version': '1.0.0'
    })


# ==================== Authentication ====================

@app.route('/api/admin/login', methods=['POST'])
def admin_login():
    """Admin login endpoint"""
    data = request.get_json()

    if not data or not data.get('username') or not data.get('password'):
        return jsonify({'error': 'Missing credentials'}), 400

    username = data['username']
    password = data['password']

    # Verify credentials (in production, use proper hashing)
    admin = db.verify_admin_credentials(username, password)

    if not admin:
        return jsonify({'error': 'Invalid credentials'}), 401

    # Generate token
    access_token = create_access_token(
        identity=admin['id'],
        additional_claims={'role': 'admin', 'username': admin['username']}
    )

    return jsonify({
        'token': access_token,
        'admin': {
            'id': admin['id'],
            'username': admin['username'],
            'name': admin['name']
        }
    })


@app.route('/api/admin/verify-token', methods=['GET'])
@jwt_required()
def verify_token():
    """Verify admin token"""
    current_user = get_jwt_identity()
    return jsonify({'status': 'valid', 'user_id': current_user})


# ==================== VPN Operations ====================

@app.route('/api/vpn/toggle', methods=['POST'])
def toggle_vpn():
    """Toggle VPN on/off"""
    data = request.get_json()

    if not data:
        return jsonify({'error': 'No data provided'}), 400

    enabled = data.get('enabled', False)

    return jsonify({
        'status': 'success',
        'enabled': enabled,
        'message': 'VPN toggled successfully'
    })


@app.route('/api/vpn/connect', methods=['POST'])
def connect_vpn():
    """Connect to VPN with selected location"""
    data = request.get_json()

    if not data or not data.get('locationId'):
        return jsonify({'error': 'Location ID required'}), 400

    location_id = data['locationId']

    # Get proxy from database
    proxy = db.get_proxy_by_id(location_id)

    if not proxy:
        return jsonify({'error': 'Proxy not found'}), 404

    # Log connection
    db.log_action(
        user_id=None,
        action='VPN_CONNECT',
        details=f"Connected to {proxy['name']}"
    )

    return jsonify({
        'status': 'connected',
        'proxy': proxy,
        'ip': '0.0.0.0',  # Would be actual IP from proxy
        'message': 'Connected successfully'
    })


@app.route('/api/vpn/location', methods=['POST'])
def change_location():
    """Change VPN location"""
    data = request.get_json()

    if not data or not data.get('locationId'):
        return jsonify({'error': 'Location ID required'}), 400

    location_id = data['locationId']

    proxy = db.get_proxy_by_id(location_id)

    if not proxy:
        return jsonify({'error': 'Proxy not found'}), 404

    return jsonify({
        'status': 'success',
        'proxy': proxy,
        'message': 'Location changed successfully'
    })


@app.route('/api/speed-test', methods=['GET'])
def speed_test():
    """Run speed test"""
    import time

    # Simulate speed test
    start_time = time.time()
    time.sleep(0.5)  # Simulate network delay
    end_time = time.time()

    speed = 100 / (end_time - start_time)  # Simulate speed result

    return jsonify({
        'speed': speed,
        'unit': 'Mbps',
        'timestamp': datetime.now().isoformat()
    })


# ==================== Proxies Management (Admin) ====================

@app.route('/api/proxies', methods=['GET'])
def get_proxies():
    """Get all proxies (public endpoint)"""
    proxies = db.get_all_proxies()

    # Filter sensitive data for non-admin users
    safe_proxies = []
    for proxy in proxies:
        safe_proxies.append({
            'id': proxy['id'],
            'name': proxy['name'],
            'country': proxy['country'],
            'host': proxy['host'],
            'port': proxy['port'],
            'type': proxy['type'],
            'status': proxy['status']
        })

    return jsonify(safe_proxies)


@app.route('/api/proxies/<proxy_id>', methods=['GET'])
def get_proxy(proxy_id):
    """Get proxy details"""
    proxy = db.get_proxy_by_id(proxy_id)

    if not proxy:
        return jsonify({'error': 'Proxy not found'}), 404

    return jsonify(proxy)


@app.route('/api/admin/proxies', methods=['GET'])
@jwt_required()
def admin_get_proxies():
    """Get all proxies (admin endpoint with full details)"""
    proxies = db.get_all_proxies_admin()
    return jsonify(proxies)


@app.route('/api/admin/proxies', methods=['POST'])
@jwt_required()
def admin_create_proxy():
    """Create new proxy"""
    data = request.get_json()

    if not all(k in data for k in ['name', 'country', 'host', 'port', 'type']):
        return jsonify({'error': 'Missing required fields'}), 400

    proxy_id = db.create_proxy(
        name=data['name'],
        country=data['country'],
        host=data['host'],
        port=data['port'],
        type=data['type'],
        username=data.get('username'),
        password=data.get('password')
    )

    db.log_action(
        user_id=get_jwt_identity(),
        action='PROXY_CREATE',
        details=f"Created proxy: {data['name']}"
    )

    return jsonify({
        'status': 'created',
        'id': proxy_id
    }), 201


@app.route('/api/admin/proxies/<proxy_id>', methods=['GET'])
@jwt_required()
def admin_get_proxy(proxy_id):
    """Get proxy details (admin)"""
    proxy = db.get_proxy_by_id(proxy_id)

    if not proxy:
        return jsonify({'error': 'Proxy not found'}), 404

    return jsonify(proxy)


@app.route('/api/admin/proxies/<proxy_id>', methods=['PUT'])
@jwt_required()
def admin_update_proxy(proxy_id):
    """Update proxy"""
    data = request.get_json()

    db.update_proxy(proxy_id, data)

    db.log_action(
        user_id=get_jwt_identity(),
        action='PROXY_UPDATE',
        details=f"Updated proxy: {proxy_id}"
    )

    return jsonify({'status': 'updated'})


@app.route('/api/admin/proxies/<proxy_id>', methods=['DELETE'])
@jwt_required()
def admin_delete_proxy(proxy_id):
    """Delete proxy"""
    db.delete_proxy(proxy_id)

    db.log_action(
        user_id=get_jwt_identity(),
        action='PROXY_DELETE',
        details=f"Deleted proxy: {proxy_id}"
    )

    return jsonify({'status': 'deleted'})


# ==================== Users Management (Admin) ====================

@app.route('/api/admin/users', methods=['GET'])
@jwt_required()
def admin_get_users():
    """Get all users"""
    users = db.get_all_users()
    return jsonify(users)


@app.route('/api/admin/users/<user_id>', methods=['GET'])
@jwt_required()
def admin_get_user(user_id):
    """Get user details"""
    user = db.get_user_by_id(user_id)

    if not user:
        return jsonify({'error': 'User not found'}), 404

    return jsonify(user)


@app.route('/api/admin/users/<user_id>', methods=['PUT'])
@jwt_required()
def admin_update_user(user_id):
    """Update user"""
    data = request.get_json()

    db.update_user(user_id, data)

    db.log_action(
        user_id=get_jwt_identity(),
        action='USER_UPDATE',
        details=f"Updated user: {user_id}"
    )

    return jsonify({'status': 'updated'})


# ==================== Statistics (Admin) ====================

@app.route('/api/admin/statistics', methods=['GET'])
@jwt_required()
def admin_get_statistics():
    """Get system statistics"""
    stats = {
        'total_proxies': db.get_total_proxies(),
        'active_users': db.get_active_users_count(),
        'daily_traffic': db.get_daily_traffic(),
        'unique_ips': db.get_unique_ips_count(),
        'activity_chart': db.get_activity_data()
    }

    return jsonify(stats)


# ==================== Settings (Admin) ====================

@app.route('/api/admin/settings', methods=['GET'])
@jwt_required()
def admin_get_settings():
    """Get system settings"""
    settings = db.get_settings()
    return jsonify(settings)


@app.route('/api/admin/settings', methods=['POST'])
@jwt_required()
def admin_save_settings():
    """Save system settings"""
    data = request.get_json()

    db.save_settings(data)

    db.log_action(
        user_id=get_jwt_identity(),
        action='SETTINGS_UPDATE',
        details="Updated system settings"
    )

    return jsonify({'status': 'saved'})


# ==================== Logs (Admin) ====================

@app.route('/api/admin/logs', methods=['GET'])
@jwt_required()
def admin_get_logs():
    """Get system logs"""
    level = request.args.get('level', '')
    logs = db.get_logs(level=level)

    return jsonify(logs)


@app.route('/api/admin/logs', methods=['DELETE'])
@jwt_required()
def admin_clear_logs():
    """Clear system logs"""
    db.clear_logs()

    db.log_action(
        user_id=get_jwt_identity(),
        action='LOGS_CLEAR',
        details="Cleared system logs"
    )

    return jsonify({'status': 'cleared'})


# ==================== Error Handlers ====================

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Not found'}), 404


@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error'}), 500


@app.errorhandler(401)
def unauthorized(error):
    return jsonify({'error': 'Unauthorized'}), 401


# ==================== Main ====================

if __name__ == '__main__':
    print("Starting VPN Manager Backend Server...")
    print(f"API running on {app.config['HOST']}:{app.config['PORT']}")

    app.run(
        host=app.config['HOST'],
        port=app.config['PORT'],
        debug=app.config['DEBUG']
    )
