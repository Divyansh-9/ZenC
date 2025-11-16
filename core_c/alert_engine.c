#include "alert_engine.h"
#include "logutil.h"
#include "cJSON.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

// Initialize alert engine
int alert_engine_init(AlertEngine *engine, const char *config_path, const char *alert_log_path) {
    if (!engine) return -1;
    
    memset(engine, 0, sizeof(AlertEngine));
    strncpy(engine->alert_log_path, alert_log_path, sizeof(engine->alert_log_path) - 1);
    
    return alert_engine_load_rules(engine, config_path);
}

// Parse operator string
static AlertOperator parse_operator(const char *op) {
    if (strcmp(op, ">") == 0) return OP_GREATER;
    if (strcmp(op, "<") == 0) return OP_LESS;
    if (strcmp(op, ">=") == 0) return OP_GREATER_EQUAL;
    if (strcmp(op, "<=") == 0) return OP_LESS_EQUAL;
    if (strcmp(op, "==") == 0) return OP_EQUAL;
    return OP_GREATER;  // Default
}

// Load rules from JSON config
int alert_engine_load_rules(AlertEngine *engine, const char *config_path) {
    FILE *fp = fopen(config_path, "r");
    if (!fp) {
        fprintf(stderr, "Alert config not found: %s\n", config_path);
        return -1;
    }
    
    fseek(fp, 0, SEEK_END);
    long size = ftell(fp);
    fseek(fp, 0, SEEK_SET);
    
    char *content = malloc(size + 1);
    fread(content, 1, size, fp);
    content[size] = '\0';
    fclose(fp);
    
    cJSON *root = cJSON_Parse(content);
    free(content);
    
    if (!root) {
        fprintf(stderr, "Failed to parse alert config JSON\n");
        return -1;
    }
    
    cJSON *rules_array = cJSON_GetObjectItem(root, "rules");
    if (!rules_array || !cJSON_IsArray(rules_array)) {
        cJSON_Delete(root);
        return -1;
    }
    
    int count = cJSON_GetArraySize(rules_array);
    engine->rules = malloc(sizeof(AlertRule) * count);
    engine->rule_count = count;
    
    for (int i = 0; i < count; i++) {
        cJSON *rule_obj = cJSON_GetArrayItem(rules_array, i);
        AlertRule *rule = &engine->rules[i];
        
        cJSON *metric = cJSON_GetObjectItem(rule_obj, "metric");
        cJSON *op = cJSON_GetObjectItem(rule_obj, "operator");
        cJSON *threshold = cJSON_GetObjectItem(rule_obj, "threshold");
        cJSON *duration = cJSON_GetObjectItem(rule_obj, "duration_samples");
        
        if (metric) strncpy(rule->metric, metric->valuestring, sizeof(rule->metric) - 1);
        if (op) rule->operator = parse_operator(op->valuestring);
        if (threshold) rule->threshold = threshold->valuedouble;
        if (duration) rule->duration_samples = duration->valueint;
    }
    
    cJSON_Delete(root);
    return 0;
}

// Evaluate condition
static int evaluate_condition(double value, AlertOperator op, double threshold) {
    switch (op) {
        case OP_GREATER:       return value > threshold;
        case OP_LESS:          return value < threshold;
        case OP_GREATER_EQUAL: return value >= threshold;
        case OP_LESS_EQUAL:    return value <= threshold;
        case OP_EQUAL:         return value == threshold;
        default:               return 0;
    }
}

// Evaluate samples against rules
int alert_engine_evaluate(AlertEngine *engine, const char *log_path, const char *run_id) {
    if (!engine || !log_path) return -1;
    
    FILE *fp = fopen(log_path, "r");
    if (!fp) return -1;
    
    char line[2048];
    int *violation_counts = calloc(engine->rule_count, sizeof(int));
    
    while (fgets(line, sizeof(line), fp)) {
        cJSON *sample = cJSON_Parse(line);
        if (!sample) continue;
        
        cJSON *event = cJSON_GetObjectItem(sample, "event");
        if (!event || strcmp(event->valuestring, "sample") != 0) {
            cJSON_Delete(sample);
            continue;
        }
        
        // Check each rule
        for (int i = 0; i < engine->rule_count; i++) {
            AlertRule *rule = &engine->rules[i];
            cJSON *metric_val = cJSON_GetObjectItem(sample, rule->metric);
            
            if (metric_val && cJSON_IsNumber(metric_val)) {
                double value = metric_val->valuedouble;
                
                if (evaluate_condition(value, rule->operator, rule->threshold)) {
                    violation_counts[i]++;
                    
                    // Trigger alert if duration threshold met
                    if (violation_counts[i] >= rule->duration_samples) {
                        AlertRecord alert = {0};
                        snprintf(alert.alert_id, sizeof(alert.alert_id), 
                                "alert_%ld_%s", time(NULL), rule->metric);
                        strncpy(alert.metric, rule->metric, sizeof(alert.metric) - 1);
                        strncpy(alert.run_id, run_id, sizeof(alert.run_id) - 1);
                        get_iso_timestamp(alert.triggered_at, sizeof(alert.triggered_at));
                        alert.value = value;
                        alert.threshold = rule->threshold;
                        alert.duration_sec = rule->duration_samples * 1.0;  // Approximate
                        alert.acknowledged = 0;
                        
                        alert_engine_write_alert(engine->alert_log_path, &alert);
                        
                        // Reset counter to avoid duplicate alerts
                        violation_counts[i] = 0;
                    }
                } else {
                    // Reset count if condition not met
                    violation_counts[i] = 0;
                }
            }
        }
        
        cJSON_Delete(sample);
    }
    
    fclose(fp);
    free(violation_counts);
    return 0;
}

// Write alert to JSONL
int alert_engine_write_alert(const char *path, const AlertRecord *alert) {
    cJSON *root = cJSON_CreateObject();
    if (!root) return -1;
    
    cJSON_AddStringToObject(root, "alert_id", alert->alert_id);
    cJSON_AddStringToObject(root, "metric", alert->metric);
    cJSON_AddStringToObject(root, "run_id", alert->run_id);
    cJSON_AddStringToObject(root, "triggered_at", alert->triggered_at);
    cJSON_AddNumberToObject(root, "value", alert->value);
    cJSON_AddNumberToObject(root, "threshold", alert->threshold);
    cJSON_AddNumberToObject(root, "duration_sec", alert->duration_sec);
    cJSON_AddBoolToObject(root, "acknowledged", alert->acknowledged);
    
    if (alert->acknowledged_at[0]) {
        cJSON_AddStringToObject(root, "acknowledged_at", alert->acknowledged_at);
    } else {
        cJSON_AddNullToObject(root, "acknowledged_at");
    }
    
    char *json_str = cJSON_PrintUnformatted(root);
    int result = append_jsonl(path, json_str);
    
    free(json_str);
    cJSON_Delete(root);
    
    return result;
}

// Cleanup
void alert_engine_cleanup(AlertEngine *engine) {
    if (engine && engine->rules) {
        free(engine->rules);
        engine->rules = NULL;
        engine->rule_count = 0;
    }
}
