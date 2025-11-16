#ifndef ZENCUBE_LOGUTIL_H
#define ZENCUBE_LOGUTIL_H

#include <stdio.h>

// Append JSON line to file (atomic)
int append_jsonl(const char *path, const char *json_string);

// Rotate logs keeping last N files
int rotate_logs(const char *log_dir, const char *pattern, int keep_count, int compress);

// Compress file to .gz
int compress_file(const char *input_path, const char *output_path);

// Get ISO 8601 UTC timestamp
void get_iso_timestamp(char *buffer, size_t size);

// Build log path from run_id
void build_log_path(char *buffer, size_t size, const char *log_dir, const char *run_id);

#endif // ZENCUBE_LOGUTIL_H
