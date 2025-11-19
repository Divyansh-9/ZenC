# Makefile for ML Anomaly Detection Test Suite
# Builds test programs designed to trigger ML anomaly detection

CC = gcc
CFLAGS = -std=c11 -Wall -Wextra -O2 -pthread
BINDIR = bin

# Test programs that SHOULD trigger anomalies
TARGETS = \
	$(BINDIR)/cpu_spike_attack \
	$(BINDIR)/memory_leak_progressive \
	$(BINDIR)/fork_bomb_gradual \
	$(BINDIR)/io_storm_writer \
	$(BINDIR)/resource_exhaustion_combo \
	$(BINDIR)/ml_test_pattern

all: $(BINDIR) $(TARGETS)

$(BINDIR):
	mkdir -p $(BINDIR)

$(BINDIR)/cpu_spike_attack: cpu_spike_attack.c
	$(CC) $(CFLAGS) $< -o $@

$(BINDIR)/memory_leak_progressive: memory_leak_progressive.c
	$(CC) $(CFLAGS) $< -o $@

$(BINDIR)/fork_bomb_gradual: fork_bomb_gradual.c
	$(CC) $(CFLAGS) $< -o $@

$(BINDIR)/io_storm_writer: io_storm_writer.c
	$(CC) $(CFLAGS) $< -o $@

$(BINDIR)/resource_exhaustion_combo: resource_exhaustion_combo.c
	$(CC) $(CFLAGS) $< -o $@

# Copy ml_test_pattern from ui_test_programs
$(BINDIR)/ml_test_pattern: ../ui_test_programs/ml_test_pattern.c
	$(CC) $(CFLAGS) $< -o $@

clean:
	rm -rf $(BINDIR)
	rm -f /tmp/io_storm_test_*.dat
	rm -f /tmp/exhaust_*.tmp

.PHONY: all clean
