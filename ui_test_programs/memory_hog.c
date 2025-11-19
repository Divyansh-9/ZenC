/*
 * memory_hog.c - Memory stress test
 * Rapidly allocates memory to test memory limits
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

#define CHUNK_SIZE (10 * 1024 * 1024) // 10 MB chunks

int main(void) {
    printf("Starting memory allocation test...\n");
    fflush(stdout);
    
    unsigned long total = 0;
    int count = 0;
    
    while (1) {
        char *block = malloc(CHUNK_SIZE);
        if (!block) {
            fprintf(stderr, "malloc failed after %lu MB\n", total / (1024 * 1024));
            break;
        }
        
        // Touch the memory to ensure it's actually allocated
        memset(block, 0xAB, CHUNK_SIZE);
        
        total += CHUNK_SIZE;
        count++;
        
        if (count % 10 == 0) {
            printf("Allocated: %lu MB (%d chunks)\n", 
                   total / (1024 * 1024), count);
            fflush(stdout);
        }
        
        usleep(100000); // 100ms delay to make it observable
    }
    
    return 1;
}
