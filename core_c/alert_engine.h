#ifndef ZENCUBE_ALERT_ENGINE_H
#define ZENCUBE_ALERT_ENGINE_H

#include <stdint.h>

// Alert rule operators
typedef enum {
    OP_GREATER,          // >
    OP_LESS,             // <
    OP_EQUAL,            // ==
    OP_GREATER_EQUAL,    // >=
    OP_LESS_EQUAL        // <=
} AlertOperator;

// Alert rule definition
typedef struct {
    char metric[64];           // e.g., "cpu_pct", "rss_mb"
    AlertOperator operator;
    double threshold;
    int duration_samples;      // consecutive samples required
} AlertRule;

// Alert record
typedef struct {
    char alert_id[128];
    char metric[64];
    char run_id[128];
    char triggered_at[32];     // ISO timestamp
    double value;
    double threshold;
    double duration_sec;
    int acknowledged;
    char acknowledged_at[32];
} AlertRecord;

// Alert engine state
typedef struct {
    AlertRule *rules;
    int rule_count;
    char alert_log_path[512];
    char log_dir[512];
} AlertEngine;

// Initialize alert engine from JSON config
int alert_engine_init(AlertEngine *engine, const char *config_path, const char *alert_log_path);

// Load alert rules from JSON
int alert_engine_load_rules(AlertEngine *engine, const char *config_path);

// Evaluate samples against rules
int alert_engine_evaluate(AlertEngine *engine, const char *log_path, const char *run_id);

// Write alert to JSONL
int alert_engine_write_alert(const char *path, const AlertRecord *alert);

// Cleanup
void alert_engine_cleanup(AlertEngine *engine);

#endif // ZENCUBE_ALERT_ENGINE_H
