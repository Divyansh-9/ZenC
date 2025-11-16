#include "prom_exporter.h"
#include "cJSON.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <errno.h>

#define BUFFER_SIZE 8192

// Initialize exporter
int prom_exporter_init(PromExporter *exporter, int port, const char *sample_log_path) {
    if (!exporter) return -1;
    
    memset(exporter, 0, sizeof(PromExporter));
    exporter->port = port;
    strncpy(exporter->sample_log_path, sample_log_path, sizeof(exporter->sample_log_path) - 1);
    
    // Create socket
    exporter->socket_fd = socket(AF_INET, SOCK_STREAM, 0);
    if (exporter->socket_fd < 0) {
        perror("socket");
        return -1;
    }
    
    // Allow port reuse
    int opt = 1;
    setsockopt(exporter->socket_fd, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));
    
    // Bind to port
    struct sockaddr_in addr;
    memset(&addr, 0, sizeof(addr));
    addr.sin_family = AF_INET;
    addr.sin_addr.s_addr = INADDR_ANY;
    addr.sin_port = htons(port);
    
    if (bind(exporter->socket_fd, (struct sockaddr*)&addr, sizeof(addr)) < 0) {
        perror("bind");
        close(exporter->socket_fd);
        return -1;
    }
    
    // Listen
    if (listen(exporter->socket_fd, 5) < 0) {
        perror("listen");
        close(exporter->socket_fd);
        return -1;
    }
    
    return 0;
}

// Read latest metrics from JSONL
static int read_latest_metrics(const char *log_path, PromMetrics *metrics) {
    FILE *fp = fopen(log_path, "r");
    if (!fp) return -1;
    
    memset(metrics, 0, sizeof(PromMetrics));
    
    char line[2048];
    char last_line[2048] = {0};
    
    // Read to last line
    while (fgets(line, sizeof(line), fp)) {
        strncpy(last_line, line, sizeof(last_line) - 1);
        last_line[sizeof(last_line) - 1] = '\0';  // Ensure null termination
    }
    fclose(fp);
    
    if (last_line[0] == '\0') return -1;
    
    // Parse last sample
    cJSON *sample = cJSON_Parse(last_line);
    if (!sample) return -1;
    
    cJSON *event = cJSON_GetObjectItem(sample, "event");
    if (!event || strcmp(event->valuestring, "sample") != 0) {
        cJSON_Delete(sample);
        return -1;
    }
    
    // Extract metrics
    cJSON *item;
    if ((item = cJSON_GetObjectItem(sample, "cpu_percent"))) 
        metrics->cpu_percent = item->valuedouble;
    if ((item = cJSON_GetObjectItem(sample, "rss_bytes"))) 
        metrics->rss_bytes = item->valuedouble;
    if ((item = cJSON_GetObjectItem(sample, "vms_bytes"))) 
        metrics->vms_bytes = item->valuedouble;
    if ((item = cJSON_GetObjectItem(sample, "threads"))) 
        metrics->threads = item->valuedouble;
    if ((item = cJSON_GetObjectItem(sample, "fds_open"))) 
        metrics->fds_open = item->valuedouble;
    if ((item = cJSON_GetObjectItem(sample, "read_bytes"))) 
        metrics->read_bytes = item->valuedouble;
    if ((item = cJSON_GetObjectItem(sample, "write_bytes"))) 
        metrics->write_bytes = item->valuedouble;
    if ((item = cJSON_GetObjectItem(sample, "cpu_max"))) 
        metrics->cpu_max = item->valuedouble;
    if ((item = cJSON_GetObjectItem(sample, "rss_max"))) 
        metrics->rss_max = item->valuedouble;
    
    cJSON_Delete(sample);
    return 0;
}

// Generate Prometheus metrics text
static char* generate_metrics_text(const PromMetrics *metrics) {
    char *buffer = malloc(BUFFER_SIZE);
    if (!buffer) return NULL;
    
    int offset = 0;
    
    // Helper macro - avoid variadic macro warnings by using separate macros
    #define APPEND_STR(str) offset += snprintf(buffer + offset, BUFFER_SIZE - offset, "%s", str)
    #define APPEND_FMT(fmt, ...) offset += snprintf(buffer + offset, BUFFER_SIZE - offset, fmt, __VA_ARGS__)
    
    APPEND_STR("# HELP zencube_cpu_percent CPU usage percentage\n");
    APPEND_STR("# TYPE zencube_cpu_percent gauge\n");
    APPEND_FMT("zencube_cpu_percent %.2f\n", metrics->cpu_percent);
    
    APPEND_STR("# HELP zencube_memory_rss_bytes RSS memory in bytes\n");
    APPEND_STR("# TYPE zencube_memory_rss_bytes gauge\n");
    APPEND_FMT("zencube_memory_rss_bytes %.0f\n", metrics->rss_bytes);
    
    APPEND_STR("# HELP zencube_memory_vms_bytes VMS memory in bytes\n");
    APPEND_STR("# TYPE zencube_memory_vms_bytes gauge\n");
    APPEND_FMT("zencube_memory_vms_bytes %.0f\n", metrics->vms_bytes);
    
    APPEND_STR("# HELP zencube_threads Thread count\n");
    APPEND_STR("# TYPE zencube_threads gauge\n");
    APPEND_FMT("zencube_threads %.0f\n", metrics->threads);
    
    APPEND_STR("# HELP zencube_fds_open Open file descriptors\n");
    APPEND_STR("# TYPE zencube_fds_open gauge\n");
    APPEND_FMT("zencube_fds_open %.0f\n", metrics->fds_open);
    
    APPEND_STR("# HELP zencube_io_read_bytes_total Cumulative read bytes\n");
    APPEND_STR("# TYPE zencube_io_read_bytes_total counter\n");
    APPEND_FMT("zencube_io_read_bytes_total %.0f\n", metrics->read_bytes);
    
    APPEND_STR("# HELP zencube_io_write_bytes_total Cumulative write bytes\n");
    APPEND_STR("# TYPE zencube_io_write_bytes_total counter\n");
    APPEND_FMT("zencube_io_write_bytes_total %.0f\n", metrics->write_bytes);
    
    APPEND_STR("# HELP zencube_cpu_max_percent Maximum CPU percentage observed\n");
    APPEND_STR("# TYPE zencube_cpu_max_percent gauge\n");
    APPEND_FMT("zencube_cpu_max_percent %.2f\n", metrics->cpu_max);
    
    APPEND_STR("# HELP zencube_memory_rss_max_bytes Maximum RSS observed\n");
    APPEND_STR("# TYPE zencube_memory_rss_max_bytes gauge\n");
    APPEND_FMT("zencube_memory_rss_max_bytes %.0f\n", metrics->rss_max);
    
    #undef APPEND_STR
    #undef APPEND_FMT
    
    return buffer;
}

// Handle HTTP request
static void handle_request(int client_fd, const char *log_path) {
    char request[1024];
    ssize_t n = recv(client_fd, request, sizeof(request) - 1, 0);
    if (n <= 0) return;
    request[n] = '\0';
    
    // Check for GET /metrics
    if (strstr(request, "GET /metrics") == NULL) {
        const char *response = "HTTP/1.1 404 Not Found\r\nContent-Length: 9\r\n\r\nNot Found";
        send(client_fd, response, strlen(response), 0);
        return;
    }
    
    // Read metrics
    PromMetrics metrics;
    if (read_latest_metrics(log_path, &metrics) != 0) {
        const char *response = "HTTP/1.1 503 Service Unavailable\r\nContent-Length: 17\r\n\r\nNo metrics found\n";
        send(client_fd, response, strlen(response), 0);
        return;
    }
    
    // Generate metrics text
    char *metrics_text = generate_metrics_text(&metrics);
    if (!metrics_text) {
        const char *response = "HTTP/1.1 500 Internal Server Error\r\nContent-Length: 14\r\n\r\nServer Error\n";
        send(client_fd, response, strlen(response), 0);
        return;
    }
    
    // Send HTTP response
    char header[512];
    snprintf(header, sizeof(header),
             "HTTP/1.1 200 OK\r\n"
             "Content-Type: text/plain; version=0.0.4\r\n"
             "Content-Length: %zu\r\n"
             "Connection: close\r\n"
             "\r\n",
             strlen(metrics_text));
    
    send(client_fd, header, strlen(header), 0);
    send(client_fd, metrics_text, strlen(metrics_text), 0);
    
    free(metrics_text);
}

// Run exporter server
int prom_exporter_run(PromExporter *exporter) {
    if (!exporter || exporter->socket_fd < 0) return -1;
    
    printf("Prometheus exporter running on port %d\n", exporter->port);
    printf("Metrics available at: http://localhost:%d/metrics\n", exporter->port);
    
    while (1) {
        struct sockaddr_in client_addr;
        socklen_t client_len = sizeof(client_addr);
        
        int client_fd = accept(exporter->socket_fd, (struct sockaddr*)&client_addr, &client_len);
        if (client_fd < 0) {
            if (errno == EINTR) continue;  // Interrupted by signal
            perror("accept");
            break;
        }
        
        handle_request(client_fd, exporter->sample_log_path);
        close(client_fd);
    }
    
    return 0;
}

// Cleanup
void prom_exporter_cleanup(PromExporter *exporter) {
    if (exporter && exporter->socket_fd >= 0) {
        close(exporter->socket_fd);
        exporter->socket_fd = -1;
    }
}
