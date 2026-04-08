from dataclasses import dataclass
from math import exp


def _sigmoid(value: float) -> float:
    return 1.0 / (1.0 + exp(-value))


@dataclass
class RiskPrediction:
    probability: float
    high_risk: bool
    tier: str


class PHQ9RiskClassifier:
    """Simple calibrated classifier that converts PHQ-9 features into risk probability."""

    def predict(self, answers: list[int], total_score: int) -> RiskPrediction:
        # Hand-tuned features chosen to prioritize self-harm item and total burden.
        self_harm_item = float(answers[8])
        sleep_and_energy = float(answers[2] + answers[3])
        cognition = float(answers[6])

        linear_score = (
            -4.0
            + 0.20 * float(total_score)
            + 0.85 * self_harm_item
            + 0.20 * sleep_and_energy
            + 0.18 * cognition
        )
        probability = round(_sigmoid(linear_score), 4)

        if probability >= 0.75 or total_score >= 20:
            tier = "high"
        elif probability >= 0.45 or total_score >= 15:
            tier = "medium"
        else:
            tier = "low"

        high_risk = tier == "high" or total_score >= 15
        return RiskPrediction(probability=probability, high_risk=high_risk, tier=tier)


_risk_classifier = PHQ9RiskClassifier()


def classify_assessment_risk(answers: list[int], total_score: int) -> RiskPrediction:
    return _risk_classifier.predict(answers, total_score)
