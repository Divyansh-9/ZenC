#ifndef ZENCUBE_SAMPLER_H
#define ZENCUBE_SAMPLER_H

#include <time.h>
#include <stdint.h>

// Sample data structure matching Python Schema
typedef struct {
    char timestamp[32];      // ISO 8601 UTC timestamp
    char run_id[128];        // Run identifier
    int pid;
    double cpu_percent;
    uint64_t memory_rss;     // bytes
    uint64_t memory_vms;     // bytes  
    int threads;
    int open_files;
    uint64_t read_bytes;
    uint64_t write_bytes;
    double cpu_max;          // Maximum CPU observed
    uint64_t memory_rss_max; // Maximum RSS observed
} ProcessSample;

// Sampler configuration
typedef struct {
    int pid;
    double interval;         // seconds
    char run_id[128];
    char output_path[512];
    int running;             // atomic flag
} SamplerConfig;

// Initialize sampler
int sampler_init(SamplerConfig *config);

// Collect single sample
int sampler_collect(int pid, ProcessSample *sample);

// Start sampling loop (blocking)
int sampler_run(SamplerConfig *config);

// Stop sampler
void sampler_stop(SamplerConfig *config);

// Write sample to JSONL
int sampler_write_jsonl(const char *path, const ProcessSample *sample);

// Write summary to JSONL
int sampler_write_summary(const char *path, int samples, double duration, 
                          double max_cpu, uint64_t max_rss, int peak_files, int exit_code);

// Get ISO timestamp
void get_iso_timestamp(char *buffer, size_t size);

#endif // ZENCUBE_SAMPLER_H
