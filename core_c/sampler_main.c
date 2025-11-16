#include "sampler.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <getopt.h>

static void print_usage(const char *prog) {
    printf("Usage: %s --pid PID --interval SECONDS --run-id ID --out PATH\n", prog);
    printf("\nOptions:\n");
    printf("  --pid PID          Process ID to monitor\n");
    printf("  --interval SECS    Sampling interval in seconds (default: 1.0)\n");
    printf("  --run-id ID        Unique run identifier\n");
    printf("  --out PATH         Output JSONL file path\n");
    printf("  --help             Show this help message\n");
    printf("\nExample:\n");
    printf("  %s --pid 12345 --interval 1.0 --run-id monitor_run_123 --out log.jsonl\n", prog);
}

int main(int argc, char *argv[]) {
    SamplerConfig config = {0};
    config.interval = 1.0;
    config.pid = 0;
    
    static struct option long_options[] = {
        {"pid",      required_argument, 0, 'p'},
        {"interval", required_argument, 0, 'i'},
        {"run-id",   required_argument, 0, 'r'},
        {"out",      required_argument, 0, 'o'},
        {"help",     no_argument,       0, 'h'},
        {0, 0, 0, 0}
    };
    
    int opt, option_index = 0;
    while ((opt = getopt_long(argc, argv, "p:i:r:o:h", long_options, &option_index)) != -1) {
        switch (opt) {
            case 'p':
                config.pid = atoi(optarg);
                break;
            case 'i':
                config.interval = atof(optarg);
                break;
            case 'r':
                strncpy(config.run_id, optarg, sizeof(config.run_id) - 1);
                break;
            case 'o':
                strncpy(config.output_path, optarg, sizeof(config.output_path) - 1);
                break;
            case 'h':
                print_usage(argv[0]);
                return 0;
            default:
                print_usage(argv[0]);
                return 1;
        }
    }
    
    if (config.pid <= 0 || config.run_id[0] == '\0' || config.output_path[0] == '\0') {
        fprintf(stderr, "Error: --pid, --run-id, and --out are required\n");
        print_usage(argv[0]);
        return 1;
    }
    
    printf("Starting sampler for PID %d (interval: %.2fs)\n", config.pid, config.interval);
    printf("Writing to: %s\n", config.output_path);
    
    if (sampler_init(&config) != 0) {
        fprintf(stderr, "Failed to initialize sampler\n");
        return 1;
    }
    
    int result = sampler_run(&config);
    
    printf("Sampling completed\n");
    return result;
}
