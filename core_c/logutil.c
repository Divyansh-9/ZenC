#include "logutil.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <sys/stat.h>
#include <unistd.h>
#include <dirent.h>
#include <zlib.h>

#define TEMP_SUFFIX ".tmp"
#define GZ_SUFFIX ".gz"

// Get ISO 8601 UTC timestamp
void get_iso_timestamp(char *buffer, size_t size) {
    time_t now = time(NULL);
    struct tm *tm_utc = gmtime(&now);
    strftime(buffer, size, "%Y-%m-%dT%H:%M:%SZ", tm_utc);
}

// Append JSON line to file atomically
int append_jsonl(const char *path, const char *json_string) {
    char temp_path[1024];
    snprintf(temp_path, sizeof(temp_path), "%s%s", path, TEMP_SUFFIX);
    
    // Read existing content if file exists
    FILE *existing = fopen(path, "r");
    FILE *temp = fopen(temp_path, "w");
    if (!temp) {
        perror("fopen temp");
        if (existing) fclose(existing);
        return -1;
    }
    
    // Copy existing lines
    if (existing) {
        char line[4096];
        while (fgets(line, sizeof(line), existing)) {
            fputs(line, temp);
        }
        fclose(existing);
    }
    
    // Append new line
    fprintf(temp, "%s\n", json_string);
    fflush(temp);
    fsync(fileno(temp));
    fclose(temp);
    
    // Atomic rename
    if (rename(temp_path, path) != 0) {
        perror("rename");
        return -1;
    }
    
    return 0;
}

// Build log path from run_id
void build_log_path(char *buffer, size_t size, const char *log_dir, const char *run_id) {
    snprintf(buffer, size, "%s/%s.jsonl", log_dir, run_id);
}

// Compress file to .gz
int compress_file(const char *input_path, const char *output_path) {
    FILE *in = fopen(input_path, "rb");
    if (!in) {
        return -1;
    }
    
    gzFile out = gzopen(output_path, "wb");
    if (!out) {
        fclose(in);
        return -1;
    }
    
    char buffer[8192];
    size_t bytes;
    while ((bytes = fread(buffer, 1, sizeof(buffer), in)) > 0) {
        if (gzwrite(out, buffer, bytes) != (int)bytes) {
            fclose(in);
            gzclose(out);
            return -1;
        }
    }
    
    fclose(in);
    gzclose(out);
    return 0;
}

// Rotate logs keeping last N files
int rotate_logs(const char *log_dir, const char *pattern, int keep_count, int compress_old) {
    DIR *dir = opendir(log_dir);
    if (!dir) {
        return -1;
    }
    
    // Count matching files
    struct dirent *entry;
    char **files = NULL;
    int file_count = 0;
    
    while ((entry = readdir(dir)) != NULL) {
        if (strstr(entry->d_name, pattern) && strstr(entry->d_name, ".jsonl")) {
            files = realloc(files, sizeof(char*) * (file_count + 1));
            files[file_count] = strdup(entry->d_name);
            file_count++;
        }
    }
    closedir(dir);
    
    if (file_count <= keep_count) {
        // No rotation needed
        for (int i = 0; i < file_count; i++) {
            free(files[i]);
        }
        free(files);
        return 0;
    }
    
    // Sort by name (oldest first for typical timestamp naming)
    for (int i = 0; i < file_count - 1; i++) {
        for (int j = i + 1; j < file_count; j++) {
            if (strcmp(files[i], files[j]) > 0) {
                char *temp = files[i];
                files[i] = files[j];
                files[j] = temp;
            }
        }
    }
    
    // Delete or compress old files
    int to_remove = file_count - keep_count;
    for (int i = 0; i < to_remove; i++) {
        char full_path[1024];
        snprintf(full_path, sizeof(full_path), "%s/%s", log_dir, files[i]);
        
        if (compress_old) {
            char gz_path[1024];
            snprintf(gz_path, sizeof(gz_path), "%s%s", full_path, GZ_SUFFIX);
            
            if (compress_file(full_path, gz_path) == 0) {
                unlink(full_path);
            }
        } else {
            unlink(full_path);
        }
    }
    
    // Cleanup
    for (int i = 0; i < file_count; i++) {
        free(files[i]);
    }
    free(files);
    
    return 0;
}
