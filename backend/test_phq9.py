import json
from app.db.session import SessionLocal
from app.models.user import User
from app.models.phq9_assessment import PHQ9Assessment
from app.services.phq9_emotion_agent import analyze_phq9_emotions
from app.services.phq9 import score_phq9

db = SessionLocal()
print("Starting manual test...")
try:
    user = db.query(User).first()
    if not user:
        print("No user found. Exiting.")
    else:
        answers1 = [0, 0, 0, 0, 0, 0, 0, 0, 0]
        res1 = score_phq9(answers1)
        print(f"All 0s -> Score: {res1.score}")

        answers2 = [3, 3, 3, 3, 3, 3, 3, 3, 3]
        res2 = score_phq9(answers2)
        print(f"All 3s -> Score: {res2.score}")
finally:
    db.close()
