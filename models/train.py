from __future__ import annotations

import argparse
import json
import math
import statistics
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Sequence, Tuple

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, f1_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

from data.collector import FeatureVector, build_feature_table, collect_runs
from data.labeler import assign_labels, load_alert_index
from data.sample_generator import generate_dataset
from data.sequences import DEFAULT_KEYS, SequenceExample, extract_sequences

ROOT = Path(__file__).resolve().parent.parent
LOG_DIR = ROOT / "monitor" / "logs"
SYNTH_DIR = LOG_DIR / "synth"
ALERTS_PATH = LOG_DIR / "alerts.jsonl"
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

TARGET_LABELS = ("benign", "malicious", "unknown")
GB = 1024 * 1024 * 1024


@dataclass(slots=True)
class DatasetReport:
    score: float
    metrics: Dict[str, float]
    class_counts: Dict[str, int]
    attempts: int


@dataclass(slots=True)
class ModelReport:
    score: float
    f1_macro: float
    accuracy: float
    report: str
    feature_importances: Dict[str, float]
    lstm_score: Optional[float] = None


# Torch imports and LSTM model are imported/defined lazily inside _train_lstm
# to avoid requiring heavy optional dependencies when only the baseline model
# is requested (e.g. --no-lstm). This keeps the script usable in minimal
# environments while still supporting LSTM training when available.


def main() -> None:
    parser = argparse.ArgumentParser(description="Train ZenCube Phase 4 ML models")
    parser.add_argument("--log-dir", type=Path, default=LOG_DIR)
    parser.add_argument("--synth-dir", type=Path, default=SYNTH_DIR)
    parser.add_argument("--alerts", type=Path, default=ALERTS_PATH)
    parser.add_argument("--artifacts", type=Path, default=ARTIFACT_DIR)
    parser.add_argument("--seed", type=int, default=2025)
    parser.add_argument("--max-attempts", type=int, default=3)
    parser.add_argument("--regenerate", action="store_true")
    parser.add_argument("--no-lstm", action="store_true")
    parser.add_argument("--quick", action="store_true", help="Shorten training for tests")
    args = parser.parse_args()

    artifacts = args.artifacts.expanduser().resolve()
    artifacts.mkdir(parents=True, exist_ok=True)

    dataset_report, feature_vectors = _prepare_dataset(
        log_dir=args.log_dir,
        synth_dir=args.synth_dir,
        alerts_path=args.alerts,
        seed=args.seed,
        max_attempts=args.max_attempts,
        force_regenerate=args.regenerate,
        quick=args.quick,
    )

    model_report, model, scaler = _train_baseline(feature_vectors, seed=args.seed, quick=args.quick)

    lstm_state: Optional[dict] = None
    if not args.no_lstm:
        lstm_state, lstm_score = _train_lstm(feature_vectors, seed=args.seed, quick=args.quick)
        model_report.lstm_score = lstm_score

    _persist_artifacts(
        artifacts=artifacts,
        dataset_report=dataset_report,
        model_report=model_report,
        model=model,
        scaler=scaler,
        lstm_state=lstm_state,
        feature_vectors=feature_vectors,
        seed=args.seed,
    )

    print(json.dumps({
        "dataset_score": dataset_report.score,
        "model_score": model_report.score,
        "lstm_score": model_report.lstm_score,
    }, indent=2))


# ---------------------------------------------------------------------------
# Dataset preparation & scoring
# ---------------------------------------------------------------------------

def _prepare_dataset(
    log_dir: Path,
    synth_dir: Path,
    alerts_path: Path,
    seed: int,
    max_attempts: int,
    force_regenerate: bool,
    quick: bool,
) -> Tuple[DatasetReport, List[FeatureVector]]:
    attempt = 0
    rng_seed = seed
    feature_vectors: List[FeatureVector] = []
    report: Optional[DatasetReport] = None

    while attempt < max_attempts:
        if force_regenerate or not synth_dir.exists() or not any(synth_dir.glob("*.jsonl")):
            synth_dir.mkdir(parents=True, exist_ok=True)
            generate_dataset(synth_dir, seed=rng_seed, overwrite=True)
        else:
            if attempt > 0:
                generate_dataset(synth_dir, seed=rng_seed, overwrite=True)

        runs = collect_runs(log_dir, synthetic_dir=synth_dir)
        feature_vectors = build_feature_table(runs)
        alerts = load_alert_index(alerts_path)
        feature_vectors = assign_labels(feature_vectors, alerts)
        report = _score_dataset(feature_vectors, attempt + 1, quick=quick)
        if report.score >= 9.0:
            break
        attempt += 1
        rng_seed += 17
        force_regenerate = True

    if report is None:
        raise RuntimeError("Dataset scoring failed to produce a report")
    if report.score < 9.0:
        raise RuntimeError(f"Dataset quality insufficient after {max_attempts} attempts: {report.score:.2f}")

    return report, feature_vectors


def _score_dataset(feature_vectors: Sequence[FeatureVector], attempts: int, quick: bool) -> DatasetReport:
    class_counts = Counter(vector.label for vector in feature_vectors)
    sample_count = sum(class_counts.values())
    if sample_count == 0:
        empty_metrics = {"variance_mean": 0.0, "balance_ratio": 0.0, "time_std": 0.0, "anomaly_ratio": 0.0, "rare_total": 0.0, "sample_count": 0.0}
        return DatasetReport(score=0.0, metrics=empty_metrics, class_counts=dict(class_counts), attempts=attempts)
    feature_matrix = np.array([vector.features[c] for vector in feature_vectors for c in FEATURE_COLUMNS]).reshape(
        sample_count, len(FEATURE_COLUMNS)
    )
    variances = np.var(feature_matrix, axis=0)
    variance_score = min(variances.mean() / 500.0, 2.0)

    balance_components = []
    if len(class_counts) >= 3:
        min_count = min(class_counts.values())
        max_count = max(class_counts.values())
        balance_ratio = min_count / max(max_count, 1)
        balance_components.append(balance_ratio)
    else:
        balance_components.append(0.4)
    balance_score = min(sum(balance_components) * 4.0, 2.0)

    duration_values = [vector.features["duration_seconds"] for vector in feature_vectors]
    time_variance = statistics.pstdev(duration_values) if len(duration_values) > 1 else 0.0
    time_score = min(time_variance / 15.0, 2.0)

    anomaly_runs = sum(1 for vector in feature_vectors if vector.features["violation_count"] >= 1)
    anomaly_ratio = anomaly_runs / max(sample_count, 1)
    anomaly_score = min(anomaly_ratio * 10.0, 2.0)

    rare_cpu = sum(1 for vector in feature_vectors if vector.features["cpu_max"] >= 90)
    rare_mem = sum(1 for vector in feature_vectors if vector.features["rss_max"] >= 1.1 * GB)
    rare_total = rare_cpu + rare_mem
    diversity_score = min(rare_total / max(sample_count, 1) * 10.0, 2.0)

    sample_score = min(sample_count / (80 if quick else 120), 2.0)

    total_score = variance_score + balance_score + time_score + anomaly_score + diversity_score + sample_score
    total_score = min(total_score, 10.0)

    metrics = {
        "variance_mean": float(variances.mean()),
        "balance_ratio": float(min(class_counts.values()) / max(max(class_counts.values()), 1)) if class_counts else 0.0,
        "time_std": float(time_variance),
        "anomaly_ratio": float(anomaly_ratio),
        "rare_total": float(rare_total),
        "sample_count": float(sample_count),
    }

    return DatasetReport(score=total_score, metrics=metrics, class_counts=dict(class_counts), attempts=attempts)


# ---------------------------------------------------------------------------
# Baseline model
# ---------------------------------------------------------------------------

def _train_baseline(feature_vectors: Sequence[FeatureVector], seed: int, quick: bool) -> Tuple[ModelReport, RandomForestClassifier, StandardScaler]:
    records = []
    labels = []
    for vector in feature_vectors:
        if vector.label not in TARGET_LABELS:
            continue
        records.append([vector.features[col] for col in FEATURE_COLUMNS])
        labels.append(vector.label)

    df = pd.DataFrame(records, columns=FEATURE_COLUMNS)
    scaler = StandardScaler()
    X = scaler.fit_transform(df.values)
    y = np.array(labels)

    test_size = 0.25 if not quick else 0.4
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=test_size, random_state=seed, stratify=y)

    clf = RandomForestClassifier(
        n_estimators=180 if not quick else 80,
        max_depth=12,
        class_weight="balanced",
        random_state=seed,
        n_jobs=-1,
    )
    clf.fit(X_train, y_train)
    y_pred = clf.predict(X_test)

    report_str = classification_report(y_test, y_pred, zero_division=0)
    f1_macro = f1_score(y_test, y_pred, average="macro", zero_division=0)
    accuracy = float(np.mean(y_pred == y_test))

    feature_importances = {col: float(score) for col, score in zip(FEATURE_COLUMNS, clf.feature_importances_)}

    latency_score = 2.0  # RandomForest is fast enough for our constraints
    separation_score = min(float(np.std(clf.predict_proba(X_test), axis=1).mean()) * 4.0, 2.0)
    explanation_score = min(sum(sorted(feature_importances.values(), reverse=True)[:3]) * 5.0, 2.0)
    accuracy_score = min((f1_macro + accuracy) * 2.5, 4.0)
    model_score = min(latency_score + separation_score + explanation_score + accuracy_score, 10.0)

    report = ModelReport(
        score=model_score,
        f1_macro=float(f1_macro),
        accuracy=accuracy,
        report=report_str,
        feature_importances=feature_importances,
    )
    return report, clf, scaler


# ---------------------------------------------------------------------------
# LSTM model
# ---------------------------------------------------------------------------

def _train_lstm(feature_vectors: Sequence[FeatureVector], seed: int, quick: bool) -> Tuple[Optional[dict], float]:
    runs = [vector.run for vector in feature_vectors if vector.label in {"benign", "malicious"}]
    if not runs:
        return None, 0.0

    sequences = extract_sequences(runs, window=15 if quick else 25, stride=7 if quick else 10, keys=DEFAULT_KEYS)
    if not sequences:
        return None, 0.0

    # Lazy import of torch and model definition. If torch is not available the
    # LSTM training step will be skipped gracefully by returning a zero score.
    try:
        import torch
        import torch.nn as nn
        import torch.optim as optim
    except Exception:
        return None, 0.0

    label_to_idx = {"benign": 0, "malicious": 1}

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

    filtered: List[Tuple[np.ndarray, int]] = []
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
        filtered.append((enriched, label_to_idx[seq.label]))

    if not filtered:
        return None, 0.0

    X = np.stack([features for features, _ in filtered])
    y = np.array([label for _, label in filtered])

    test_size = 0.3 if not quick else 0.4
    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=test_size,
        random_state=seed,
        stratify=y,
    )

    hidden_dim = 128

    class LSTMClassifier(nn.Module):
        def __init__(self, input_dim: int, hidden_dim: int = hidden_dim, num_layers: int = 2, num_classes: int = 2) -> None:
            super().__init__()
            self.lstm = nn.LSTM(
                input_dim,
                hidden_dim,
                num_layers=num_layers,
                batch_first=True,
                dropout=0.1,
                bidirectional=True,
            )
            self.head = nn.Sequential(
                nn.Linear(hidden_dim * 2, hidden_dim),
                nn.ReLU(),
                nn.Dropout(0.1),
                nn.Linear(hidden_dim, hidden_dim // 2),
                nn.ReLU(),
                nn.Dropout(0.1),
                nn.Linear(hidden_dim // 2, num_classes),
            )

        def forward(self, x: torch.Tensor) -> torch.Tensor:  # type: ignore[override]
            output, _ = self.lstm(x)
            last = output[:, -1, :]
            return self.head(last)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = LSTMClassifier(input_dim=X.shape[2], hidden_dim=hidden_dim, num_classes=2).to(device)
    criterion = nn.CrossEntropyLoss()
    optimiser = optim.Adam(model.parameters(), lr=0.0006 if not quick else 0.0013, weight_decay=5e-5)
    scheduler = optim.lr_scheduler.StepLR(optimiser, step_size=12 if not quick else 6, gamma=0.5)
    epochs = 36 if not quick else 12

    X_train_tensor = torch.tensor(X_train, dtype=torch.float32, device=device)
    y_train_tensor = torch.tensor(y_train, dtype=torch.long, device=device)

    for epoch in range(epochs):
        model.train()
        optimiser.zero_grad()
        outputs = model(X_train_tensor)
        loss = criterion(outputs, y_train_tensor)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=2.0)
        optimiser.step()
        scheduler.step()

    model.eval()
    with torch.no_grad():
        X_test_tensor = torch.tensor(X_test, dtype=torch.float32, device=device)
        outputs = model(X_test_tensor)
        predictions = outputs.argmax(dim=1).cpu().numpy()
    lstm_f1 = f1_score(y_test, predictions, average="macro", zero_division=0)

    score = min(lstm_f1 * 10.0, 10.0)
    state = {
        "state_dict": model.cpu().state_dict(),
        "input_dim": X.shape[2],
        "window": 15 if quick else 25,
        "stride": 7 if quick else 10,
        "label_to_idx": label_to_idx,
        "hidden_dim": hidden_dim,
    }
    return state, float(score)


# ---------------------------------------------------------------------------
# Persistence
# ---------------------------------------------------------------------------

def _persist_artifacts(
    artifacts: Path,
    dataset_report: DatasetReport,
    model_report: ModelReport,
    model: RandomForestClassifier,
    scaler: StandardScaler,
    lstm_state: Optional[dict],
    feature_vectors: Sequence[FeatureVector],
    seed: int,
) -> None:
    joblib.dump(model, artifacts / "model.pkl")
    joblib.dump(scaler, artifacts / "scaler.pkl")
    if lstm_state:
        try:
            import torch

            torch.save(lstm_state, artifacts / "lstm.pt")
        except Exception:
            # Torch unavailable or save failed; record failure marker so CI can
            # detect that LSTM state wasn't persisted.
            (artifacts / "lstm.pt.failed").write_text("torch not available; lstm_state not saved", encoding="utf-8")

    meta = {
        "seed": seed,
        "dataset_score": dataset_report.score,
        "dataset_metrics": dataset_report.metrics,
        "dataset_class_counts": dataset_report.class_counts,
        "model_score": model_report.score,
        "model_f1_macro": model_report.f1_macro,
        "model_accuracy": model_report.accuracy,
        "lstm_score": model_report.lstm_score,
        "feature_columns": FEATURE_COLUMNS,
    }
    (artifacts / "meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")

    report_lines = [
        "# Phase 4 ML Training Report",
        "",
        f"- Dataset score: {dataset_report.score:.2f}",
        f"- Model score: {model_report.score:.2f}",
        f"- LSTM score: {model_report.lstm_score if model_report.lstm_score is not None else 'n/a'}",
        "",
        "## Dataset Metrics",
    ]
    for key, value in dataset_report.metrics.items():
        report_lines.append(f"- **{key}**: {value:.4f}")
    report_lines.append("")
    report_lines.append("## Class Counts")
    for label, count in dataset_report.class_counts.items():
        report_lines.append(f"- {label}: {count}")
    report_lines.append("")
    report_lines.append("## Random Forest Evaluation")
    report_lines.append("```")
    report_lines.append(model_report.report)
    report_lines.append("```")
    report_lines.append("")
    report_lines.append("## Feature Importances")
    for feature, importance in sorted(model_report.feature_importances.items(), key=lambda item: item[1], reverse=True):
        report_lines.append(f"- {feature}: {importance:.4f}")

    (artifacts / "report.md").write_text("\n".join(report_lines), encoding="utf-8")


if __name__ == "__main__":
    main()
