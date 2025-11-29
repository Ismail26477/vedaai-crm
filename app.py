# app.py - Flask CRM using MongoDB (pymongo)
import os
import uuid
import traceback
from datetime import datetime, timedelta
from functools import wraps

from flask import Flask, request, jsonify, render_template, send_from_directory, session, redirect, url_for
from werkzeug.security import generate_password_hash, check_password_hash
from flask_cors import CORS

from pymongo import MongoClient, ASCENDING, DESCENDING
import pymongo

# Import for email functionality
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# -----------------------
# Basic Flask + CORS setup
# -----------------------
app = Flask(__name__)
CORS(app)

app.secret_key = os.environ.get('SECRET_KEY', 'replace-this-secret-in-prod')
app.config['TEMPLATES_AUTO_RELOAD'] = True

# Users can now stay logged in for 30 days if they check "Remember Me"
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=30)
app.config['SESSION_COOKIE_SECURE'] = False  # Set to True in production with HTTPS
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'

# ADMIN credentials (use env vars in production)
ADMIN_USER = os.environ.get('ADMIN_USER', 'admin')
ADMIN_PASS = os.environ.get('ADMIN_PASS', 'admin123')

# -----------------------
# Mongo config (env vars)
# -----------------------
MONGO_URI = os.environ.get('MONGO_URI', 'mongodb+srv://ismail:ismail123@cluster0.t63ghmf.mongodb.net/?appName=Cluster0')
MONGO_DB = os.environ.get('MONGO_DB', 'crmdb')

# Create global client and DB (reuse across requests)
mongo_client = MongoClient(MONGO_URI)
db = mongo_client[MONGO_DB]  # use MONGO_DB instead of MONGO_URI for database name

# Define follow-up intervals by lead status
FOLLOWUP_INTERVALS = {
    "New Lead": 24,           # 24 hours
    "Contacted": 48,          # 48 hours
    "Interested": 120,        # 5 days
    "Negotiation": 72,        # 3 days
    "Not Interested": None,   # No follow-up
    "Closed Won": None,       # No follow-up
    "Closed Lost": None,      # No follow-up
    "Won": None,
    "Lost": None
}

def calculate_next_followup(last_call_date, lead_stage):
    """Calculate next follow-up date based on last call and lead stage"""
    if not last_call_date or lead_stage in FOLLOWUP_INTERVALS and FOLLOWUP_INTERVALS[lead_stage] is None:
        return None
    
    hours = FOLLOWUP_INTERVALS.get(lead_stage, 24)
    if hours is None:
        return None
    
    return last_call_date + timedelta(hours=hours)

def get_last_call_for_lead(lead_id):
    """Get the most recent call for a lead"""
    db = get_mongo_db()
    call = db.calls.find_one({"lead_id": lead_id}, sort=[("createdAt", DESCENDING)])
    return call


def ensure_indexes():
    """Create useful indexes if they don't exist."""
    try:
        db.leads.create_index([("id", ASCENDING)], unique=True)
        db.leads.create_index([("phoneDigits", ASCENDING)])
        db.leads.create_index([("stage", ASCENDING), ("createdAt", DESCENDING)])
        db.leads.create_index([("source", ASCENDING)])
        db.leads.create_index([("priority", ASCENDING)])
        db.leads.create_index([("assignedCaller", ASCENDING)])
        db.callers.create_index([("username", ASCENDING)], unique=True)
        db.customers.create_index([("lead_id", ASCENDING)], unique=False)
        db.settings.create_index([("key", ASCENDING)], unique=True)
        # New indexes for logging collections
        db.calls.create_index([("lead_id", ASCENDING)])
        db.calls.create_index([("createdAt", DESCENDING)])
        db.activities.create_index([("lead_id", ASCENDING)])
        db.activities.create_index([("createdAt", DESCENDING)])
        db.audit_logs.create_index([("timestamp", DESCENDING)])
    except Exception:
        app.logger.exception("Error ensuring indexes")

# call at startup
ensure_indexes()

# -----------------------
# Email Configuration & Helper
# -----------------------
def send_email(recipient_email, subject, html_body, caller_name=""):
    """Send an email notification"""
    try:
        smtp_server = os.environ.get('SMTP_SERVER', get_settings('smtp_server', ''))
        smtp_port = int(os.environ.get('SMTP_PORT', get_settings('smtp_port', 587)))
        sender_email = os.environ.get('SENDER_EMAIL', get_settings('sender_email', ''))
        sender_password = os.environ.get('SENDER_PASSWORD', get_settings('sender_password', ''))
        
        print(f"[v0] Email Debug - SMTP Server: {smtp_server}, Port: {smtp_port}, From: {sender_email}, To: {recipient_email}")
        
        if not smtp_server or not sender_email or not sender_password:
            print(f"[v0] Email Config Missing - Server: {bool(smtp_server)}, Email: {bool(sender_email)}, Password: {bool(sender_password)}")
            app.logger.warning(f"Email not sent: SMTP configuration incomplete")
            return False
        
        # Create message
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = sender_email
        msg["To"] = recipient_email
        
        # Attach HTML body
        part = MIMEText(html_body, "html")
        msg.attach(part)
        
        # Send email
        with smtplib.SMTP(smtp_server, smtp_port) as server:
            server.starttls()
            server.login(sender_email, sender_password)
            server.sendmail(sender_email, recipient_email, msg.as_string())
        
        print(f"[v0] Email Successfully Sent to {recipient_email}")
        app.logger.info(f"Email sent to {recipient_email} - {subject}")
        return True
    except Exception as e:
        print(f"[v0] Email Error: {str(e)}")
        app.logger.error(f"Error sending email to {recipient_email}: {str(e)}")
        return False

def create_lead_assignment_email(caller_name, lead_name, lead_phone, lead_email, lead_value, lead_source, lead_city):
    """Create HTML email for lead assignment notification"""
    formatted_value = f"₹{lead_value:,.0f}" if lead_value else "₹0"
    
    html_body = f"""
    <html>
        <body style="font-family: Arial, sans-serif; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <h2 style="color: #2563eb; margin: 0;">New Lead Assigned!</h2>
                </div>
                
                <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                    <p style="margin: 0 0 15px 0; font-size: 16px;">
                        <strong>Hi {caller_name},</strong>
                    </p>
                    <p style="margin: 0 0 15px 0; font-size: 14px; color: #555;">
                        A new lead has been assigned to you in the CRM. Please review the details below and follow up accordingly.
                    </p>
                </div>
                
                <div style="background: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                    <h3 style="color: #1e40af; margin-top: 0; margin-bottom: 15px; font-size: 18px;">Lead Details</h3>
                    
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr style="border-bottom: 1px solid #e0e0e0;">
                            <td style="padding: 10px 0; font-weight: bold; color: #555; width: 35%;">Name:</td>
                            <td style="padding: 10px 0; color: #333;">{lead_name}</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #e0e0e0;">
                            <td style="padding: 10px 0; font-weight: bold; color: #555;">Phone:</td>
                            <td style="padding: 10px 0; color: #333;">{lead_phone or '-'}</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #e0e0e0;">
                            <td style="padding: 10px 0; font-weight: bold; color: #555;">Email:</td>
                            <td style="padding: 10px 0; color: #333;">{lead_email or '-'}</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #e0e0e0;">
                            <td style="padding: 10px 0; font-weight: bold; color: #555;">City:</td>
                            <td style="padding: 10px 0; color: #333;">{lead_city or '-'}</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #e0e0e0;">
                            <td style="padding: 10px 0; font-weight: bold; color: #555;">Lead Value:</td>
                            <td style="padding: 10px 0; color: #10b981; font-weight: bold;">{formatted_value}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px 0; font-weight: bold; color: #555;">Source:</td>
                            <td style="padding: 10px 0; color: #333;">{lead_source or 'Unknown'}</td>
                        </tr>
                    </table>
                </div>
                
                <div style="background: #fef3c7; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b; margin-bottom: 20px;">
                    <p style="margin: 0; color: #92400e; font-size: 14px;">
                        <strong>Action Required:</strong> Please contact the lead as soon as possible to discuss their needs and move the deal forward.
                    </p>
                </div>
                
                <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; text-align: center; margin-bottom: 20px;">
                    <p style="margin: 0; font-size: 13px; color: #666;">
                        <a href="#" style="color: #2563eb; text-decoration: none; font-weight: bold;">View in CRM</a>
                    </p>
                </div>
                
                <div style="border-top: 1px solid #e0e0e0; padding-top: 15px; text-align: center; color: #999; font-size: 12px;">
                    <p style="margin: 0;">Real Estate CRM System</p>
                    <p style="margin: 5px 0 0 0;">This is an automated notification. Please do not reply to this email.</p>
                </div>
            </div>
        </body>
    </html>
    """
    
    return html_body

def send_new_lead_notification(lead_id, lead_data):
    """Send email notification to assigned caller about new lead"""
    try:
        db = get_mongo_db()
        lead = db.leads.find_one({"id": lead_id}) if not lead_data else lead_data
        
        if not lead:
            print(f"[v0] Lead not found: {lead_id}")
            return False
        
        assigned_caller_id = lead.get('assignedCaller')
        if not assigned_caller_id:
            print(f"[v0] No caller assigned to lead {lead_id}")
            return False
        
        # Get caller details
        from bson import ObjectId
        try:
            oid = ObjectId(assigned_caller_id)
            caller = db.callers.find_one({"_id": oid})
        except:
            caller = None
        
        if not caller:
            print(f"[v0] Caller not found: {assigned_caller_id}")
            return False
        
        caller_email = caller.get('email')
        if not caller_email or not caller_email.strip():
            print(f"[v0] Caller {caller.get('username')} has no email configured")
            return False
        
        # Create email
        caller_name = caller.get('name') or caller.get('username', 'Caller')
        email_body = create_lead_assignment_email(
            caller_name=caller_name,
            lead_name=lead.get('name', 'Unknown'),
            lead_phone=lead.get('phone', ''),
            lead_email=lead.get('email', ''),
            lead_value=lead.get('value', 0),
            lead_source=lead.get('source', ''),
            lead_city=lead.get('city', '')
        )
        
        # Send email
        email_sent = send_email(
            recipient_email=caller_email,
            subject=f"New Lead Assigned: {lead.get('name', 'Unknown')}",
            html_body=email_body,
            caller_name=caller_name
        )
        
        if email_sent:
            print(f"[v0] New lead notification sent to {caller_email}")
            app.logger.info(f"New lead notification email sent to {caller_email}")
        else:
            print(f"[v0] Failed to send email to {caller_email}")
        
        return email_sent
    except Exception as e:
        print(f"[v0] Error sending new lead notification: {str(e)}")
        app.logger.error(f"Error sending new lead notification: {str(e)}")
        return False


# -----------------------
# Helpers
# -----------------------
def get_mongo_db():
    return db

def digits_only(s):
    return ''.join(filter(str.isdigit, (s or '')))

def deduplicate_leads(leads):
    """Remove duplicate leads by phone number, keeping the first (most recent)"""
    deduplicated = {}
    for lead in leads:
        phone_digits = digits_only(lead.get('phone', ''))
        if phone_digits:
            # Keep first occurrence (most recent due to sort)
            if phone_digits not in deduplicated:
                deduplicated[phone_digits] = lead
        else:
            # If no phone, include it (can't deduplicate without phone)
            deduplicated[f"no_phone_{lead.get('id')}"] = lead
    return list(deduplicated.values())


def usd_to_inr(usd_value):
    # Current conversion rate (you may want to use an API for real-time rates)
    USD_TO_INR_RATE = 83.0
    return float(usd_value or 0) * USD_TO_INR_RATE

def iso_from_maybe_dt(val):
    if isinstance(val, datetime):
        return val.isoformat()
    try:
        # if string, try parse
        return datetime.fromisoformat(val.replace('Z', '+00:00')).isoformat()
    except Exception:
        return datetime.utcnow().isoformat()

def doc_to_dict(doc):
    if not doc:
        return None
    created = doc.get('createdAt')
    if isinstance(created, datetime):
        created_iso = created.isoformat()
    else:
        try:
            created_iso = str(created)
        except Exception:
            created_iso = datetime.utcnow().isoformat()
    
    next_follow_date = doc.get('nextFollowDate')
    if isinstance(next_follow_date, datetime):
        next_follow_date_iso = next_follow_date.isoformat()
    elif next_follow_date:
        next_follow_date_iso = str(next_follow_date)
    else:
        next_follow_date_iso = None
    
    return {
        "id": doc.get('id') or str(doc.get('_id')),
        "name": doc.get('name', ''),
        "phone": doc.get('phone', ''),
        "email": doc.get('email', ''),
        "city": doc.get('city', ''),
        "value": float(doc.get('value') or 0),
        "source": doc.get('source', ''),
        "stage": doc.get('stage', ''),
        "priority": doc.get('priority', ''),
        "assignedCaller": doc.get('assignedCaller'),
        "assignedCallerName": doc.get('assignedCallerName'),
        "assignedAt": doc.get('assignedAt').isoformat() if isinstance(doc.get('assignedAt'), datetime) else doc.get('assignedAt'),
        "createdAt": created_iso,
        "project": doc.get('project', '-'),
        "leadStatus": doc.get('leadStatus', 'Active'),
        "nextFollow": doc.get('nextFollow', '-'),
        "nextFollowDate": next_follow_date_iso,
        "callbackReason": doc.get('callbackReason', ''),
        "callbackNextFollowup": doc.get('callbackNextFollowup', ''),
        "notInterestedReason": doc.get('notInterestedReason', ''),
        "notInterestedNote": doc.get('notInterestedNote', ''),
        "notInterestedDetails": doc.get('notInterestedDetails', {}), # Include nested details
    }

def get_settings(key, default=None):
    """Get a setting from MongoDB"""
    db = get_mongo_db()
    doc = db.settings.find_one({"key": key})
    if doc:
        return doc.get("value", default)
    return default

def save_settings(key, value):
    """Save a setting to MongoDB"""
    db = get_mongo_db()
    db.settings.update_one(
        {"key": key},
        {"$set": {"value": value, "updatedAt": datetime.utcnow()}},
        upsert=True
    )

def get_next_caller_for_assignment():
    """Get next caller for Round Robin assignment"""
    db = get_mongo_db()
    # Get active callers
    active_callers = list(db.callers.find({"status": "Active"}))
    if not active_callers:
        return None

    # Get current round robin index
    round_robin_index = get_settings("round_robin_index", 0)
    next_index = round_robin_index % len(active_callers)

    # Save next index for next time
    save_settings("round_robin_index", next_index + 1)

    return active_callers[next_index]

# -----------------------
# Auth decorator
# -----------------------
def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get('user'):
            return redirect(url_for('login', next=request.path))
        return f(*args, **kwargs)
    return decorated

def caller_only_restricted(f):
    """Allow callers to access all pages except settings"""
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get('user'):
            return redirect(url_for('login', next=request.path))

        if session.get('role') != 'admin':
            current_route = request.endpoint
            # Callers can access all pages except settings
            restricted_routes = ['settings', 'logout', 'login']
            
            if current_route in restricted_routes and current_route != 'login' and current_route != 'logout':
                return "Access Denied: This page is admin only", 403

        return f(*args, **kwargs)
    return decorated

# -----------------------
# Static file helpers
# -----------------------
@app.route('/<path:filename>.css')
def serve_css(filename):
    return send_from_directory('static', f'{filename}.css', mimetype='text/css')

@app.route('/<path:filename>.js')
def serve_js(filename):
    return send_from_directory('static', f'{filename}.js', mimetype='application/javascript')

# -----------------------
# Template routes (protected)
# -----------------------
@app.route('/')
@login_required
def index():
    return render_template('index.html', active='home')

@app.route('/dashboard')
@login_required
@caller_only_restricted
def dashboard():
    return render_template('dashboard.html', active='dashboard')

@app.route('/leads')
@login_required
def leads():
    return render_template('leads.html', active='leads')

@app.route('/pipeline')
@login_required
def pipeline():
    return render_template('pipeline.html', active='pipeline')

@app.route('/reports')
@login_required
@caller_only_restricted
def reports():
    return render_template('reports.html', active='reports')

@app.route('/analytics')
@login_required
@caller_only_restricted
def analytics():
    return render_template('analytics.html', active='analytics')

@app.route('/customers')
@login_required
@caller_only_restricted
def customers():
    app.logger.debug("GET /customers called user=%s", session.get('user'))
    customers_list = []
    try:
        db = get_mongo_db()
        # support both legacy 'Won' and current 'Closed Won' stages
        cursor = db.leads.find({"stage": {"$in": ["Closed Won", "Won"]}}).sort("createdAt", DESCENDING)
        for r in cursor:
            customers_list.append(doc_to_dict(r))
    except Exception:
        traceback.print_exc()
    return render_template('customers.html', customers=customers_list)

@app.route('/settings')
@caller_only_restricted  # Use the decorator that already restricts callers
def settings():
    """Render the settings page (admin only)"""
    if session.get('role') != 'admin':
        return redirect(url_for('index'))
    return render_template('settings.html', active='settings')

# -----------------------
# API for callers (admin only)
# -----------------------
@app.route('/api/callers', methods=['GET'])
@login_required
def api_get_callers():
    if session.get('role') != 'admin':
        return jsonify({"success": False, "error": "Unauthorized"}), 403
    try:
        db = get_mongo_db()
        callers = []
        # Print debug info
        print("Fetching callers from MongoDB...")
        cursor = db.callers.find().sort('createdAt', DESCENDING)
        for c in cursor:
            caller_data = {
                "id": str(c.get('_id')),
                "username": c.get('username'),
                "name": c.get('name',''),
                "email": c.get('email',''),
                "phone": c.get('phone',''),
                "role": c.get('role','Caller'),
                "status": c.get('status','Active'),
                "createdAt": c.get('createdAt').isoformat() if isinstance(c.get('createdAt'), datetime) else str(c.get('createdAt') or '')
            }
            callers.append(caller_data)
            print(f"Found caller: {caller_data['username']} ({caller_data['role']})")

        print(f"Total callers found: {len(callers)}")
        return jsonify({
            "success": True,
            "callers": callers,
            "count": len(callers)
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/callers', methods=['POST'])
@login_required
def api_create_caller():
    # only admins can create callers
    if session.get('role') != 'admin':
        return jsonify({"success": False, "error": "Unauthorized"}), 403
    try:
        payload = request.get_json(force=True) or {}
        username = (payload.get('username') or '').strip()
        password = payload.get('password') or ''
        role = payload.get('role') or 'Caller'
        status = payload.get('status') or 'Active'
        name = payload.get('name') or ''
        phone = payload.get('phone') or ''
        email = payload.get('email') or ''

        if not username or not password:
            return jsonify({"success": False, "error": "Username and password are required"}), 400

        hashed = generate_password_hash(password)
        doc = {
            "username": username,
            "password": hashed,
            "role": role,
            "status": status,
            "name": name,
            "phone": phone,
            "email": email,
            "createdAt": datetime.utcnow()
        }
        db = get_mongo_db()
        db.callers.insert_one(doc)
        return jsonify({"success": True, "id": str(doc.get('_id'))}), 201
    except pymongo.errors.DuplicateKeyError:
        return jsonify({"success": False, "error": "Username already exists"}), 400
    except Exception as e:
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/callers', methods=['DELETE'])
@login_required
def api_delete_caller():
    if session.get('role') != 'admin':
        return jsonify({"success": False, "error": "Unauthorized"}), 403
    try:
        caller_id = request.args.get('id')
        if not caller_id:
            return jsonify({"success": False, "error": "Caller ID is required"}), 400

        db = get_mongo_db()
        from bson import ObjectId
        
        try:
            oid = ObjectId(caller_id)
            res = db.callers.delete_one({"_id": oid})
            if res.deleted_count > 0:
                print(f"[v0] Successfully deleted caller with ObjectId: {caller_id}")
                return jsonify({"success": True, "message": "Caller deleted successfully"})
        except Exception as e:
            print(f"[v0] Error deleting caller: {str(e)}")
            pass
        
        return jsonify({"success": False, "error": "Caller not found"}), 404
            
    except Exception as e:
        print(f"[v0] Delete caller error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/callers/<caller_id>', methods=['PUT'])
@login_required
def api_update_caller(caller_id):
    if session.get('role') != 'admin':
        return jsonify({"success": False, "error": "Unauthorized"}), 403
    try:
        payload = request.get_json(force=True) or {}
        db = get_mongo_db()
        from bson import ObjectId
        
        oid = ObjectId(caller_id)
        
        # Build update document with only the fields provided
        update_data = {}
        if 'name' in payload:
            update_data['name'] = payload['name']
        if 'email' in payload:
            update_data['email'] = payload['email']
        if 'phone' in payload:
            update_data['phone'] = payload['phone']
        if 'role' in payload:
            update_data['role'] = payload['role']
        if 'status' in payload:
            update_data['status'] = payload['status']
        if 'password' in payload and payload['password']:
            update_data['password'] = generate_password_hash(payload['password'])
        
        if not update_data:
            return jsonify({"success": False, "error": "No fields to update"}), 400
        
        res = db.callers.update_one({"_id": oid}, {"$set": update_data})
        
        if res.matched_count > 0:
            return jsonify({"success": True, "message": "Caller updated successfully"})
        else:
            return jsonify({"success": False, "error": "Caller not found"}), 404
    except Exception as e:
        print(f"[v0] Update caller error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500


# -----------------------
# Login / Logout
# -----------------------
@app.route('/login', methods=['GET', 'POST'])
def login():
    error = None
    next_url = request.args.get('next') or url_for('index')

    if request.method == 'POST':
        username = (request.form.get('username') or '').strip()
        password = request.form.get('password') or ''
        role_choice = request.form.get('role', 'caller') # Use role_choice to avoid conflict with session['role']
        remember_me = request.form.get('remember_me') == 'on'

        if role_choice == 'admin':
            expected_user = os.environ.get('ADMIN_USER', ADMIN_USER)
            expected_pass = os.environ.get('ADMIN_PASS', ADMIN_PASS)
            if username == expected_user and password == expected_pass:
                session['user'] = username
                session['role'] = 'admin'
                session['email'] = '' # Admin doesn't have an email associated in this context
                if remember_me:
                    session.permanent = True
                else:
                    session.permanent = False # Ensure session is not permanent if not checked
                return redirect(next_url)
            else:
                error = 'Invalid admin credentials.'
        else:
            try:
                db = get_mongo_db()
                caller = db.callers.find_one({"username": username})
                if not caller:
                    error = 'Caller not found.'
                elif (caller.get('status') or '').lower() != 'active':
                    error = 'Caller account is inactive.'
                elif not check_password_hash(caller.get('password', ''), password):
                    error = 'Incorrect password.'
                else:
                    session['user'] = caller.get('username')
                    session['role'] = caller.get('role', 'caller')
                    session['caller_id'] = str(caller.get('_id'))
                    session['email'] = caller.get('email', '') # Store caller's email
                    if remember_me:
                        session.permanent = True # Make session permanent
                    else:
                        session.permanent = False # Ensure session is not permanent if not checked
                    return redirect(next_url)
            except Exception:
                traceback.print_exc()
                error = 'Error checking caller credentials.'

    return render_template('login.html', error=error)

@app.route('/logout')
def logout():
    session_keys = list(session.keys())
    for k in session_keys:
        session.pop(k, None)
    return redirect(url_for('login'))

# -----------------------
# API: Leads CRUD & helpers
# -----------------------
@app.route('/api/leads', methods=['GET'])
def get_leads():
    try:
        stage_filter = request.args.get('stage')
        upcoming_followups = request.args.get('upcomingFollowups') == 'true'
        db = get_mongo_db()
        query = {}
        
        if session.get('user') and session.get('role') != 'admin':
            caller_id = session.get('caller_id')
            if caller_id:
                query['assignedCaller'] = caller_id
        
        if stage_filter:
            query['stage'] = stage_filter
        
        if upcoming_followups:
            now = datetime.utcnow()
            seven_days_later = now + timedelta(days=7)
            query['$or'] = [
                {'callbackDateTime': {'$gte': now, '$lte': seven_days_later}},
                {'nextFollowUpDate': {'$gte': now, '$lte': seven_days_later}},
                {'nextFollowDate': {'$gte': now, '$lte': seven_days_later}}
            ]
        
        cursor = db.leads.find(query).sort('createdAt', DESCENDING)
        leads = [doc_to_dict(doc) for doc in cursor]
        
        deduplicated_leads = {}
        for lead in leads:
            phone_digits = digits_only(lead.get('phone', ''))
            if phone_digits:
                # Keep first occurrence (most recent due to sort)
                if phone_digits not in deduplicated_leads:
                    deduplicated_leads[phone_digits] = lead
            else:
                # If no phone, include it (can't deduplicate without phone)
                deduplicated_leads[f"no_phone_{lead.get('id')}"] = lead
        
        leads = list(deduplicated_leads.values())
        
        return jsonify({"success": True, "leads": leads})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/leads/<lead_id>', methods=['GET'])
def get_lead(lead_id):
    try:
        db = get_mongo_db()
        doc = db.leads.find_one({"id": lead_id})
        if not doc:
            return jsonify({"success": False, "error": "Lead not found"}), 404
        return jsonify({"success": True, "lead": doc_to_dict(doc)})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/leads', methods=['POST'])
def create_lead():
    try:
        payload = request.get_json(force=True) or {}
        name = (payload.get('name') or '').strip()
        phone = (payload.get('phone') or '').strip()
        city = (payload.get('city') or '').strip()
        if not name or not phone or not city:
            return jsonify({"success": False, "error": "Missing required fields: name, phone, city"}), 400

        created_at_raw = payload.get('createdAt')
        if created_at_raw:
            try:
                created_at = datetime.fromisoformat(created_at_raw.replace('Z', '+00:00'))
            except Exception:
                created_at = datetime.utcnow()
        else:
            created_at = datetime.utcnow()

        client_id = payload.get('id')
        try:
            u = uuid.UUID(str(client_id))
            doc_id = str(u)
        except Exception:
            doc_id = str(uuid.uuid4())

        default_stage = get_settings("defaultLeadStage", "New Lead")

        doc = {
            "id": doc_id,
            "name": name,
            "phone": phone,
            "phoneDigits": digits_only(phone),
            "email": payload.get('email') or '',
            "city": city,
            "value": float(payload.get('value') or 0),
            "source": payload.get('source') or '',
            "stage": payload.get('stage') or default_stage,
            "priority": payload.get('priority') or 'Warm',
            "assignedCaller": None,
            "assignedCallerName": None,
            "assignedAt": None,
            "callType": get_settings("defaultCallType", "Inbound"),
            "followUpTime": get_settings("defaultFollowUpTime", 24),
            "project": payload.get('project') or '-',
            "leadStatus": payload.get('leadStatus') or 'Active',
            "nextFollow": payload.get('nextFollow') or '-',
            "nextFollowDate": payload.get('nextFollowDate'),
            "createdAt": created_at,
            "notInterestedDetails": payload.get('notInterestedDetails', {}), # Include nested details
            "notInterestedReason": payload.get('notInterestedReason', ''),
            "notInterestedNote": payload.get('notInterestedNote', '')
        }

        db = get_mongo_db()
        db.leads.insert_one(doc)

        activity_doc = {
            "lead_id": doc_id,
            "activityType": "lead_created",
            "description": f"New lead added: {name}",
            "performedBy": session.get('caller_id') if session.get('caller_id') else 'unknown',
            "performedByName": session.get('user') if session.get('user') else 'unknown',
            "createdAt": datetime.utcnow()
        }
        db.activities.insert_one(activity_doc)

        if get_settings("autoAssignNewLeads", False):
            caller = get_next_caller_for_assignment()
            if caller:
                db.leads.update_one(
                    {"id": doc_id},
                    {"$set": {
                        "assignedCaller": str(caller.get('_id')),
                        "assignedCallerName": caller.get("username", ""),
                        "assignedAt": datetime.utcnow()
                    }}
                )
                
                doc['assignedCaller'] = str(caller.get('_id'))
                doc['assignedCallerName'] = caller.get("username", "")
                doc['assignedAt'] = datetime.utcnow()
                send_new_lead_notification(doc_id, doc)

        return jsonify({"success": True, "lead": {"id": doc_id}}), 201
    except pymongo.errors.DuplicateKeyError:
        try:
            db = get_mongo_db()
            new_id = str(uuid.uuid4())
            doc['id'] = new_id
            db.leads.insert_one(doc)
            return jsonify({"success": True, "lead": {"id": new_id}}), 201
        except Exception:
            traceback.print_exc()
            return jsonify({"success": False, "error": "Duplicate and retry failed"}), 500
    except Exception as e:
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/leads/<lead_id>', methods=['PUT'])
def update_lead(lead_id):
    try:
        payload = request.get_json(force=True)
        name = (payload.get('name') or '').strip()
        phone = (payload.get('phone') or '').strip()
        city = (payload.get('city') or '').strip()
        if not name or not phone or not city:
            return jsonify({"success": False, "error": "Missing required fields: name, phone, city"}), 400

        created_at_raw = payload.get('createdAt')
        try:
            created_at = datetime.fromisoformat(created_at_raw.replace('Z', '+00:00'))
        except Exception:
            created_at = datetime.utcnow()

        db = get_mongo_db()
        res = db.leads.update_one(
            {"id": lead_id},
            {"$set": {
                "name": name,
                "phone": phone,
                "phoneDigits": digits_only(phone),
                "email": payload.get('email') or '',
                "city": city,
                # value coming from frontend is expected to be numeric (INR). Store as float directly.
                "value": float(payload.get('value') or 0),
                "source": payload.get('source') or '',
                "stage": payload.get('stage') or 'New Lead',
                "priority": payload.get('priority') or 'Warm',
                "project": payload.get('project') or '-',
                "leadStatus": payload.get('leadStatus') or 'Active',
                "nextFollow": payload.get('nextFollow') or '-',
                "nextFollowDate": payload.get('nextFollowDate'),
                "callbackReason": payload.get('callbackReason', ''),
                "callbackNextFollowup": payload.get('callbackNextFollowup', ''),
                "notInterestedReason": payload.get('notInterestedReason', ''),
                "notInterestedNote": payload.get('notInterestedNote', ''),
                "notInterestedDetails": payload.get('notInterestedDetails', {}), # Include nested details
                "createdAt": created_at
            }}
        )
        if res.matched_count == 0:
            return jsonify({"success": False, "error": "Lead not found"}), 404
        return jsonify({"success": True})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/leads/<lead_id>', methods=['PATCH'])
def patch_lead(lead_id):
    try:
        payload = request.get_json(force=True)
        set_fields = {}
        for f in ['name','phone','email','city','value','source','stage','priority','project','leadStatus','nextFollow','nextFollowDate','callbackReason','callbackNextFollowup','notInterestedReason','notInterestedNote','notInterestedDetails']:
            if f in payload:
                if f == 'phone':
                    set_fields['phoneDigits'] = digits_only(payload.get('phone'))
                elif f == 'notInterestedDetails':
                    # If notInterestedDetails is sent as an object, store it directly
                    details = payload.get('notInterestedDetails', {})
                    set_fields['notInterestedDetails'] = details
                    set_fields['notInterestedReason'] = details.get('reason', '')
                    set_fields['notInterestedNote'] = details.get('note', '')
                else:
                    set_fields[f] = payload.get(f)
        if not set_fields:
            return jsonify({"success": False, "error": "No fields to update"}), 400

        db = get_mongo_db()
        res = db.leads.update_one({"id": lead_id}, {"$set": set_fields})
        if res.matched_count == 0:
            return jsonify({"success": False, "error": "Lead not found"}), 404
        return jsonify({"success": True})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/leads/<lead_id>', methods=['DELETE'])
@login_required
def delete_lead_api(lead_id):
    try:
        db = get_mongo_db()

        # Get lead info before deleting
        lead = db.leads.find_one({"id": lead_id})

        res = db.leads.delete_one({"id": lead_id})
        if res.deleted_count == 0:
            return jsonify({"success": False, "error": "Lead not found"}), 404

        audit_doc = {
            "action": "lead_deleted",
            "performedBy": session.get('user'),
            "target": lead_id,
            "details": f"Deleted lead: {lead.get('name', '')} ({lead.get('phone', '')})",
            "timestamp": datetime.utcnow()
        }

        db.audit_logs.insert_one(audit_doc)

        return jsonify({"success": True})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/leads/bulk-delete', methods=['POST'])
def bulk_delete_leads():
    try:
        payload = request.get_json(force=True)
        lead_ids = payload.get('ids') or []
        if not lead_ids or not isinstance(lead_ids, list):
            return jsonify({"success": False, "error": "No lead IDs provided"}), 400
        db = get_mongo_db()
        res = db.leads.delete_many({"id": {"$in": lead_ids}})
        return jsonify({"success": True, "deleted": res.deleted_count})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/leads/<lead_id>/stage', methods=['PATCH'])
def patch_stage(lead_id):
    try:
        payload = request.get_json(force=True)
        new_stage = payload.get('stage')
        if new_stage is None:
            return jsonify({"success": False, "error": "Missing 'stage'"}), 400

        db = get_mongo_db()

        # Get old stage before updating
        lead = db.leads.find_one({"id": lead_id})
        old_stage = lead.get('stage') if lead else None

        db.leads.update_one({"id": lead_id}, {"$set": {"stage": new_stage}})

        activity_doc = {
            "lead_id": lead_id,
            "activityType": "stage_change",
            "description": f"Stage changed from '{old_stage}' to '{new_stage}'",
            "performedBy": session.get('caller_id') if session.get('caller_id') else 'unknown',
            "performedByName": session.get('user') if session.get('user') else 'unknown',
            "oldValue": old_stage,
            "newValue": new_stage,
            "createdAt": datetime.utcnow()
        }

        db.activities.insert_one(activity_doc)

        # If new stage requires follow-up, calculate and log next follow-up date
        if new_stage in FOLLOWUP_INTERVALS and FOLLOWUP_INTERVALS[new_stage] is not None:
            # Try to get last call date to calculate next follow-up
            last_call = get_last_call_for_lead(lead_id)
            if last_call and last_call.get('createdAt'):
                next_followup_date = calculate_next_followup(last_call.get('createdAt'), new_stage)
                if next_followup_date:
                    db.leads.update_one(
                        {"id": lead_id},
                        {"$set": {"followUpTime": next_followup_date}} # Correct field name
                    )
                    activity_doc = {
                        "lead_id": lead_id,
                        "activityType": "follow_up_scheduled",
                        "description": f"Next follow-up scheduled for {next_followup_date.isoformat()}",
                        "performedBy": session.get('caller_id') if session.get('caller_id') else 'unknown',
                        "performedByName": session.get('user') if session.get('user') else 'unknown',
                        "nextFollowUpDate": next_followup_date,
                        "createdAt": datetime.utcnow()
                    }
                    db.activities.insert_one(activity_doc)

        return jsonify({"success": True})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/leads/<lead_id>/priority', methods=['PATCH'])
def patch_priority(lead_id):
    try:
        payload = request.get_json(force=True)
        new_priority = payload.get('priority')
        if new_priority is None:
            return jsonify({"success": False, "error": "Missing 'priority'"}), 400
        db = get_mongo_db()
        db.leads.update_one({"id": lead_id}, {"$set": {"priority": new_priority}})
        return jsonify({"success": True})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

# -----------------------
# Bulk import (merge by phone)
# -----------------------
@app.route('/api/leads/import', methods=['POST'])
def import_leads():
    try:
        payload = request.get_json(force=True)
        new_leads = payload.get('leads') or []
        if not isinstance(new_leads, list) or len(new_leads) == 0:
            return jsonify({"success": False, "error": "No leads provided"}), 400

        db = get_mongo_db()
        imported_count = 0
        new_leads_created = []

        auto_assign_enabled = get_settings("autoAssignNewLeads", False)

        for nl in new_leads:
            phone_raw = (nl.get('phone') or nl.get('number') or '').strip()
            phone_clean = digits_only(phone_raw)

            # ensure id (UUID string)
            try:
                lead_id = str(uuid.UUID(str(nl.get('id'))))
            except Exception:
                lead_id = str(uuid.uuid4())

            created_at_raw = nl.get('createdAt')
            if created_at_raw:
                try:
                    created_at = datetime.fromisoformat(created_at_raw.replace('Z', '+00:00'))
                except Exception:
                    created_at = datetime.utcnow()
            else:
                created_at = datetime.utcnow()

            # Update new tracking fields if they exist in the import payload
            doc_updates = {
                "project": nl.get('project', '-'),
                "leadStatus": nl.get('leadStatus', 'Active'),
                "nextFollow": nl.get('nextFollow', '-'),
                "callbackReason": nl.get('callbackReason', ''),
                "callbackNextFollowup": nl.get('callbackNextFollowup', ''),
                "notInterestedReason": nl.get('notInterestedReason', ''),
                "notInterestedNote": nl.get('notInterestedNote', ''),
                "notInterestedDetails": nl.get('notInterestedDetails', {}), # Include nested details from import
            }
            
            if phone_clean:
                # try exact phoneDigits match first
                existing = db.leads.find_one({"phoneDigits": phone_clean})
                if existing:
                    existing_id = existing.get('id')
                    merged = {
                        'name': nl.get('name') or existing.get('name'),
                        'phone': nl.get('phone') or existing.get('phone'),
                        'phoneDigits': digits_only(nl.get('phone') or existing.get('phone')),
                        'email': nl.get('email') or existing.get('email'),
                        'city': nl.get('city') or existing.get('city'),
                        'value': float(nl.get('value') or existing.get('value') or 0),
                        'source': nl.get('source') or existing.get('source'),  # Preserve source from import
                        'stage': nl.get('stage') or existing.get('stage'),
                        'priority': nl.get('priority') or existing.get('priority'),
                        **doc_updates # merge new tracking fields
                    }
                    db.leads.update_one({"id": existing_id}, {"$set": merged})
                    
                    activity_doc = {
                        "lead_id": existing_id,
                        "activityType": "lead_updated",
                        "description": f"Lead updated during import: {existing.get('name')}",
                        "performedBy": session.get('caller_id') if session.get('caller_id') else 'system',
                        "performedByName": session.get('user') if session.get('user') else 'system',
                        "createdAt": datetime.utcnow()
                    }
                    db.activities.insert_one(activity_doc)
                else:
                    doc = {
                        "id": lead_id,
                        "name": nl.get('name') or '',
                        "phone": nl.get('phone') or '',
                        "phoneDigits": phone_clean,
                        "email": nl.get('email') or '',
                        "city": nl.get('city') or '',
                        "value": float(nl.get('value') or 0),
                        "source": nl.get('source') or 'Manual Entry',  # Use source from import data
                        "stage": nl.get('stage') or get_settings("defaultLeadStage", "New Lead"),
                        "priority": nl.get('priority') or 'Warm',
                        "assignedCaller": None,
                        "assignedCallerName": None,
                        "assignedAt": None,
                        "callType": get_settings("defaultCallType", "Inbound"),
                        "followUpTime": get_settings("defaultFollowUpTime", 24),
                        "createdAt": created_at,
                        **doc_updates # add new tracking fields
                    }
                    db.leads.insert_one(doc)
                    new_leads_created.append(nl.get('name'))

                    activity_doc = {
                        "lead_id": lead_id,
                        "activityType": "lead_imported",
                        "description": f"Lead imported: {nl.get('name')}",
                        "performedBy": session.get('caller_id') if session.get('caller_id') else 'system',
                        "performedByName": session.get('user') if session.get('user') else 'system',
                        "createdAt": datetime.utcnow()
                    }
                    db.activities.insert_one(activity_doc)

                    if auto_assign_enabled:
                        caller = get_next_caller_for_assignment()
                        if caller:
                            db.leads.update_one(
                                {"id": lead_id},
                                {"$set": {
                                    "assignedCaller": str(caller.get('_id')),
                                    "assignedCallerName": caller.get("username", ""),
                                    "assignedAt": datetime.utcnow()
                                }}
                            )
                            send_new_lead_notification(lead_id, doc)
            else: # No phone number, create as new lead
                doc = {
                    "id": lead_id,
                    "name": nl.get('name') or '',
                    "phone": nl.get('phone') or '',
                    "phoneDigits": digits_only(nl.get('phone') or ''),
                    "email": nl.get('email') or '',
                    "city": nl.get('city') or '',
                    "value": float(nl.get('value') or 0),
                    "source": nl.get('source') or 'Manual Entry',  # Use source from import data
                    "stage": nl.get('stage') or get_settings("defaultLeadStage", "New Lead"),
                    "priority": nl.get('priority') or 'Warm',
                    "assignedCaller": None,
                    "assignedCallerName": None,
                    "assignedAt": None,
                    "callType": get_settings("defaultCallType", "Inbound"),
                    "followUpTime": get_settings("defaultFollowUpTime", 24),
                    "createdAt": created_at,
                    **doc_updates # add new tracking fields
                }
                db.leads.insert_one(doc)
                new_leads_created.append(nl.get('name'))

                activity_doc = {
                    "lead_id": lead_id,
                    "activityType": "lead_imported",
                    "description": f"Lead imported: {nl.get('name')}",
                    "performedBy": session.get('caller_id') if session.get('caller_id') else 'system',
                    "performedByName": session.get('user') if session.get('user') else 'system',
                    "createdAt": datetime.utcnow()
                }
                db.activities.insert_one(activity_doc)

                if auto_assign_enabled:
                    caller = get_next_caller_for_assignment()
                    if caller:
                        db.leads.update_one(
                            {"id": lead_id},
                            {"$set": {
                                "assignedCaller": str(caller.get('_id')),
                                "assignedCallerName": caller.get("username", ""),
                                "assignedAt": datetime.utcnow()
                            }}
                        )
                        send_new_lead_notification(lead_id, doc)

            imported_count += 1

        if new_leads_created:
            bulk_activity_doc = {
                "lead_id": "bulk_import",
                "activityType": "bulk_import",
                "description": f"Bulk import completed: {len(new_leads_created)} leads imported",
                "performedBy": session.get('caller_id') if session.get('caller_id') else 'system',
                "performedByName": session.get('user') if session.get('user') else 'system',
                "createdAt": datetime.utcnow()
            }
            db.activities.insert_one(bulk_activity_doc)

        return jsonify({"success": True, "imported": imported_count})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

# -----------------------
# Customers (from leads where stage == 'Won')
# -----------------------
@app.route('/api/customers', methods=['GET'])
@login_required
def get_customers():
    app.logger.debug("GET /api/customers called user=%s", session.get('user'))
    try:
        db = get_mongo_db()
        # return only leads that are closed/won
        cursor = db.leads.find({"stage": {"$in": ["Closed Won", "Won"]}}).sort("createdAt", DESCENDING)
        customers_list = [doc_to_dict(r) for r in cursor]
        return jsonify({"success": True, "customers": customers_list})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/leads/sync-to-customers', methods=['POST'])
@login_required
def sync_won_leads_to_customers():
    app.logger.debug("POST /api/leads/sync-to-customers called by user=%s", session.get('user'))
    try:
        db = get_mongo_db()
        # find all closed/won leads (include legacy stage name)
        won = list(db.leads.find({"stage": {"$in": ["Closed Won", "Won"]}}))
        inserted = 0
        for lead in won:
            if not db.customers.find_one({"lead_id": lead.get('id')}):
                cust = {
                    "lead_id": lead.get('id'),
                    "name": lead.get('name',''),
                    "phone": lead.get('phone',''),
                    "email": lead.get('email',''),
                    "company": lead.get('company',''),
                    "city": lead.get('city',''),
                    # lead.value is stored as numeric (INR) already; avoid reconversion
                    "value": float(lead.get('value') or 0),
                    "lifetime_value": float(lead.get('value') or 0),
                    "source": lead.get('source',''),
                    "priority": lead.get('priority',''),
                    "notes": '',
                    "createdAt": lead.get('createdAt', datetime.utcnow())
                }
                db.customers.insert_one(cust)
                inserted += 1
        return jsonify({"success": True, "inserted": inserted})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

# -----------------------
# Reports & analytics
# -----------------------
@app.route("/api/reports/leads")
def get_lead_reports():
    try:
        db = get_mongo_db()
        cursor = db.leads.find().sort("createdAt", DESCENDING)
        leads = []
        for r in cursor:
            leads.append({
                "id": r.get('id'),
                "name": r.get('name'),
                "source": r.get('source'),
                "stage": r.get('stage'),
                "value": float(r.get('value') or 0),
                "priority": r.get('priority'),
                "created_at": r.get('createdAt').strftime("%Y-%m-%d") if isinstance(r.get('createdAt'), datetime) else None,
            })
        return jsonify({"leads": leads})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route('/api/analytics/leads-by-source', methods=['GET'])
@login_required
def leads_by_source():
    try:
        db = get_mongo_db()
        pipeline = [
            {"$group": {"_id": {"$ifNull": ["$source", "Unknown"]},
                        "count": {"$sum": 1},
                        "total_value": {"$sum": {"$ifNull": ["$value", 0]}}}},
            {"$project": {"source": "$_id", "count": 1, "value": "$total_value", "_id": 0}},
            {"$sort": {"count": -1}}
        ]
        rows = list(db.leads.aggregate(pipeline))
        # cast types
        for r in rows:
            r['count'] = int(r['count'])
            r['value'] = float(r.get('value') or 0.0)
        return jsonify({"success": True, "data": rows})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/analytics/leads-by-priority', methods=['GET'])
@login_required
def leads_by_priority():
    try:
        db = get_mongo_db()
        pipeline = [
            {"$group": {"_id": {"$ifNull": ["$priority", "Unknown"]}, "count": {"$sum": 1}}},
            {"$project": {"priority": "$_id", "count": 1, "_id": 0}},
            {"$sort": {"count": -1}}
        ]
        rows = list(db.leads.aggregate(pipeline))
        for r in rows:
            r['count'] = int(r['count'])
        return jsonify({"success": True, "data": rows})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/analytics/leads-trend', methods=['GET'])
@login_required
def leads_trend():
    try:
        db = get_mongo_db()
        pipeline = [
            {"$project": {"month": {"$dateToString": {"format": "%Y-%m", "date": "$createdAt"}}}},
            {"$group": {"_id": "$month", "count": {"$sum": 1}}},
            {"$project": {"month": "$_id", "count": 1, "_id": 0}},
            {"$sort": {"month": 1}}
        ]
        rows = list(db.leads.aggregate(pipeline))
        for r in rows:
            r['count'] = int(r['count'])
        return jsonify({"success": True, "data": rows})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/pipeline/summary', methods=['GET'])
@login_required
def pipeline_summary():
    try:
        db = get_mongo_db()
        pipeline = [
            {"$group": {"_id": {"$ifNull": ["$stage", "Unknown"]},
                        "count": {"$sum": 1},
                        "total_value": {"$sum": {"$ifNull": ["$value", 0]}}}},
            {"$project": {"stage": "$_id", "count": 1, "value": "$total_value", "_id": 0}},
            {"$sort": {"count": -1}}
        ]
        rows = list(db.leads.aggregate(pipeline))
        for r in rows:
            r['count'] = int(r['count'])
            r['value'] = float(r.get('value') or 0.0)
        return jsonify({"success": True, "summary": rows})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/sidebar-stats')
@login_required
def get_sidebar_stats():
    """Get sidebar statistics (leads count, pipeline count)"""
    try:
        db = get_mongo_db()
        query = {}
        
        if session.get('user') and session.get('role') != 'admin':
            caller_id = session.get('caller_id')
            if caller_id:
                query['assignedCaller'] = caller_id
        
        # Get all leads and apply deduplication
        all_leads = list(db.leads.find(query))
        leads = deduplicate_leads(all_leads)

        # Count total leads (after deduplication)
        total_leads = len(leads)

        # Count leads in pipeline (non-Won/Closed Won stages)
        pipeline_count = len([l for l in leads if l.get('stage') not in ["Closed Won", "Won", ""]])

        # Count today's new leads
        today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        new_today = len([l for l in leads if l.get('createdAt', datetime.min) >= today])

        # Calculate total value of leads
        total_value = sum([float(l.get('value') or 0) for l in leads])

        return jsonify({
            "success": True,
            "total_leads": total_leads,
            "pipeline_count": pipeline_count,
            "new_today": new_today,
            "total_value": total_value
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/home-stats', methods=['GET'])
def get_home_stats():
    """Get home page statistics"""
    try:
        db = get_mongo_db()
        
        caller_id = session.get('caller_id')
        user_role = session.get('role', 'viewer')
        
        query = {}
        if user_role == 'Caller' and caller_id:
            query = {'assignedCaller': caller_id}

        # Get all leads and apply deduplication
        all_leads = list(db.leads.find(query))
        leads = deduplicate_leads(all_leads)

        # Count total leads
        total_leads = len(leads)

        closed_won = len([l for l in leads if l.get('stage') in ["Closed Won", "Won"]])

        # Calculate conversion rate (leads that are Closed Won / total leads)
        conversion_rate = (closed_won / total_leads * 100) if total_leads > 0 else 0

        # Count active deals (leads not in Won or Lost stages)
        active_deals = len([l for l in leads if l.get('stage') not in ["Closed Won", "Won", "Closed Lost", ""]])

        return jsonify({
            "success": True,
            "stats": {
                "total_leads": total_leads,
                "conversion_rate": round(conversion_rate, 1),
                "active_deals": active_deals
            }
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/user-profile', methods=['GET'])
def get_user_profile():
    """Get current user profile information"""
    try:
        username = session.get('user')
        user_role = session.get('role')
        
        if not username:
            return jsonify({"success": False, "error": "Not authenticated"}), 401
        
        return jsonify({
            "success": True,
            "user": {
                "username": username,
                "email": session.get('email', ''),
                "role": user_role or 'User'
            }
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500


# -----------------------
# New API endpoints
# -----------------------
@app.route('/api/settings', methods=['GET', 'POST'])
@login_required
def api_settings():
    """Get or save settings (admin only)"""
    if request.method == 'GET':
        try:
            db = get_mongo_db()
            settings_docs = db.settings.find()
            settings = {}
            for doc in settings_docs:
                settings[doc['key']] = doc.get('value')
            return jsonify({"success": True, "settings": settings})
        except Exception as e:
            traceback.print_exc()
            return jsonify({"success": False, "error": str(e)}), 500
    
    # POST - Save settings
    if session.get('role') != 'admin':
        return jsonify({"success": False, "error": "Unauthorized"}), 403
    
    try:
        payload = request.get_json(force=True) or {}
        db = get_mongo_db()
        
        key_mapping = {
            'emailNotificationsEnabled': 'email_notifications_enabled',
            'smtp_server': 'smtp_server',
            'smtp_port': 'smtp_port',
            'sender_email': 'sender_email',
            'sender_password': 'sender_password',
            'notifyOnAssignment': 'notify_on_lead_assigned',
            'notifyOnStageChange': 'notify_on_stage_changes',
        }
        
        for frontend_key, backend_key in key_mapping.items():
            if frontend_key in payload:
                value = payload[frontend_key]
                db.settings.update_one(
                    {"key": backend_key},
                    {"$set": {"value": value, "updatedAt": datetime.utcnow()}},
                    upsert=True
                )
                print(f"[v0] Saved {backend_key} = {value if backend_key != 'sender_password' else '***'}")
        
        # Also save any other keys that don't need mapping
        for key, value in payload.items():
            if key not in key_mapping:
                db.settings.update_one(
                    {"key": key},
                    {"$set": {"value": value, "updatedAt": datetime.utcnow()}},
                    upsert=True
                )
                print(f"[v0] Saved {key} = {value}")
        
        print("[v0] All settings saved to MongoDB successfully")
        return jsonify({"success": True, "message": "Settings saved to MongoDB"})
    except Exception as e:
        print(f"[v0] Error saving settings: {str(e)}")
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

# API endpoints for Call Logging
# -----------------------
@app.route('/api/calls', methods=['POST'])
@login_required
def log_call():
    """Log a call made by a caller on a lead"""
    try:
        payload = request.get_json(force=True) or {}
        lead_id = payload.get('lead_id')
        call_type = payload.get('call_type', 'Inbound')
        duration = int(payload.get('duration', 0))  # in seconds
        notes = payload.get('notes', '')
        next_follow_up = payload.get('nextFollowUpDate')

        if not lead_id:
            return jsonify({"success": False, "error": "lead_id is required"}), 400

        db = get_mongo_db()

        # Verify lead exists
        lead = db.leads.find_one({"id": lead_id})
        if not lead:
            return jsonify({"success": False, "error": "Lead not found"}), 404

        # Create call record
        call_doc = {
            "lead_id": lead_id,
            "caller_id": session.get('caller_id'),
            "caller_name": session.get('user'),
            "callType": call_type,
            "duration": duration,
            "notes": notes,
            "nextFollowUpDate": next_follow_up,
            "status": "Completed",
            "createdAt": datetime.utcnow()
        }

        db.calls.insert_one(call_doc)

        activity_doc = {
            "lead_id": lead_id,
            "activityType": "call",
            "description": f"Call logged ({call_type}) - {duration}s duration",
            "performedBy": session.get('caller_id'),
            "performedByName": session.get('user'),
            "callType": call_type,
            "duration": duration,
            "createdAt": datetime.utcnow()
        }

        db.activities.insert_one(activity_doc)
        
        # Update follow-up date in lead if next_follow_up is provided
        if next_follow_up:
            try:
                next_followup_dt = datetime.fromisoformat(next_follow_up.replace('Z', '+00:00'))
                db.leads.update_one(
                    {"id": lead_id},
                    {"$set": {"followUpTime": next_followup_dt}}
                )
                activity_doc = {
                    "lead_id": lead_id,
                    "activityType": "follow_up_scheduled",
                    "description": f"Next follow-up scheduled for {next_followup_dt.isoformat()}",
                    "performedBy": session.get('caller_id'),
                    "performedByName": session.get('user'),
                    "nextFollowUpDate": next_followup_dt,
                    "createdAt": datetime.utcnow()
                }
                db.activities.insert_one(activity_doc)
            except Exception as e:
                app.logger.warning(f"Could not set follow-up date from call log: {e}")

        return jsonify({"success": True, "message": "Call logged successfully"})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/calls/<lead_id>', methods=['GET'])
@login_required
def get_lead_calls(lead_id):
    """Get all calls for a lead"""
    try:
        db = get_mongo_db()
        calls = list(db.calls.find({"lead_id": lead_id}).sort("createdAt", DESCENDING))

        calls_data = []
        for call in calls:
            calls_data.append({
                "id": str(call.get('_id')),
                "lead_id": call.get('lead_id'),
                "caller_name": call.get('caller_name'),
                "callType": call.get('callType'),
                "duration": call.get('duration'),
                "notes": call.get('notes'),
                "status": call.get('status'),
                "createdAt": call.get('createdAt').isoformat() if isinstance(call.get('createdAt'), datetime) else str(call.get('createdAt'))
            })

        return jsonify({"success": True, "calls": calls_data})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

# -----------------------
# Activity Logging endpoints
# -----------------------
@app.route('/api/activities/<lead_id>', methods=['GET'])
@login_required
def get_lead_activities(lead_id):
    """Get activity timeline for a lead"""
    try:
        db = get_mongo_db()
        activities = list(db.activities.find({"lead_id": lead_id}).sort("createdAt", -1))

        for act in activities:
            if "_id" in act:
                act["_id"] = str(act["_id"])
            if "createdAt" in act:
                act["createdAt"] = iso_from_maybe_dt(act["createdAt"])

        return jsonify({"success": True, "activities": activities})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/home-activities', methods=['GET'])
def get_home_recent_activities():
    """Get recent activities across all leads for home page"""
    try:
        db = get_mongo_db()
        limit = int(request.args.get('limit', 5))
        
        # Get recent activities across all leads, sorted by createdAt descending
        activities = list(db.activities.find().sort("createdAt", DESCENDING).limit(limit))
        
        activities_data = []
        for act in activities:
            activity_item = {
                "id": str(act.get('_id')),
                "lead_id": act.get('lead_id'),
                "activityType": act.get('activityType'),
                "description": act.get('description'),
                "performedByName": act.get('performedByName', 'Unknown'),
                "createdAt": iso_from_maybe_dt(act.get('createdAt'))
            }
            activities_data.append(activity_item)
        
        return jsonify({
            "success": True,
            "activities": activities_data
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

# -----------------------
# Log activity when lead is assigned
# -----------------------
@app.route('/api/leads/<lead_id>/assign', methods=['PATCH'])
@login_required
def assign_lead_to_caller(lead_id):
    """Assign a lead to a specific caller and send email notification"""
    if session.get('role') != 'admin':
        return jsonify({"success": False, "error": "Unauthorized"}), 403
    try:
        payload = request.get_json(force=True) or {}
        caller_id = payload.get('callerId')

        if not caller_id:
            return jsonify({"success": False, "error": "callerId is required"}), 400

        db = get_mongo_db()
        from bson import ObjectId

        # Verify caller exists
        try:
            oid = ObjectId(caller_id)
            caller = db.callers.find_one({"_id": oid})
            if not caller:
                return jsonify({"success": False, "error": "Caller not found"}), 404
        except:
            return jsonify({"success": False, "error": "Invalid caller ID"}), 400

        # Get lead details
        lead = db.leads.find_one({"id": lead_id})
        if not lead:
            return jsonify({"success": False, "error": "Lead not found"}), 404

        # Update lead with assigned caller
        res = db.leads.update_one(
            {"id": lead_id},
            {"$set": {
                "assignedCaller": caller_id,
                "assignedCallerName": caller.get("username", ""),
                "assignedAt": datetime.utcnow()
            }}
        )

        if res.matched_count == 0:
            return jsonify({"success": False, "error": "Lead not found"}), 404

        caller_email = caller.get('email')
        caller_name = caller.get('name') or caller.get('username', 'Caller')
        
        if caller_email and caller_email.strip():
            email_body = create_lead_assignment_email(
                caller_name=caller_name,
                lead_name=lead.get('name', 'Unknown'),
                lead_phone=lead.get('phone', ''),
                lead_email=lead.get('email', ''),
                lead_value=lead.get('value', 0),
                lead_source=lead.get('source', ''),
                lead_city=lead.get('city', '')
            )
            
            email_sent = send_email(
                recipient_email=caller_email,
                subject=f"New Lead Assigned: {lead.get('name', 'Unknown')}",
                html_body=email_body,
                caller_name=caller_name
            )
            
            if email_sent:
                app.logger.info(f"Assignment notification email sent to {caller_email}")
        else:
            app.logger.warning(f"Caller {caller.get('username')} has no email address configured")

        # Create activity log
        activity_doc = {
            "lead_id": lead_id,
            "activityType": "assigned",
            "description": f"Assigned to {caller.get('username', '')}",
            "performedBy": session.get('caller_id'),
            "performedByName": session.get('user'),
            "createdAt": datetime.utcnow()
        }

        db.activities.insert_one(activity_doc)

        # Create audit log
        audit_doc = {
            "action": "lead_assigned",
            "performedBy": session.get('user'),
            "target": lead_id,
            "details": f"Lead assigned to {caller.get('username', '')}",
            "timestamp": datetime.utcnow()
        }

        db.audit_logs.insert_one(audit_doc)

        return jsonify({"success": True, "message": "Lead assigned successfully"})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500


# -----------------------
# Get audit logs (admin only)
# -----------------------
@app.route('/api/audit-logs', methods=['GET'])
@login_required
def get_audit_logs():
    """Get audit logs (admin only)"""
    if session.get('role') != 'admin':
        return jsonify({"success": False, "error": "Unauthorized"}), 403
    try:
        db = get_mongo_db()
        limit = int(request.args.get('limit', 100))

        logs = list(db.audit_logs.find().sort("timestamp", DESCENDING).limit(limit))

        logs_data = []
        for log in logs:
            logs_data.append({
                "id": str(log.get('_id')),
                "action": log.get('action'),
                "performedBy": log.get('performedBy'),
                "target": log.get('target'),
                "details": log.get('details'),
                "timestamp": log.get('timestamp').isoformat() if isinstance(log.get('timestamp'), datetime) else str(log.get('timestamp'))
            })

        return jsonify({"success": True, "logs": logs_data})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/analytics/dashboard', methods=['GET'])
@login_required
def analytics_dashboard():
    """Get comprehensive analytics data for the dashboard"""
    try:
        db = get_mongo_db()
        
        # Parse date filters from query params
        from_date_str = request.args.get('fromDate')
        to_date_str = request.args.get('toDate')
        source_filter = request.args.get('source', 'all')
        
        # Build date range filter
        date_filter = {}
        if from_date_str:
            date_filter['$gte'] = datetime.fromisoformat(from_date_str.replace('Z', '+00:00'))
        if to_date_str:
            to_date = datetime.fromisoformat(to_date_str.replace('Z', '+00:00'))
            to_date = to_date.replace(hour=23, minute=59, second=59)
            date_filter['$lte'] = to_date
        
        # Build base query
        query = {}
        if date_filter:
            query['createdAt'] = date_filter
        if source_filter and source_filter != 'all':
            query['source'] = source_filter
        
        # instead of N+1 queries
        last_calls_by_lead = {}
        # Aggregate calls to get the last call for each lead within the date range if specified
        call_aggregation_pipeline = [
            {"$sort": {"createdAt": -1}},
            {"$group": {
                "_id": "$lead_id",
                "lastCall": {"$first": "$$ROOT"}
            }}
        ]
        if date_filter:
            call_aggregation_pipeline.insert(0, {"$match": {"createdAt": date_filter}})
        
        last_calls = list(db.calls.aggregate(call_aggregation_pipeline))
        
        for call_doc in last_calls:
            if call_doc.get('_id'):
                last_calls_by_lead[call_doc['_id']] = call_doc.get('lastCall', {})
        
        # Get all filtered leads and apply deduplication
        all_leads = list(db.leads.find(query))
        leads = deduplicate_leads(all_leads)
        
        # Calculate KPIs
        total_leads = len(leads)
        
        # Count leads that had calls logged within the date range
        leads_contacted = db.calls.count_documents({
            "lead_id": {"$in": [l.get('id') for l in leads]},
            "createdAt": date_filter
        } if date_filter else {"lead_id": {"$in": [l.get('id') for l in leads]}})
        
        leads_converted = len([l for l in leads if l.get('stage') in ['Closed Won', 'Won']])
        
        missed_followups = 0
        for lead in leads:
            last_call = last_calls_by_lead.get(lead.get('id'))
            if last_call:
                next_followup = calculate_next_followup(last_call.get('createdAt'), lead.get('stage'))
                if next_followup and next_followup < datetime.utcnow() and lead.get('stage') not in ['Closed Won', 'Won', 'Closed Lost']:
                    missed_followups += 1
        
        total_calls = db.calls.count_documents({"createdAt": date_filter} if date_filter else {})
        
        source_dist = {}
        for lead in leads:
            source = lead.get('source', 'Unknown')
            source_dist[source] = source_dist.get(source, 0) + 1
        source_data = [{"source": k, "count": v} for k, v in sorted(source_dist.items(), key=lambda x: x[1], reverse=True)]
        
        followup_statuses = {
            'Pending': 0,
            'Done': 0,
            'Missed': 0,
            'Overdue': 0,
        }
        
        for lead in leads:
            stage = lead.get('stage', '')
            if stage in ['Closed Won', 'Won']:
                followup_statuses['Done'] += 1
            elif stage in ['Closed Lost', 'Lost']:
                followup_statuses['Missed'] += 1
            else:
                # Check the last_calls_by_lead map instead of querying DB again for each lead
                last_call = last_calls_by_lead.get(lead.get('id'))
                if last_call:
                    next_followup = calculate_next_followup(last_call.get('createdAt'), stage)
                    if next_followup:
                        if next_followup < datetime.utcnow():
                            followup_statuses['Overdue'] += 1
                        else:
                            followup_statuses['Pending'] += 1
                    else: # No next follow-up defined for this stage/call combination
                        followup_statuses['Done'] += 1
                else: # No calls logged for this lead yet
                    followup_statuses['Pending'] += 1
        
        team_data = {}
        for lead in leads:
            if lead.get('assignedCallerName'):
                member = lead.get('assignedCallerName')
                if member not in team_data:
                    team_data[member] = {'calls': 0, 'conversions': 0}
                team_data[member]['calls'] += 1
                if lead.get('stage') in ['Closed Won', 'Won']:
                    team_data[member]['conversions'] += 1
        
        team_list = []
        for member, data in team_data.items():
            conv_rate = (data['conversions'] / data['calls'] * 100) if data['calls'] > 0 else 0
            team_list.append({
                'member': member,
                'calls': data['calls'],
                'conversions': data['conversions'],
                'conversionRate': conv_rate
            })
        
        team_list = sorted(team_list, key=lambda x: x['calls'], reverse=True)
        
        # Add unassigned member
        unassigned_leads = [l for l in leads if not l.get('assignedCaller')]
        unassigned_count = len(unassigned_leads)
        unassigned_conv = len([l for l in unassigned_leads if l.get('stage') in ['Closed Won', 'Won']])
        if unassigned_count > 0:
            team_list.append({
                'member': 'Unassigned',
                'calls': unassigned_count, # Count of unassigned leads can represent initial contact count
                'conversions': unassigned_conv,
                'conversionRate': 0.0 # Conversion rate for unassigned typically not calculated this way
            })
        
        # Get leads that are in progress for the followup tracker
        in_progress_leads = [l for l in leads if l.get('stage') not in ['Closed Won', 'Won', 'Closed Lost', 'Lost']]
        followup_leads = sorted(
            in_progress_leads,
            key=lambda x: x.get('createdAt', datetime.min), # Sort by creation date to show older leads first if no follow-up date yet
            reverse=True
        )[:10]
        
        followup_data = []
        for lead in followup_leads:
            # Use last_calls_by_lead map here as well
            last_call = last_calls_by_lead.get(lead.get('id'))
            last_call_date = last_call.get('createdAt') if last_call else None
            next_followup = calculate_next_followup(last_call_date, lead.get('stage')) if last_call_date else None
            
            followup_data.append({
                "id": lead.get('id'),
                "name": lead.get('name'),
                "lastCallDate": last_call_date.isoformat() if isinstance(last_call_date, datetime) else None,
                "nextFollowup": next_followup.isoformat() if isinstance(next_followup, datetime) else None,
                "status": lead.get('stage'),
                "assignedTo": lead.get('assignedCallerName') or 'Unassigned'
            })
        
        # Add Conversions by day (last 7 days)
        conversions_by_day = {}
        for i in range(7):
            d = datetime.utcnow() - timedelta(days=i)
            day_key = d.strftime('%m-%d')
            conversions_by_day[day_key] = 0
        
        # Filter leads for conversion calculation based on provided date range
        converted_leads_in_range = [l for l in leads if l.get('stage') in ['Closed Won', 'Won']]
        for lead in converted_leads_in_range:
            created = lead.get('createdAt')
            if isinstance(created, datetime):
                day_key = created.strftime('%m-%d')
                if day_key in conversions_by_day:
                    conversions_by_day[day_key] += 1
        
        # Add Calls per day (last 7 days)
        calls_by_day = {}
        for i in range(7):
            d = datetime.utcnow() - timedelta(days=i)
            day_key = d.strftime('%m-%d')
            calls_by_day[day_key] = 0
        
        # Filter calls for daily calculation based on provided date range
        calls_in_range = db.calls.find({"createdAt": date_filter} if date_filter else {})
        for call in calls_in_range:
            created = call.get('createdAt')
            if isinstance(created, datetime):
                day_key = created.strftime('%m-%d')
                if day_key in calls_by_day:
                    calls_by_day[day_key] += 1
        
        return jsonify({
            "success": True,
            "kpis": {
                "totalLeads": total_leads,
                "leadsContacted": leads_contacted,
                "leadsConverted": leads_converted,
                "missedFollowups": missed_followups,
                "totalCalls": total_calls
            },
            "sourceDistribution": source_data,
            "followupStatus": followup_statuses,
            "teamPerformance": team_list,
            "followupTracker": followup_data,
            "conversionsByDay": conversions_by_day,
            "callsByDay": calls_by_day
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/reports/advanced', methods=['GET'])
@login_required
def advanced_reports():
    """Get comprehensive advanced reports data for real estate CRM"""
    try:
        db = get_mongo_db()
        
        # Parse date filters
        from_date_str = request.args.get('fromDate')
        to_date_str = request.args.get('toDate')
        
        # Build date range filter
        date_filter = {}
        if from_date_str:
            date_filter['$gte'] = datetime.fromisoformat(from_date_str.replace('Z', '+00:00'))
        if to_date_str:
            to_date = datetime.fromisoformat(to_date_str.replace('Z', '+00:00'))
            to_date = to_date.replace(hour=23, minute=59, second=59)
            date_filter['$lte'] = to_date
        
        # Build base query
        query = {}
        if date_filter:
            query['createdAt'] = date_filter
        
        all_leads = list(db.leads.find(query))
        leads = deduplicate_leads(all_leads)
        
        # 1. QUICK STATS (Real Estate Metrics)
        active_listings = len([l for l in leads if l.get('stage') not in ['Closed Won', 'Won']])
        pipeline_value = sum([float(l.get('value', 0)) for l in leads if l.get('stage') not in ['Closed Won', 'Won', 'Closed Lost']])
        
        # Sold this month
        now = datetime.utcnow()
        current_month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        sold_this_month = len([l for l in leads if l.get('stage') in ['Closed Won', 'Won'] and l.get('createdAt') >= current_month_start])
        
        # Average days on market (if listedDate and soldDate exist)
        avg_dom = 0
        closed_deals = [l for l in leads if l.get('stage') in ['Closed Won', 'Won']]
        if closed_deals:
            total_days = 0
            for deal in closed_deals:
                # Simulate DOM calculation based on created to now
                if isinstance(deal.get('createdAt'), datetime):
                    days = (datetime.utcnow() - deal.get('createdAt')).days
                    total_days += days
            avg_dom = total_days // len(closed_deals) if closed_deals else 0
        
        # 2. MONTHLY LISTINGS METRICS
        months_list = []
        for i in range(11, -1, -1):
            month_date = now.replace(day=1) - timedelta(days=30*i)
            month_start = month_date.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            month_end = (month_start + timedelta(days=32)).replace(day=1) - timedelta(seconds=1)
            
            current_month_closed_count = len([l for l in leads if l.get('stage') in ['Closed Won', 'Won'] and month_start <= l.get('createdAt', datetime.min) <= month_end])
            current_month_value = sum([float(l.get('value', 0)) for l in leads if l.get('stage') in ['Closed Won', 'Won'] and month_start <= l.get('createdAt', datetime.min) <= month_end])
            
            months_list.append({
                'month': month_date.strftime('%b'),
                'closed': current_month_closed_count,
                'value': current_month_value
            })
        
        current_month_closed = months_list[-1]['closed'] if months_list else 0
        last_month_closed = months_list[-2]['closed'] if len(months_list) > 1 else 0
        ytd_closed = sum([m['closed'] for m in months_list])
        avg_monthly = ytd_closed / len(months_list) if months_list else 0
        projected_closings = int(avg_monthly * (12 - now.month))
        
        # 3. LEAD SOURCE PERFORMANCE
        # Using the deduplicated leads for performance analysis
        source_dist_perf = {}
        for lead in leads:
            source = lead.get('source', 'Unknown')
            if source not in source_dist_perf:
                source_dist_perf[source] = {'total_leads': 0, 'converted': 0, 'total_value': 0}
            
            source_dist_perf[source]['total_leads'] += 1
            source_dist_perf[source]['total_value'] += float(lead.get('value', 0))
            if lead.get('stage') in ['Closed Won', 'Won']:
                source_dist_perf[source]['converted'] += 1
        
        source_data = []
        for source, data in source_dist_perf.items():
            conversion_rate = (data['converted'] / data['total_leads'] * 100) if data['total_leads'] > 0 else 0
            avg_deal_value = (data['total_value'] / data['converted']) if data['converted'] > 0 else 0
            source_data.append({
                "source": source,
                "total_leads": data['total_leads'],
                "converted": data['converted'],
                "conversion_rate": round(conversion_rate, 1),
                "revenue_generated": float(data['total_value']),
                "avg_deal_value": round(avg_deal_value, 2)
            })
        source_data.sort(key=lambda x: x['total_leads'], reverse=True)
        
        
        # 4. STAGE-BY-STAGE ANALYSIS (Conversion Funnel)
        stages = ['New Lead', 'Contacted', 'Negotiation', 'Proposal', 'Closed Won']
        funnel_data = []
        
        # Determine counts and values per stage using the filtered and deduplicated leads
        stage_counts = {stage: 0 for stage in stages}
        stage_values = {stage: 0.0 for stage in stages}
        
        for lead in leads:
            stage = lead.get('stage')
            if stage in stages:
                stage_counts[stage] += 1
                stage_values[stage] += float(lead.get('value', 0))

        total_in_previous = len(leads) # Start with total leads for the first stage's conversion rate
        
        for stage in stages:
            current_stage_count = stage_counts[stage]
            current_stage_value = stage_values[stage]
            
            conversion_rate = (current_stage_count / total_in_previous * 100) if total_in_previous > 0 else 0
            dropoff_rate = 100 - conversion_rate if stage != stages[-1] else 0
            
            # Calculate average time in stage (days between creation and now for leads in this stage)
            avg_time = 0
            stage_specific_leads = [l for l in leads if l.get('stage') == stage]
            if stage_specific_leads:
                total_days = sum([(datetime.utcnow() - l.get('createdAt', datetime.utcnow())).days for l in stage_specific_leads])
                avg_time = total_days // len(stage_specific_leads)
            
            funnel_data.append({
                'stage': stage,
                'total_deals': current_stage_count,
                'total_value': float(current_stage_value),
                'conversion_rate': round(conversion_rate, 1),
                'dropoff_rate': round(dropoff_rate, 1),
                'avg_time_in_stage': avg_time
            })
            
            total_in_previous = current_stage_count # For the next stage, the denominator is the count of the current stage
        
        # 5. PRIORITY INSIGHTS (Hot/Warm/Cold Leads)
        priority_groups = {'Hot': 0, 'Warm': 0, 'Cold': 0}
        priority_values = {'Hot': 0, 'Warm': 0, 'Cold': 0}
        
        for lead in leads:
            priority = lead.get('priority', 'Warm')
            if priority in priority_groups:
                priority_groups[priority] += 1
                priority_values[priority] += float(lead.get('value', 0))
        
        # 6. TOP 10 OPPORTUNITIES
        sorted_leads = sorted(leads, key=lambda x: float(x.get('value', 0)), reverse=True)[:10]
        top_opportunities = []
        
        for lead in sorted_leads:
            age_days = (datetime.utcnow() - lead.get('createdAt', datetime.utcnow())).days
            stage = lead.get('stage', 'Unknown')
            
            # Win probability based on stage
            win_probability = {
                'New Lead': 10,
                'Contacted': 25,
                'Negotiation': 60,
                'Proposal': 80,
                'Closed Won': 100,
                'Closed Lost': 0
            }.get(stage, 50)
            
            top_opportunities.append({
                'name': lead.get('name', ''),
                'company': lead.get('city', ''), # Using city as company name placeholder
                'value': float(lead.get('value', 0)),
                'stage': stage,
                'priority': lead.get('priority', 'Warm'),
                'age_days': age_days,
                'win_probability': win_probability
            })
        
        # 7. TIME-BASED ANALYTICS
        leads_by_day = {}
        deals_by_month = {}
        
        # Daily lead creation (last 7 days)
        for i in range(6, -1, -1):
            d = datetime.utcnow() - timedelta(days=i)
            day_key = d.strftime('%a') # Abbreviated day name (Mon, Tue, etc.)
            leads_by_day[day_key] = 0
        
        for lead in leads:
            created = lead.get('createdAt')
            if isinstance(created, datetime):
                day_key = created.strftime('%a')
                if day_key in leads_by_day:
                    leads_by_day[day_key] += 1
        
        # Monthly deal closures (last 12 months)
        for i in range(11, -1, -1):
            month_date = now.replace(day=1) - timedelta(days=30*i)
            month_key = month_date.strftime('%b') # Abbreviated month name (Jan, Feb, etc.)
            deals_by_month[month_key] = 0
            
        for lead in leads:
            if lead.get('stage') in ['Closed Won', 'Won']:
                created = lead.get('createdAt')
                if isinstance(created, datetime):
                    month_key = created.strftime('%b')
                    if month_key in deals_by_month:
                        deals_by_month[month_key] += 1
        
        # 8. EXECUTIVE SUMMARY
        performance_highlights = [
            f"Total Pipeline Value: ₹{pipeline_value:,.0f}",
            f"Active Listings: {active_listings}",
            f"Overall Conversion Rate: {(len([l for l in leads if l.get('stage') in ['Closed Won', 'Won']]) / len(leads) * 100) if leads else 0:.1f}%",
            f"Average Days on Market: {avg_dom} days"
        ]
        
        improvement_areas = [
            "Focus on leads in 'Negotiation' stage for quicker conversion",
            "Improve follow-up consistency to reduce missed opportunities",
            f"Analyze and address underperforming lead sources",
            f"Aim to increase overall conversion rate by 15%"
        ]
        
        recommendations = [
            "Prioritize 'Hot' leads for immediate engagement",
            "Implement automated follow-up reminders based on stage",
            "Analyze patterns in successful deals to replicate them",
            "Increase marketing investment in top-performing lead sources"
        ]
        
        return jsonify({
            "success": True,
            "quickStats": {
                "activeListings": active_listings,
                "pipelineValue": float(pipeline_value),
                "soldThisMonth": sold_this_month,
                "avgDOM": avg_dom
            },
            "monthlyMetrics": {
                "currentMonthClosed": current_month_closed,
                "lastMonthClosed": last_month_closed,
                "ytdClosed": ytd_closed,
                "projectedClosings": projected_closings,
                "months": months_list
            },
            "sourcePerformance": source_data,
            "funnelAnalysis": funnel_data,
            "priorityInsights": {
                "hot": {"count": priority_groups['Hot'], "value": float(priority_values['Hot'])},
                "warm": {"count": priority_groups['Warm'], "value": float(priority_values['Warm'])},
                "cold": {"count": priority_groups['Cold'], "value": float(priority_values['Cold'])}
            },
            "topOpportunities": top_opportunities,
            "timeAnalytics": {
                "leadsByDay": leads_by_day,
                "dealsByMonth": deals_by_month
            },
            "executiveSummary": {
                "highlights": performance_highlights,
                "improvements": improvement_areas,
                "recommendations": recommendations
            }
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500


# -----------------------
# Start app
# -----------------------
if __name__ == '__main__':
    print("Starting CRM Flask app with MongoDB integration...")
    port = int(os.environ.get('PORT', 5000))
    debug_mode = os.environ.get('FLASK_DEBUG', '1') == '1'
    # On Windows the watchdog reloader can cause OSError 10038; disable the reloader to avoid crashes.
    app.run(host='0.0.0.0', port=port, debug=debug_mode, use_reloader=False)

