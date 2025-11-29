# Reference: Complete schema for all MongoDB collections

COLLECTIONS_SCHEMA = {
    
    "leads": {
        "_id": "ObjectId",
        "id": "string (unique)",
        "name": "string",
        "phone": "string",
        "phoneDigits": "string",
        "email": "string",
        "city": "string",
        "value": "number (lead value in rupees)",
        "lifetime_value": "number",
        "source": "string (Website, Referral, Google Ads, etc.)",
        "stage": "string (New Lead, Qualified, Proposal Sent, etc.)",
        "priority": "string (Hot, Warm, Cold)",
        "notes": "string",
        "company": "string",
        "assignedCaller": "string (caller ObjectId)",
        "assignedCallerName": "string",
        "assignedAt": "ISODate",
        "callType": "string (Inbound/Outbound)",
        "followUpTime": "number (hours)",
        "nextFollowUpDate": "ISODate",
        "createdAt": "ISODate"
    },
    
    "callers": {
        "_id": "ObjectId",
        "username": "string (unique)",
        "password": "string (hashed)",
        "email": "string",
        "role": "string (caller)",
        "status": "string (Active/Inactive)",
        "name": "string",
        "phone": "string",
        "createdAt": "ISODate",
        "updatedAt": "ISODate"
    },
    
    "customers": {
        "_id": "ObjectId",
        "lead_id": "string (reference to leads.id)",
        "name": "string",
        "email": "string",
        "city": "string",
        "value": "number",
        "purchaseDate": "ISODate",
        "createdAt": "ISODate"
    },
    
    "calls": {
        "_id": "ObjectId",
        "lead_id": "string (reference to leads.id)",
        "caller_id": "string (reference to callers._id)",
        "caller_name": "string",
        "callType": "string (Inbound/Outbound)",
        "duration": "number (seconds)",
        "notes": "string",
        "status": "string (Completed/Missed/In-Progress)",
        "nextFollowUpDate": "ISODate",
        "createdAt": "ISODate"
    },
    
    "activities": {
        "_id": "ObjectId",
        "lead_id": "string (reference to leads.id)",
        "activityType": "string (call/note/stage_change/assigned/deleted)",
        "description": "string",
        "performedBy": "string (caller/admin username)",
        "performedByName": "string",
        "oldValue": "any (for stage changes)",
        "newValue": "any (for stage changes)",
        "createdAt": "ISODate"
    },
    
    "audit_logs": {
        "_id": "ObjectId",
        "action": "string (create_lead/update_lead/delete_lead/assign_caller/etc.)",
        "performedBy": "string (admin username)",
        "target": "string (lead-id/caller-id/etc.)",
        "details": "string",
        "timestamp": "ISODate"
    },
    
    "call_history": {
        "_id": "ObjectId",
        "lead_id": "string",
        "caller_id": "string",
        "total_calls": "number",
        "last_call_date": "ISODate",
        "total_duration": "number (seconds)"
    },
    
    "settings": {
        "_id": "ObjectId",
        "key": "string (unique)",
        "value": "any",
        "updatedAt": "ISODate"
    }
}
