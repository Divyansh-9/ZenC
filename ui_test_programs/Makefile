# Makefile for UI Test Programs
# Compiles all test programs to bin/ directory

CC = gcc
CFLAGS = -std=c11 -Wall -Wextra -Wpedantic -O2 -D_GNU_SOURCE -D_POSIX_C_SOURCE=200809L
BINDIR = bin

# Source files
SOURCES = infinite_loop.c memory_hog.c fork_bomb.c file_writer.c network_test.c

# Binary targets (without .c extension)
BINARIES = $(SOURCES:.c=)
TARGET_BINS = $(addprefix $(BINDIR)/, $(BINARIES))

.PHONY: all clean

all: $(BINDIR) $(TARGET_BINS)

$(BINDIR):
	mkdir -p $(BINDIR)

$(BINDIR)/%: %.c
	$(CC) $(CFLAGS) -o $@ $<

clean:
	rm -rf $(BINDIR)
	rm -f *.o

# Individual targets for clarity
$(BINDIR)/infinite_loop: infinite_loop.c
$(BINDIR)/memory_hog: memory_hog.c
$(BINDIR)/fork_bomb: fork_bomb.c
$(BINDIR)/file_writer: file_writer.c
$(BINDIR)/network_test: network_test.c
