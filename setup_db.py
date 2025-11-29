# Python script to create MongoDB collections with proper schema

from pymongo import MongoClient, ASCENDING, DESCENDING
from datetime import datetime
import os

def setup_database():
    # Update these credentials with your MongoDB Atlas cluster details
    MONGO_URI = "mongodb+srv://ismail:ismail123@cluster0.t63ghmf.mongodb.net/?appName=Cluster0"
    DB_NAME = "crmdb"
    
    try:
        # Connect to MongoDB Atlas
        client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
        # Test connection
        client.admin.command('ping')
        print("✅ Connected to MongoDB Atlas successfully!")
    except Exception as e:
        print(f"❌ Failed to connect to MongoDB: {e}")
        print("\nTroubleshooting:")
        print("1. Check your MongoDB Atlas connection string")
        print("2. Make sure your IP is whitelisted in MongoDB Atlas Network Access")
        print("3. Verify username and password are correct")
        return
    
    db = client[DB_NAME]
    
    # 1. Create CALLS Collection
    try:
        db.create_collection('calls')
    except:
        pass
    
    calls_collection = db['calls']
    calls_collection.create_index([('lead_id', ASCENDING)])
    calls_collection.create_index([('caller_id', ASCENDING)])
    calls_collection.create_index([('createdAt', DESCENDING)])
    print("✅ calls collection ready")
    
    # 2. Create ACTIVITIES Collection
    try:
        db.create_collection('activities')
    except:
        pass
    
    activities_collection = db['activities']
    activities_collection.create_index([('lead_id', ASCENDING)])
    activities_collection.create_index([('createdAt', DESCENDING)])
    activities_collection.create_index([('performedBy', ASCENDING)])
    print("✅ activities collection ready")
    
    # 3. Create AUDIT_LOGS Collection
    try:
        db.create_collection('audit_logs')
    except:
        pass
    
    audit_collection = db['audit_logs']
    audit_collection.create_index([('performedBy', ASCENDING)])
    audit_collection.create_index([('action', ASCENDING)])
    audit_collection.create_index([('timestamp', DESCENDING)])
    print("✅ audit_logs collection ready")
    
    # 4. Create CALL_HISTORY Collection
    try:
        db.create_collection('call_history')
    except:
        pass
    
    call_history = db['call_history']
    call_history.create_index([('lead_id', ASCENDING)])
    call_history.create_index([('caller_id', ASCENDING)])
    print("✅ call_history collection ready")
    
    # 5. Initialize default settings
    settings_collection = db['settings']
    
    default_settings = [
        {'key': 'autoAssignNewLeads', 'value': False},
        {'key': 'assignmentMethod', 'value': 'Round Robin'},
        {'key': 'round_robin_index', 'value': 0},
        {'key': 'defaultCallType', 'value': 'Inbound'},
        {'key': 'defaultFollowUpTime', 'value': 24},
        {'key': 'leadStages', 'value': [
            {'name': 'New Lead', 'color': '#3B82F6'},
            {'name': 'Contacted', 'color': '#8B5CF6'},
            {'name': 'Qualified', 'color': '#10B981'},
            {'name': 'Proposal Sent', 'color': '#F59E0B'},
            {'name': 'Negotiation', 'color': '#EF4444'},
            {'name': 'Closed Won', 'color': '#06B6D4'},
            {'name': 'Closed Lost', 'color': '#6B7280'}
        ]}
    ]
    
    for setting in default_settings:
        settings_collection.update_one(
            {'key': setting['key']},
            {'$set': {**setting, 'updatedAt': datetime.utcnow()}},
            upsert=True
        )
    
    print("✅ Default settings initialized")
    print("✅ Lead stages created in settings")
    
    print("\n✅ All MongoDB collections created successfully!")
    print(f"✅ Database: {DB_NAME}")
    print("✅ Collections: calls, activities, audit_logs, call_history, settings")
    
    client.close()

if __name__ == '__main__':
    setup_database()
