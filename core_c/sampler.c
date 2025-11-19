#include "sampler.h"
#include "logutil.h"
#include "cJSON.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <dirent.h>
#include <signal.h>
#include <sys/stat.h>

// Parse /proc/<pid>/stat for CPU times
static int read_proc_stat(int pid, unsigned long *utime, unsigned long *stime) {
    char path[256];
    snprintf(path, sizeof(path), "/proc/%d/stat", pid);
    
    FILE *fp = fopen(path, "r");
    if (!fp) return -1;
    
    // Skip to fields 14 and 15 (utime, stime)
    for (int i = 0; i < 13; i++) {
        if (fscanf(fp, "%*s") != 0) {}
    }
    
    if (fscanf(fp, "%lu %lu", utime, stime) != 2) {
        fclose(fp);
        return -1;
    }
    
    fclose(fp);
    return 0;
}

// Parse /proc/<pid>/status for RSS
static int read_proc_status(int pid, uint64_t *rss, uint64_t *vms, int *threads) {
    char path[256];
    snprintf(path, sizeof(path), "/proc/%d/status", pid);
    
    FILE *fp = fopen(path, "r");
    if (!fp) return -1;
    
    char line[256];
    *rss = 0;
    *vms = 0;
    *threads = 1;
    
    while (fgets(line, sizeof(line), fp)) {
        if (strncmp(line, "VmRSS:", 6) == 0) {
            unsigned long kb;
            sscanf(line + 6, "%lu", &kb);
            *rss = kb * 1024;  // Convert to bytes
        } else if (strncmp(line, "VmSize:", 7) == 0) {
            unsigned long kb;
            sscanf(line + 7, "%lu", &kb);
            *vms = kb * 1024;
        } else if (strncmp(line, "Threads:", 8) == 0) {
            sscanf(line + 8, "%d", threads);
        }
    }
    
    fclose(fp);
    return 0;
}

// Count open file descriptors
static int count_open_fds(int pid) {
    char path[256];
    snprintf(path, sizeof(path), "/proc/%d/fd", pid);
    
    DIR *dir = opendir(path);
    if (!dir) return 0;
    
    int count = 0;
    struct dirent *entry;
    while ((entry = readdir(dir)) != NULL) {
        if (entry->d_name[0] != '.') {
            count++;
        }
    }
    
    closedir(dir);
    return count;
}

// Read I/O stats
static int read_proc_io(int pid, uint64_t *read_bytes, uint64_t *write_bytes) {
    char path[256];
    snprintf(path, sizeof(path), "/proc/%d/io", pid);
    
    FILE *fp = fopen(path, "r");
    if (!fp) {
        *read_bytes = 0;
        *write_bytes = 0;
        return -1;
    }
    
    char line[256];
    *read_bytes = 0;
    *write_bytes = 0;
    
    while (fgets(line, sizeof(line), fp)) {
        if (strncmp(line, "read_bytes:", 11) == 0) {
            sscanf(line + 11, "%lu", read_bytes);
        } else if (strncmp(line, "write_bytes:", 12) == 0) {
            sscanf(line + 12, "%lu", write_bytes);
        }
    }
    
    fclose(fp);
    return 0;
}

// Static vars for CPU calculation
static unsigned long prev_utime = 0;
static unsigned long prev_stime = 0;
static struct timespec prev_time = {0, 0};
static long clock_ticks = 0;

// Initialize sampler
int sampler_init(SamplerConfig *config) {
    if (!config) return -1;
    
    config->running = 1;
    clock_ticks = sysconf(_SC_CLK_TCK);
    if (clock_ticks <= 0) clock_ticks = 100;  // Fallback
    
    // Reset CPU tracking
    prev_utime = 0;
    prev_stime = 0;
    prev_time.tv_sec = 0;
    prev_time.tv_nsec = 0;
    
    return 0;
}

// Collect single sample
int sampler_collect(int pid, ProcessSample *sample) {
    if (!sample) return -1;
    
    // Get timestamp
    get_iso_timestamp(sample->timestamp, sizeof(sample->timestamp));
    sample->pid = pid;
    
    // Read /proc data
    unsigned long utime, stime;
    if (read_proc_stat(pid, &utime, &stime) != 0) {
        return -1;  // Process gone
    }
    
    // Calculate CPU percent
    struct timespec now;
    clock_gettime(CLOCK_MONOTONIC, &now);
    
    if (prev_time.tv_sec > 0) {
        double time_delta = (now.tv_sec - prev_time.tv_sec) + 
                           (now.tv_nsec - prev_time.tv_nsec) / 1e9;
        unsigned long cpu_delta = (utime + stime) - (prev_utime + prev_stime);
        sample->cpu_percent = (cpu_delta / (double)clock_ticks / time_delta) * 100.0;
        
        // Clamp to reasonable values
        if (sample->cpu_percent < 0) sample->cpu_percent = 0;
        if (sample->cpu_percent > 100) sample->cpu_percent = 100;
    } else {
        sample->cpu_percent = 0.0;
    }
    
    prev_utime = utime;
    prev_stime = stime;
    prev_time = now;
    
    // Read memory info
    uint64_t rss, vms;
    int threads;
    if (read_proc_status(pid, &rss, &vms, &threads) == 0) {
        sample->memory_rss = rss;
        sample->memory_vms = vms;
        sample->threads = threads;
    } else {
        sample->memory_rss = 0;
        sample->memory_vms = 0;
        sample->threads = 1;
    }
    
    // Count FDs
    sample->open_files = count_open_fds(pid);
    
    // Read I/O
    read_proc_io(pid, &sample->read_bytes, &sample->write_bytes);
    
    return 0;
}

// Write sample to JSONL
int sampler_write_jsonl(const char *path, const ProcessSample *sample) {
    cJSON *root = cJSON_CreateObject();
    if (!root) return -1;
    
    cJSON_AddStringToObject(root, "event", "sample");
    cJSON_AddStringToObject(root, "run_id", sample->run_id);
    cJSON_AddStringToObject(root, "timestamp", sample->timestamp);
    cJSON_AddNumberToObject(root, "pid", sample->pid);
    cJSON_AddNumberToObject(root, "cpu_percent", sample->cpu_percent);
    cJSON_AddNumberToObject(root, "rss_bytes", sample->memory_rss);
    cJSON_AddNumberToObject(root, "vms_bytes", sample->memory_vms);
    cJSON_AddNumberToObject(root, "threads", sample->threads);
    cJSON_AddNumberToObject(root, "fds_open", sample->open_files);
    cJSON_AddNumberToObject(root, "read_bytes", sample->read_bytes);
    cJSON_AddNumberToObject(root, "write_bytes", sample->write_bytes);
    cJSON_AddNumberToObject(root, "cpu_max", sample->cpu_max);
    cJSON_AddNumberToObject(root, "rss_max", sample->memory_rss_max);
    
    char *json_str = cJSON_PrintUnformatted(root);
    int result = append_jsonl(path, json_str);
    
    free(json_str);
    cJSON_Delete(root);
    
    return result;
}

// Write summary to JSONL
int sampler_write_summary(const char *path, int samples, double duration,
                         double max_cpu, uint64_t max_rss, int peak_files, int exit_code) {
    cJSON *root = cJSON_CreateObject();
    if (!root) return -1;
    
    char timestamp[32];
    get_iso_timestamp(timestamp, sizeof(timestamp));
    
    cJSON_AddStringToObject(root, "event", "stop");
    cJSON_AddStringToObject(root, "timestamp", timestamp);
    cJSON_AddNumberToObject(root, "samples", samples);
    cJSON_AddNumberToObject(root, "duration_seconds", duration);
    cJSON_AddNumberToObject(root, "max_cpu_percent", max_cpu);
    cJSON_AddNumberToObject(root, "max_memory_rss", max_rss);
    cJSON_AddNumberToObject(root, "peak_open_files", peak_files);
    cJSON_AddNumberToObject(root, "exit_code", exit_code);
    
    char *json_str = cJSON_PrintUnformatted(root);
    int result = append_jsonl(path, json_str);
    
    free(json_str);
    cJSON_Delete(root);
    
    return result;
}

// Signal handler
static volatile int g_running = 1;
static void signal_handler(int sig) {
    (void)sig;
    g_running = 0;
}

// Run sampling loop
int sampler_run(SamplerConfig *config) {
    if (!config) return -1;
    
    signal(SIGINT, signal_handler);
    signal(SIGTERM, signal_handler);
    
    struct timespec start_time;
    clock_gettime(CLOCK_MONOTONIC, &start_time);
    
    int sample_count = 0;
    double max_cpu = 0.0;
    uint64_t max_rss = 0;
    int peak_files = 0;
    
    ProcessSample sample;
    memset(&sample, 0, sizeof(sample));
    
    while (g_running && config->running) {
        if (sampler_collect(config->pid, &sample) != 0) {
            // Process terminated
            break;
        }
        
        // Set run_id
        strncpy(sample.run_id, config->run_id, sizeof(sample.run_id) - 1);
        sample.run_id[sizeof(sample.run_id) - 1] = '\0';  // Ensure null termination
        
        // Track maximums
        if (sample.cpu_percent > max_cpu) max_cpu = sample.cpu_percent;
        if (sample.memory_rss > max_rss) max_rss = sample.memory_rss;
        if (sample.open_files > peak_files) peak_files = sample.open_files;
        
        // Update sample with current maximums
        sample.cpu_max = max_cpu;
        sample.memory_rss_max = max_rss;
        
        // Write sample
        sampler_write_jsonl(config->output_path, &sample);
        sample_count++;
        
        // Sleep for interval
        usleep((useconds_t)(config->interval * 1000000));
    }
    
    // Write summary
    struct timespec end_time;
    clock_gettime(CLOCK_MONOTONIC, &end_time);
    double duration = (end_time.tv_sec - start_time.tv_sec) + 
                     (end_time.tv_nsec - start_time.tv_nsec) / 1e9;
    
    sampler_write_summary(config->output_path, sample_count, duration,
                         max_cpu, max_rss, peak_files, 0);
    
    return 0;
}

// Stop sampler
void sampler_stop(SamplerConfig *config) {
    if (config) {
        config->running = 0;
    }
}
