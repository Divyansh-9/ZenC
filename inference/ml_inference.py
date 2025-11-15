from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, Optional, Sequence

import joblib
import numpy as np
import torch

from data.collector import FeatureVector, TelemetryRun, compute_features
from data.sequences import DEFAULT_KEYS, SequenceExample, extract_sequences
from models.train import FEATURE_COLUMNS, LSTMClassifier

ARTIFACT_DIR = Path(__file__).resolve().parent.parent / "models" / "artifacts"


@dataclass(slots=True)
class PredictionResult:
    label: str
    confidence: float
    probabilities: Dict[str, float]
    top_features: Sequence[tuple[str, float]]


class MLInferenceEngine:
    def __init__(self, artifacts_dir: Path | None = None) -> None:
        self._artifacts = (artifacts_dir or ARTIFACT_DIR).expanduser().resolve()
        self._model = joblib.load(self._artifacts / "model.pkl")
        self._scaler = joblib.load(self._artifacts / "scaler.pkl")
        self._meta = self._load_meta()
        self._feature_order = FEATURE_COLUMNS
        self._feature_importances = self._meta.get("feature_importances") or _extract_feature_importances(self._model, self._feature_order)
        self._lstm_state: Optional[dict] = None
        lstm_path = self._artifacts / "lstm.pt"
        if lstm_path.exists():
            self._lstm_state = torch.load(lstm_path, map_location="cpu")
            self._lstm = LSTMClassifier(input_dim=self._lstm_state.get("input_dim", len(DEFAULT_KEYS)))
            self._lstm.load_state_dict(self._lstm_state["state_dict"], strict=False)
            self._lstm.eval()
        else:
            self._lstm = None

    def predict_run(self, run: TelemetryRun) -> PredictionResult:
        vector = compute_features(run)
        return self.predict_features(vector)

    def predict_features(self, vector: FeatureVector | Dict[str, float]) -> PredictionResult:
        if isinstance(vector, FeatureVector):
            features_map = vector.features
        else:
            features_map = vector

        feature_row = np.array([[features_map[col] for col in self._feature_order]])
        transformed = self._scaler.transform(feature_row)
        probabilities = self._model.predict_proba(transformed)[0]
        labels = self._model.classes_
        label_idx = int(np.argmax(probabilities))
        predicted_label = str(labels[label_idx])
        confidence = float(probabilities[label_idx])
        probs = {str(label): float(prob) for label, prob in zip(labels, probabilities)}
        top_features = self._explain(feature_row[0])
        return PredictionResult(label=predicted_label, confidence=confidence, probabilities=probs, top_features=top_features)

    def predict_sequence(self, sequence: SequenceExample | np.ndarray) -> Optional[PredictionResult]:
        if self._lstm is None:
            return None
        if isinstance(sequence, SequenceExample):
            data = sequence.features
        else:
            data = np.asarray(sequence, dtype=np.float32)
        tensor = torch.tensor(data[None, :, :], dtype=torch.float32)
        with torch.no_grad():
            output = self._lstm(tensor)
            probabilities = torch.softmax(output, dim=1).numpy()[0]
        label_idx = int(np.argmax(probabilities))
        idx_to_label = {idx: label for label, idx in self._lstm_state.get("label_to_idx", {"benign": 0, "malicious": 1, "unknown": 2}).items()}  # type: ignore[union-attr]
        predicted_label = idx_to_label.get(label_idx, "unknown")
        confidence = float(probabilities[label_idx])
        probs = {idx_to_label.get(i, str(i)): float(prob) for i, prob in enumerate(probabilities)}
        return PredictionResult(label=predicted_label, confidence=confidence, probabilities=probs, top_features=())

    def build_sequences(self, runs: Iterable[TelemetryRun], window: int | None = None, stride: int | None = None) -> Sequence[SequenceExample]:
        if self._lstm_state is None:
            return []
        window = window or int(self._lstm_state.get("window", 25))
        stride = stride or int(self._lstm_state.get("stride", 10))
        return extract_sequences(runs, window=window, stride=stride, keys=DEFAULT_KEYS)

    def _load_meta(self) -> dict:
        meta_path = self._artifacts / "meta.json"
        if meta_path.exists():
            try:
                return json.loads(meta_path.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                return {}
        return {}

    def _explain(self, feature_row: np.ndarray) -> Sequence[tuple[str, float]]:
        mean = getattr(self._scaler, "mean_", np.zeros_like(feature_row))
        scale = getattr(self._scaler, "scale_", np.ones_like(feature_row))
        zscores = np.divide(feature_row - mean, scale, out=np.zeros_like(feature_row), where=scale != 0)
        contributions = {
            feature: float(abs(zscores[idx]) * self._feature_importances.get(feature, 0.0))
            for idx, feature in enumerate(self._feature_order)
        }
        ranked = sorted(contributions.items(), key=lambda item: item[1], reverse=True)
        return ranked[:5]


def _extract_feature_importances(model, columns: Sequence[str]) -> Dict[str, float]:
    importances: Dict[str, float] = {}
    values = getattr(model, "feature_importances_", None)
    if values is not None:
        for column, value in zip(columns, values):
            importances[column] = float(value)
    else:
        for column in columns:
            importances[column] = 1.0 / len(columns)
    return importances


__all__ = ["MLInferenceEngine", "PredictionResult"]
