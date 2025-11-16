"""Clean, small ML inference shim for ZenCube.

Exports a minimal inference engine used by the monitor guard and GUI.

Contracts:
- load_artifacts(artifact_dir) -> (model, scaler, meta, model_type)
- MLInferenceEngine.predict_run(run: TelemetryRun|path) -> PredictionResult
- predict_run(...) and predict_sequence(...) convenience wrappers returning dict

The implementation is defensive: missing artifacts result in a harmless
"unknown" prediction and explanations use simple heuristics (feature
importances, linear coefficients, or variance proxies).
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

import joblib
import numpy as np

from data.collector import TelemetryRun, compute_features

logger = logging.getLogger(__name__)

DEFAULT_ARTIFACT_DIR = Path(__file__).resolve().parent.parent / "models" / "artifacts"


@dataclass
class PredictionResult:
    runId: str
    model: str
    score: float
    label: str
    probabilities: Optional[List[Dict[str, Any]]]
    explanation_top: Dict[str, float]
    meta: Dict[str, Any]
    info: Optional[str] = None

    @property
    def confidence(self) -> float:
        return float(self.score or 0.0)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "runId": self.runId,
            "model": self.model,
            "score": float(self.score),
            "label": self.label,
            "probs": self.probabilities,
            "explanation_top": self.explanation_top,
            "meta": self.meta,
            "info": self.info,
        }


def load_artifacts(artifact_dir: Union[str, Path] = DEFAULT_ARTIFACT_DIR) -> Tuple[Any, Optional[Any], Dict[str, Any], str]:
    art = Path(artifact_dir)
    model = None
    scaler = None
    meta: Dict[str, Any] = {}
    model_type = "none"

    if not art.exists():
        return model, scaler, meta, model_type

    try:
        meta_path = art / "meta.json"
        if meta_path.exists():
            meta = json.loads(meta_path.read_text(encoding="utf-8") or "{}")
    except Exception:
        meta = {}

    try:
        scaler_path = art / "scaler.pkl"
        if scaler_path.exists():
            scaler = joblib.load(scaler_path)
    except Exception:
        scaler = None

    try:
        model_path = art / "model.pkl"
        if model_path.exists():
            model = joblib.load(model_path)
            model_type = "sklearn"
    except Exception:
        model = None

    # optional LSTM artifacts - try to detect but tolerate import failures
    for name in ("lstm.pt", "lstm.pth", "lstm.h5"):
        cand = art / name
        if cand.exists():
            try:
                import torch  # type: ignore

                model = torch.load(str(cand), map_location="cpu")
                model_type = "lstm"
            except Exception:
                # we still report model_type so callers know an LSTM existed
                model_type = "lstm"
            break

    return model, scaler, meta, model_type


class MLInferenceEngine:
    def __init__(self, artifact_dir: Union[str, Path] = DEFAULT_ARTIFACT_DIR) -> None:
        self.artifact_dir = Path(artifact_dir)
        self.model, self.scaler, self.meta, self.model_type = load_artifacts(self.artifact_dir)

    def _prepare_vector(self, features: Dict[str, float]) -> Tuple[np.ndarray, List[str]]:
        order = self.meta.get("feature_order") if isinstance(self.meta.get("feature_order"), list) else sorted(features.keys())
        x = np.array([float(features.get(k, 0.0)) for k in order], dtype=float)
        if self.scaler is not None:
            try:
                x = self.scaler.transform([x])[0]
            except Exception:
                pass
        return x, order

    def predict_run(self, run: Union[TelemetryRun, str, Path]) -> PredictionResult:
        # resolve path to TelemetryRun if needed
        if isinstance(run, (str, Path)):
            run_path = Path(run)
            if not run_path.exists():
                return PredictionResult(runId=str(run), model="none", score=0.0, label="unknown", probabilities=None, explanation_top={}, meta=self.meta, info="run path not found")
            try:
                from data.collector import _load_run  # local private helper

                tr = _load_run(run_path, source="real")
            except Exception:
                tr = None
            if tr is None:
                return PredictionResult(runId=str(run_path), model="none", score=0.0, label="unknown", probabilities=None, explanation_top={}, meta=self.meta, info="could not load run")
        else:
            tr = run

        # compute features
        feat_vec = compute_features(tr)
        x, order = self._prepare_vector(feat_vec.features)

        if self.model is None:
            return PredictionResult(runId=tr.run_id, model="none", score=0.0, label="unknown", probabilities=None, explanation_top={}, meta=self.meta, info="no model artifacts")

        try:
            X = np.atleast_2d(x)
            probs = None
            score = 0.0
            label = "unknown"

            # probabilities if available
            if hasattr(self.model, "predict_proba"):
                proba = self.model.predict_proba(X)[0]
                classes = getattr(self.model, "classes_", list(range(len(proba))))
                probs = [{"label": str(c), "prob": float(p)} for c, p in zip(classes, proba)]
                idx = int(np.argmax(proba))
                label = str(classes[idx]).lower()
                score = float(proba[idx])
            elif hasattr(self.model, "decision_function"):
                df = self.model.decision_function(X)
                try:
                    dfv = float(df[0]) if isinstance(df, np.ndarray) and df.ndim == 1 else float(df)
                except Exception:
                    dfv = float(np.asarray(df).flatten()[0])
                score = abs(dfv)
                label = "malicious" if dfv > 0 else "benign"
            else:
                pred = self.model.predict(X)[0]
                label = str(pred).lower()
                score = 1.0

            # build simple explanation
            explanation: Dict[str, float] = {}
            if hasattr(self.model, "feature_importances_"):
                importances = getattr(self.model, "feature_importances_")
                pairs = sorted(((k, float(v)) for k, v in zip(order, importances)), key=lambda x: -abs(x[1]))[:5]
                explanation = {k: v for k, v in pairs}
            elif hasattr(self.model, "coef_"):
                coef = getattr(self.model, "coef_")
                coef_vec = coef[0] if getattr(coef, "ndim", 1) > 1 else coef
                contribs = {k: float(c) * float(feat_vec.features.get(k, 0.0)) for k, c in zip(order, np.ravel(coef_vec))}
                sorted_contribs = sorted(contribs.items(), key=lambda x: -abs(x[1]))[:5]
                explanation = {k: v for k, v in sorted_contribs}
            else:
                values = np.array([feat_vec.features.get(k, 0.0) for k in order], dtype=float)
                if values.size:
                    var = np.abs(values)
                    top_idx = np.argsort(-var)[:5]
                    explanation = {order[int(i)]: float(var[int(i)]) for i in top_idx}

            return PredictionResult(runId=tr.run_id, model=self.model_type or "sklearn", score=score, label=label, probabilities=probs, explanation_top=explanation, meta=self.meta, info=None)
        except Exception as exc:
            logger.exception("Inference failed: %s", exc)
            return PredictionResult(runId=getattr(tr, "run_id", str(run)), model=self.model_type or "unknown", score=0.0, label="unknown", probabilities=None, explanation_top={}, meta=self.meta, info=str(exc))

    def predict_sequence(self, seq: List[Dict[str, float]]) -> PredictionResult:
        if not seq:
            return PredictionResult(runId="sequence", model=self.model_type or "lstm", score=0.0, label="unknown", probabilities=None, explanation_top={}, meta=self.meta, info="empty sequence")

        keys = sorted({k for row in seq for k in row.keys()})
        mat = np.array([[float(row.get(k, 0.0)) for k in keys] for row in seq], dtype=float)
        var = np.var(mat, axis=0)
        top_idx = np.argsort(-var)[:5]
        explanation = {keys[int(i)]: float(var[int(i)]) for i in top_idx}
        score = float(np.max(var)) if var.size else 0.0
        label = "malicious" if score > 1e3 else "benign" if score < 1e-3 else "suspicious"
        return PredictionResult(runId="sequence", model=self.model_type or "lstm", score=score, label=label, probabilities=None, explanation_top=explanation, meta=self.meta, info="proxy-sequence")


@lru_cache(maxsize=4)
def _get_engine(artifact_dir: Union[str, Path]) -> MLInferenceEngine:
    return MLInferenceEngine(artifact_dir=artifact_dir)


def predict_run(run_id: Union[str, TelemetryRun], artifact_dir: Union[str, Path] = DEFAULT_ARTIFACT_DIR) -> Dict[str, Any]:
    engine = _get_engine(str(Path(artifact_dir).expanduser().resolve()))
    result = engine.predict_run(run_id)
    return result.to_dict()


def predict_sequence(sequence: List[Dict[str, float]], artifact_dir: Union[str, Path] = DEFAULT_ARTIFACT_DIR) -> Dict[str, Any]:
    engine = _get_engine(str(Path(artifact_dir).expanduser().resolve()))
    result = engine.predict_sequence(sequence)
    return result.to_dict()


def main() -> None:  # simple CLI for debugging
    import argparse

    parser = argparse.ArgumentParser(description="Run ML inference against a telemetry log")
    parser.add_argument("run", help="Path or identifier for the telemetry log")
    parser.add_argument("--artifacts", default=str(DEFAULT_ARTIFACT_DIR), help="Directory containing model artifacts")
    args = parser.parse_args()

    result = predict_run(args.run, artifact_dir=args.artifacts)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":  # pragma: no cover
    main()


__all__ = ["MLInferenceEngine", "PredictionResult", "load_artifacts", "predict_run", "predict_sequence", "DEFAULT_ARTIFACT_DIR"]
