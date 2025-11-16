#include "logutil.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <getopt.h>

static void print_usage(const char *prog) {
    fprintf(stderr, "Usage: %s --dir <log_directory> [--keep <N>] [--compress]\n", prog);
    fprintf(stderr, "Options:\n");
    fprintf(stderr, "  --dir PATH      Directory containing .jsonl logs\n");
    fprintf(stderr, "  --keep N        Keep N most recent files (default: 10)\n");
    fprintf(stderr, "  --compress      Compress old logs with gzip\n");
    fprintf(stderr, "  --help          Show this help\n");
}

int main(int argc, char **argv) {
    char *log_dir = NULL;
    int keep = 10;
    int compress = 0;
    
    static struct option long_options[] = {
        {"dir",      required_argument, 0, 'd'},
        {"keep",     required_argument, 0, 'k'},
        {"compress", no_argument,       0, 'c'},
        {"help",     no_argument,       0, 'h'},
        {0, 0, 0, 0}
    };
    
    int opt;
    while ((opt = getopt_long(argc, argv, "d:k:ch", long_options, NULL)) != -1) {
        switch (opt) {
            case 'd': log_dir = optarg; break;
            case 'k': keep = atoi(optarg); break;
            case 'c': compress = 1; break;
            case 'h':
            default:
                print_usage(argv[0]);
                return opt == 'h' ? 0 : 1;
        }
    }
    
    if (!log_dir) {
        fprintf(stderr, "Error: Missing required --dir argument\n");
        print_usage(argv[0]);
        return 1;
    }
    
    printf("Log rotation starting\n");
    printf("Directory: %s\n", log_dir);
    printf("Keep: %d files\n", keep);
    printf("Compress: %s\n", compress ? "yes" : "no");
    
    // Perform rotation
    if (rotate_logs(log_dir, ".jsonl", keep, compress) != 0) {
        fprintf(stderr, "Log rotation failed\n");
        return 1;
    }
    
    printf("Log rotation completed successfully\n");
    return 0;
}
