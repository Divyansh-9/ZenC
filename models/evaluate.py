from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import List, Sequence

import joblib
import numpy as np
import pandas as pd
import torch

from data.collector import build_feature_table, collect_runs
from data.labeler import assign_labels, load_alert_index
from data.sequences import DEFAULT_KEYS, SequenceExample, extract_sequences

ARTIFACT_DIR = Path(__file__).resolve().parent / "artifacts"
FEATURE_COLUMNS = [
    "cpu_mean",
    "cpu_max",
    "cpu_std",
    "cpu_slope",
    "rss_mean",
    "rss_max",
    "rss_std",
    "rss_slope",
    "io_read_rate",
    "io_write_rate",
    "open_files_mean",
    "socket_count_mean",
    "time_above_cpu_50",
    "violation_count",
    "duration_seconds",
    "threads_mean",
]


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate Phase 4 ML artifacts")
    parser.add_argument("--log-dir", type=Path, default=Path(__file__).resolve().parent.parent / "monitor" / "logs")
    parser.add_argument("--synth-dir", type=Path, default=Path(__file__).resolve().parent.parent / "monitor" / "logs" / "synth")
    parser.add_argument("--alerts", type=Path, default=Path(__file__).resolve().parent.parent / "monitor" / "logs" / "alerts.jsonl")
    parser.add_argument("--artifacts", type=Path, default=ARTIFACT_DIR)
    parser.add_argument("--use-lstm", action="store_true")
    args = parser.parse_args()

    model_path = args.artifacts / "model.pkl"
    scaler_path = args.artifacts / "scaler.pkl"
    meta_path = args.artifacts / "meta.json"

    if not model_path.exists() or not scaler_path.exists():
        raise FileNotFoundError("Baseline artifacts missing. Run models/train.py first.")

    runs = collect_runs(args.log_dir, synthetic_dir=args.synth_dir)
    feature_vectors = build_feature_table(runs)
    alerts = load_alert_index(args.alerts)
    feature_vectors = assign_labels(feature_vectors, alerts)

    df = pd.DataFrame([[vec.features[col] for col in FEATURE_COLUMNS] for vec in feature_vectors], columns=FEATURE_COLUMNS)
    labels = [vec.label for vec in feature_vectors]

    scaler = joblib.load(scaler_path)
    model = joblib.load(model_path)

    X = scaler.transform(df.values)
    preds = model.predict(X)
    probs = model.predict_proba(X)

    summary = _summarise_predictions(labels, preds, probs)

    result = {
        "baseline": summary,
    }

    if args.use_lstm:
        lstm_path = args.artifacts / "lstm.pt"
        if lstm_path.exists():
            sequences = extract_sequences([vec.run for vec in feature_vectors], keys=DEFAULT_KEYS)
            lstm_summary = _evaluate_lstm(lstm_path, sequences)
            result["lstm"] = lstm_summary

    if meta_path.exists():
        result["meta"] = json.loads(meta_path.read_text(encoding="utf-8"))

    print(json.dumps(result, indent=2))


def _summarise_predictions(labels: Sequence[str], preds: Sequence[str], probs: np.ndarray) -> dict:
    confusion: dict[str, dict[str, int]] = {}
    for label, pred in zip(labels, preds):
        confusion.setdefault(label, {})[pred] = confusion.setdefault(label, {}).get(pred, 0) + 1
    confidences = probs.max(axis=1)
    return {
        "support": dict((label, labels.count(label)) for label in set(labels)),
        "correct": int(sum(1 for label, pred in zip(labels, preds) if label == pred)),
        "total": len(labels),
        "confidence_mean": float(confidences.mean()) if len(confidences) else 0.0,
        "confidence_std": float(confidences.std()) if len(confidences) else 0.0,
        "confusion": confusion,
    }


def _evaluate_lstm(lstm_path: Path, sequences: Sequence[SequenceExample]) -> dict:
    if not sequences:
        return {"support": 0, "correct": 0, "total": 0}

    state = torch.load(lstm_path, map_location="cpu")
    model = _load_lstm(state)
    label_to_idx = state.get("label_to_idx", {"benign": 0, "malicious": 1, "unknown": 2})
    idx_to_label = {idx: label for label, idx in label_to_idx.items()}

    features = torch.tensor(np.stack([seq.features for seq in sequences]), dtype=torch.float32)
    outputs = model(features)
    predictions = outputs.argmax(dim=1).numpy()

    labels = [seq.label for seq in sequences]
    preds = [idx_to_label.get(int(pred), "unknown") for pred in predictions]

    correct = sum(1 for label, pred in zip(labels, preds) if label == pred)
    confidences = torch.softmax(outputs, dim=1).max(dim=1).values.numpy()
    return {
        "support": len(labels),
        "correct": correct,
        "total": len(labels),
        "confidence_mean": float(confidences.mean()) if len(confidences) else 0.0,
        "confidence_std": float(confidences.std()) if len(confidences) else 0.0,
    }


class _EvalLSTM(torch.nn.Module):
    def __init__(self, input_dim: int, num_classes: int = 3) -> None:
        super().__init__()
        self.lstm = torch.nn.LSTM(input_dim, 64, num_layers=2, batch_first=True, dropout=0.2)
        self.head = torch.nn.Sequential(
            torch.nn.Linear(64, 32),
            torch.nn.ReLU(),
            torch.nn.Dropout(0.2),
            torch.nn.Linear(32, num_classes),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:  # type: ignore[override]
        output, _ = self.lstm(x)
        last = output[:, -1, :]
        return self.head(last)


def _load_lstm(state: dict) -> _EvalLSTM:
    input_dim = int(state.get("input_dim", len(DEFAULT_KEYS)))
    model = _EvalLSTM(input_dim)
    model.load_state_dict(state["state_dict"], strict=False)
    model.eval()
    return model


if __name__ == "__main__":
    main()
