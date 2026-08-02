import sqlite3
import json
import uuid
import datetime

db_path = r'C:\Users\pramukh\.n8n\database.sqlite'

workflows = [
    ("workflow_1_high_risk_escalation.json", "risk-alert"),
    ("workflow_2_daily_risk_summary.json", "daily-digest"),
    ("workflow_3_forum_moderation.json", "forum-moderation"),
    ("workflow_4_google_fit_sync.json", "google-fit-sync"),
]

conn = sqlite3.connect(db_path)
cur = conn.cursor()

now = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]
project_id = '4Ns9ztd0dRX2GPaw'

for file_name, webhook_path in workflows:
    with open(f"d:\\Namith\\HTML\\Healthly\\{file_name}", "r", encoding="utf-8") as f:
        wf_json = json.load(f)
    
    wf_name = wf_json.get("name")
    nodes_str = json.dumps(wf_json.get("nodes", []))
    conns_str = json.dumps(wf_json.get("connections", {}))
    settings_str = json.dumps(wf_json.get("settings", {}))
    
    existing = cur.execute("SELECT id FROM workflow_entity WHERE name=?", (wf_name,)).fetchone()
    if existing:
        wf_id = existing[0]
    else:
        wf_id = str(uuid.uuid4())[:16]
    
    version_id = str(uuid.uuid4())
    
    # 1. workflow_entity
    cur.execute("""
        INSERT OR REPLACE INTO workflow_entity 
        (id, name, active, nodes, connections, settings, activeVersionId, versionId, createdAt, updatedAt)
        VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?)
    """, (wf_id, wf_name, nodes_str, conns_str, settings_str, version_id, version_id, now, now))
    
    # 2. workflow_history
    cur.execute("""
        INSERT OR REPLACE INTO workflow_history
        (versionId, workflowId, authors, createdAt, updatedAt, nodes, connections, name)
        VALUES (?, ?, 'admin@healthly.com', ?, ?, ?, ?, ?)
    """, (version_id, wf_id, now, now, nodes_str, conns_str, wf_name))
    
    # 3. workflow_published_version
    cur.execute("""
        INSERT OR REPLACE INTO workflow_published_version
        (workflowId, publishedVersionId, createdAt, updatedAt)
        VALUES (?, ?, ?, ?)
    """, (wf_id, version_id, now, now))
    
    # 4. shared_workflow
    cur.execute("""
        INSERT OR REPLACE INTO shared_workflow
        (workflowId, projectId, role, createdAt, updatedAt)
        VALUES (?, ?, 'workflow:owner', ?, ?)
    """, (wf_id, project_id, now, now))

    # 5. webhook_entity
    webhook_node_name = [n["name"] for n in wf_json.get("nodes", []) if n.get("type") == "n8n-nodes-base.webhook"][0]
    cur.execute("""
        INSERT OR REPLACE INTO webhook_entity
        (workflowId, webhookPath, method, node, webhookId, pathLength)
        VALUES (?, ?, 'POST', ?, ?, 1)
    """, (wf_id, webhook_path, webhook_node_name, webhook_path))
    
    print(f"[OK] Configured Workflow: {wf_name} (ID: {wf_id}) -> /webhook/{webhook_path}")

conn.commit()
conn.close()
print("All 4 n8n workflows successfully configured with shared_workflow ownership!")
