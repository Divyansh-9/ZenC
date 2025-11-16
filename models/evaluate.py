from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Dict, List, Sequence

import joblib
import numpy as np
import pandas as pd
import torch

from data.collector import FeatureVector, build_feature_table, collect_runs
from data.labeler import assign_labels, load_alert_index
from data.sequences import DEFAULT_KEYS, extract_sequences

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
            lstm_summary = _evaluate_lstm(lstm_path, feature_vectors)
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


def _evaluate_lstm(lstm_path: Path, feature_vectors: Sequence[FeatureVector]) -> dict:
    state = torch.load(lstm_path, map_location="cpu")
    label_to_idx: Dict[str, int] = state.get("label_to_idx", {"benign": 0, "malicious": 1})
    idx_to_label = {idx: label for label, idx in label_to_idx.items()}
    window = int(state.get("window", 25))
    stride = int(state.get("stride", 10))

    runs = [vector.run for vector in feature_vectors if vector.label in label_to_idx]
    if not runs:
        return {"support": 0, "correct": 0, "total": 0}

    sequences = extract_sequences(runs, window=window, stride=stride, keys=DEFAULT_KEYS)
    if not sequences:
        return {"support": 0, "correct": 0, "total": 0}

    feature_rows: List[np.ndarray] = []
    run_feature_map: Dict[str, np.ndarray] = {}
    for vector in feature_vectors:
        row = np.array([vector.features[col] for col in FEATURE_COLUMNS], dtype=float)
        feature_rows.append(row)
        run_feature_map[vector.run.run_id] = row

    if feature_rows:
        feature_matrix = np.vstack(feature_rows)
        feature_scale = np.std(feature_matrix, axis=0)
        feature_scale = np.where(feature_scale > 1e-6, feature_scale, 1.0)
    else:
        feature_scale = np.ones(len(FEATURE_COLUMNS), dtype=float)

    dataset_features: List[np.ndarray] = []
    labels: List[int] = []
    for seq in sequences:
        if seq.label not in label_to_idx:
            continue
        base = seq.features
        run_features = run_feature_map.get(seq.run_id)
        if run_features is not None:
            scaled = (run_features / feature_scale).astype(np.float32)
            broadcast = np.repeat(scaled[None, :], base.shape[0], axis=0)
            enriched = np.concatenate([base, broadcast], axis=1)
        else:
            enriched = base
        dataset_features.append(enriched)
        labels.append(label_to_idx[seq.label])

    if not dataset_features:
        return {"support": 0, "correct": 0, "total": 0}

    input_dim = int(state.get("input_dim", dataset_features[0].shape[1]))
    features = torch.tensor(np.stack(dataset_features), dtype=torch.float32)
    if features.shape[2] != input_dim:
        # Adjust to match training shape if minor differences occur.
        input_dim = features.shape[2]

    model = _load_lstm(state, input_dim=input_dim, num_classes=len(label_to_idx))
    model.eval()
    with torch.no_grad():
        outputs = model(features)
    predictions = outputs.argmax(dim=1).numpy()

    preds = [idx_to_label.get(int(pred), "unknown") for pred in predictions]
    true_labels = [idx_to_label.get(idx, "unknown") for idx in labels]

    correct = sum(1 for truth, pred in zip(true_labels, preds) if truth == pred)
    confidences = torch.softmax(outputs, dim=1).max(dim=1).values.numpy()
    return {
        "support": len(true_labels),
        "correct": correct,
        "total": len(true_labels),
        "confidence_mean": float(confidences.mean()) if len(confidences) else 0.0,
        "confidence_std": float(confidences.std()) if len(confidences) else 0.0,
    }


class _EvalLSTM(torch.nn.Module):
    def __init__(self, input_dim: int, hidden_dim: int = 128, num_classes: int = 2) -> None:
        super().__init__()
        self.lstm = torch.nn.LSTM(
            input_dim,
            hidden_dim,
            num_layers=2,
            batch_first=True,
            dropout=0.1,
            bidirectional=True,
        )
        self.head = torch.nn.Sequential(
            torch.nn.Linear(hidden_dim * 2, hidden_dim),
            torch.nn.ReLU(),
            torch.nn.Dropout(0.1),
            torch.nn.Linear(hidden_dim, hidden_dim // 2),
            torch.nn.ReLU(),
            torch.nn.Dropout(0.1),
            torch.nn.Linear(hidden_dim // 2, num_classes),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:  # type: ignore[override]
        output, _ = self.lstm(x)
        last = output[:, -1, :]
        return self.head(last)


def _load_lstm(state: dict, input_dim: int, num_classes: int) -> _EvalLSTM:
    hidden_dim = int(state.get("hidden_dim", 128))
    model = _EvalLSTM(input_dim, hidden_dim=hidden_dim, num_classes=num_classes)
    model.load_state_dict(state["state_dict"], strict=False)
    model.eval()
    return model


if __name__ == "__main__":
    main()
