/**
 * I/O Storm Simulator
 * 
 * Purpose: Trigger ML anomaly detection for I/O storm behavior
 * Expected: Moderate-High anomaly score (0.6-0.8) with "io_storm" classification
 * 
 * This program writes massive amounts of data rapidly to trigger I/O anomaly detection.
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <time.h>

#define MB (1024 * 1024)
#define CHUNK_SIZE (1 * MB)  // 1MB chunks

int main(int argc, char* argv[]) {
    printf("╔══════════════════════════════════════════════════════════╗\n");
    printf("║          I/O STORM SIMULATOR (ML Test)                  ║\n");
    printf("╚══════════════════════════════════════════════════════════╝\n\n");
    
    printf("⚠️  This program is designed to trigger ML anomaly detection.\n");
    printf("📊 Expected: I/O Storm Anomaly (score: 0.6-0.8)\n");
    printf("🎯 Pattern: Sustained high I/O throughput (>10 MB/s)\n\n");
    
    char* buffer = malloc(CHUNK_SIZE);
    if (!buffer) {
        fprintf(stderr, "Failed to allocate buffer!\n");
        return 1;
    }
    
    // Fill buffer with data
    memset(buffer, 'A', CHUNK_SIZE);
    
    char temp_filename[256];
    snprintf(temp_filename, sizeof(temp_filename), "/tmp/io_storm_test_%d.dat", getpid());
    
    printf("Phase 1/3: Normal I/O (low throughput)...\n");
    FILE* fp = fopen(temp_filename, "wb");
    if (!fp) {
        fprintf(stderr, "Failed to open temp file: %s\n", temp_filename);
        free(buffer);
        return 1;
    }
    
    // Phase 1: Normal I/O
    for (int i = 0; i < 3; i++) {
        fwrite(buffer, 1, CHUNK_SIZE, fp);
        fflush(fp);
        printf("  [%d/3] Wrote 1 MB (normal rate)\n", i+1);
        sleep(1);
    }
    
    printf("\n🚨 Phase 2/3: I/O STORM - Rapid writes!\n");
    
    // Phase 2: I/O Storm (write rapidly)
    size_t total_written = 0;
    time_t start_time = time(NULL);
    
    for (int i = 0; i < 150; i++) {  // Write 150 MB total
        size_t written = fwrite(buffer, 1, CHUNK_SIZE, fp);
        fflush(fp);  // Force actual I/O
        total_written += written;
        
        if (i % 10 == 0) {
            time_t elapsed = time(NULL) - start_time;
            if (elapsed == 0) elapsed = 1;
            double rate = (double)total_written / (double)elapsed / MB;
            printf("  🔴 [%d/150] Written: %zu MB | Rate: %.1f MB/s (ANOMALOUS)\n", 
                   i+1, total_written / MB, rate);
        }
        
        // Very short delay to sustain high throughput
        usleep(10000);  // 10ms delay = ~100 MB/s theoretical max
    }
    
    time_t end_time = time(NULL);
    double duration = (double)(end_time - start_time);
    if (duration == 0) duration = 1;
    double avg_rate = (double)total_written / duration / MB;
    
    printf("\n📊 I/O Storm Statistics:\n");
    printf("  Total Written: %zu MB\n", total_written / MB);
    printf("  Duration: %.1f seconds\n", duration);
    printf("  Average Rate: %.1f MB/s\n", avg_rate);
    
    printf("\nPhase 3/3: Returning to normal I/O...\n");
    for (int i = 0; i < 3; i++) {
        fwrite(buffer, 1, CHUNK_SIZE, fp);
        fflush(fp);
        printf("  [%d/3] Wrote 1 MB (normal rate)\n", i+1);
        sleep(1);
    }
    
    fclose(fp);
    
    printf("\n╔══════════════════════════════════════════════════════════╗\n");
    printf("║                I/O STORM TEST COMPLETE                   ║\n");
    printf("╚══════════════════════════════════════════════════════════╝\n");
    printf("\n📈 Peak I/O Rate: %.1f MB/s\n", avg_rate);
    printf("🔍 Check ML Anomaly Detection tab for analysis.\n");
    printf("✓ Expected: isAnomalous=true, anomalyType='io_storm'\n\n");
    
    // Cleanup
    printf("Cleaning up temp file: %s\n", temp_filename);
    unlink(temp_filename);
    free(buffer);
    
    return 0;
}
