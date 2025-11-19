#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${PROM_EXPORTER_PORT:-6060}"
TARGET_URL="http://127.0.0.1:${PORT}/metrics"
LABELS_CSV="${METRICS_LABELS:-zencube_cpu_percent,zencube_memory_rss_bytes}"

cleanup() {
  if [[ -n "${EXPORTER_PID:-}" ]]; then
    kill "${EXPORTER_PID}" >/dev/null 2>&1 || true
  fi
  [[ -n "${TMP_DIR:-}" ]] && rm -rf "${TMP_DIR}"
}
trap cleanup EXIT

if [[ ! -x "${ROOT_DIR}/core_c/bin/prom_exporter" ]]; then
  echo "[check-metrics] prom_exporter missing – building core binaries"
  (cd "${ROOT_DIR}/core_c" && make clean && make prom_exporter)
fi

TMP_DIR="$(mktemp -d)"
SAMPLE_FILE="${TMP_DIR}/sample.jsonl"
cat >"${SAMPLE_FILE}" <<EOF
{"event":"sample","timestamp":"$(date -u +"%Y-%m-%dT%H:%M:%SZ")","cpu_percent":72.5,"rss_bytes":268435456,"vms_bytes":536870912,"threads":12,"fds_open":32,"read_bytes":4096,"write_bytes":2048,"cpu_max":88.1,"rss_max":322122547}
EOF

"${ROOT_DIR}/core_c/bin/prom_exporter" --log "${SAMPLE_FILE}" --port "${PORT}" >/dev/null 2>&1 &
EXPORTER_PID=$!
sleep 1

echo "[check-metrics] Curling ${TARGET_URL}"
HTTP_BODY=$(curl -fsS "${TARGET_URL}")

IFS=',' read -ra REQUIRED_LABELS <<<"${LABELS_CSV}"
for label in "${REQUIRED_LABELS[@]}"; do
  if ! grep -q "${label}" <<<"${HTTP_BODY}"; then
    echo "[check-metrics] Missing expected label '${label}'" >&2
    exit 1
  fi
  echo "[check-metrics] Verified label '${label}'"
done

echo "[check-metrics] Sample response:"
echo "${HTTP_BODY}" | head -n 20

pushd "${ROOT_DIR}" >/dev/null
npx ts-node -P tsconfig.main.json scripts/ml-smoke-test.ts
popd >/dev/null

echo "[check-metrics] Completed successfully"
