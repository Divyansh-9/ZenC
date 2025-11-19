/**
 * ML Test Pattern Generator
 * 
 * Creates interesting CPU and memory patterns for ML anomaly detection testing.
 * This program simulates different behavioral patterns that should trigger ML analysis.
 */

#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <string.h>
#include <time.h>

// Function to consume CPU in a burst pattern
void cpu_burst(int duration_ms) {
    clock_t start = clock();
    clock_t end = start + (duration_ms * CLOCKS_PER_SEC / 1000);
    
    volatile long long sum = 0;
    while (clock() < end) {
        sum += rand();
    }
}

// Function to allocate memory in chunks
void* allocate_memory(size_t bytes) {
    void* ptr = malloc(bytes);
    if (ptr) {
        memset(ptr, 0xAA, bytes);  // Touch the memory to ensure it's allocated
    }
    return ptr;
}

int main(int argc, char* argv[]) {
    printf("ML Test Pattern Generator\n");
    printf("==========================\n");
    printf("This program creates patterns for ML anomaly detection.\n");
    printf("Watch the AI Anomaly Detection tab for analysis results.\n\n");
    
    int pattern = 1;
    if (argc > 1) {
        pattern = atoi(argv[1]);
    }
    
    switch (pattern) {
        case 1:
            printf("Pattern 1: Gradual CPU increase (Normal behavior)\n");
            printf("This should be detected as NORMAL by ML.\n\n");
            for (int i = 0; i < 20; i++) {
                printf("Iteration %d: CPU load %d%%\n", i+1, (i+1)*5);
                cpu_burst(50 + i*25);  // Gradual increase
                sleep(1);
            }
            break;
            
        case 2:
            printf("Pattern 2: Sudden CPU spike (Anomalous behavior)\n");
            printf("This should be detected as ANOMALOUS by ML.\n\n");
            for (int i = 0; i < 15; i++) {
                if (i == 7) {
                    printf("!!! SUDDEN SPIKE at iteration %d !!!\n", i+1);
                    cpu_burst(800);  // Sudden spike
                } else {
                    printf("Iteration %d: Normal load\n", i+1);
                    cpu_burst(50);   // Low load
                }
                sleep(1);
            }
            break;
            
        case 3:
            printf("Pattern 3: Memory leak simulation (Anomalous behavior)\n");
            printf("This should be detected as ANOMALOUS by ML.\n\n");
            void* ptrs[20];
            for (int i = 0; i < 20; i++) {
                size_t bytes = (i + 1) * 5 * 1024 * 1024;  // 5MB, 10MB, 15MB...
                printf("Iteration %d: Allocating %zu MB (total: %zu MB)\n", 
                       i+1, bytes/(1024*1024), (i+1)*(i+2)/2 * 5);
                ptrs[i] = allocate_memory(bytes);
                if (!ptrs[i]) {
                    printf("Memory allocation failed!\n");
                    break;
                }
                sleep(1);
            }
            printf("\nCleaning up memory...\n");
            for (int i = 0; i < 20; i++) {
                if (ptrs[i]) free(ptrs[i]);
            }
            break;
            
        case 4:
            printf("Pattern 4: Oscillating behavior (Suspicious pattern)\n");
            printf("This should trigger ML analysis.\n\n");
            for (int i = 0; i < 20; i++) {
                if (i % 2 == 0) {
                    printf("Iteration %d: HIGH CPU load\n", i+1);
                    cpu_burst(600);
                } else {
                    printf("Iteration %d: LOW CPU load\n", i+1);
                    cpu_burst(50);
                }
                sleep(1);
            }
            break;
            
        case 5:
            printf("Pattern 5: Combined CPU + Memory anomaly\n");
            printf("This creates a complex anomaly for ML to detect.\n\n");
            void* mem_ptr = NULL;
            for (int i = 0; i < 25; i++) {
                if (i == 10) {
                    printf("!!! ANOMALY: Simultaneous CPU spike + memory surge !!!\n");
                    cpu_burst(700);
                    mem_ptr = allocate_memory(50 * 1024 * 1024);  // 50MB sudden allocation
                } else {
                    printf("Iteration %d: Normal behavior\n", i+1);
                    cpu_burst(100);
                }
                sleep(1);
            }
            if (mem_ptr) free(mem_ptr);
            break;
            
        default:
            printf("Invalid pattern. Use: %s [1-5]\n", argv[0]);
            printf("  1: Gradual CPU increase (Normal)\n");
            printf("  2: Sudden CPU spike (Anomalous)\n");
            printf("  3: Memory leak (Anomalous)\n");
            printf("  4: Oscillating behavior (Suspicious)\n");
            printf("  5: Combined CPU + Memory anomaly\n");
            return 1;
    }
    
    printf("\nPattern complete! Check the AI Anomaly Detection tab.\n");
    return 0;
}
