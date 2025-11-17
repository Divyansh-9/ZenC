/*
 * file_writer.c - File size test
 * Writes a large file to test file size limits
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

#define CHUNK_SIZE 1048576 // 1 MB
#define OUTPUT_FILE "test_output.dat"

int main(void) {
    printf("Starting file write test...\n");
    printf("Output file: %s\n", OUTPUT_FILE);
    fflush(stdout);
    
    FILE *fp = fopen(OUTPUT_FILE, "wb");
    if (!fp) {
        perror("fopen");
        return 1;
    }
    
    char *buffer = malloc(CHUNK_SIZE);
    if (!buffer) {
        fprintf(stderr, "malloc failed\n");
        fclose(fp);
        return 1;
    }
    
    // Fill buffer with pattern
    memset(buffer, 0xCD, CHUNK_SIZE);
    
    unsigned long total = 0;
    unsigned int count = 0;
    
    while (1) {
        size_t written = fwrite(buffer, 1, CHUNK_SIZE, fp);
        if (written != CHUNK_SIZE) {
            fprintf(stderr, "Write failed after %lu MB\n", total / (1024 * 1024));
            break;
        }
        
        total += written;
        count++;
        
        if (count % 100 == 0) {
            printf("Written: %lu MB\n", total / (1024 * 1024));
            fflush(stdout);
            fflush(fp);
        }
        
        usleep(10000); // 10ms delay
    }
    
    free(buffer);
    fclose(fp);
    
    return 0;
}
