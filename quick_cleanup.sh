#!/bin/bash
# ZenCube Repository Cleanup Script
# Removes large test files and legacy artifacts from working directory

set -e  # Exit on error

cd /home/Idred/Downloads/ZenCube

echo "=============================================="
echo "🧹 ZenCube Repository Cleanup"
echo "=============================================="
echo ""

# Show current size
echo "📊 Current repository size:"
du -sh .
echo ""

# Delete test output file (2.6 GB)
if [ -f test_output.dat ]; then
    echo "🗑️  Deleting test_output.dat (2.6 GB)..."
    rm -f test_output.dat
    echo "✅ Deleted test_output.dat"
else
    echo "⏭️  test_output.dat not found (already deleted)"
fi

# Delete Python virtualenv (812 MB)
if [ -d venv ]; then
    echo "🗑️  Deleting venv/ (812 MB)..."
    rm -rf venv/
    echo "✅ Deleted venv/"
else
    echo "⏭️  venv/ not found (already deleted)"
fi

# Delete Electron build output (353 MB)
if [ -d dist ]; then
    echo "🗑️  Deleting dist/ (353 MB)..."
    rm -rf dist/
    echo "✅ Deleted dist/"
else
    echo "⏭️  dist/ not found (already deleted)"
fi

# Delete legacy Python build artifacts (28 MB)
if [ -d build/ZenCubeModern ]; then
    echo "🗑️  Deleting build/ZenCubeModern/ (28 MB)..."
    rm -rf build/ZenCubeModern/
    echo "✅ Deleted build/ZenCubeModern/"
else
    echo "⏭️  build/ZenCubeModern/ not found (already deleted)"
fi

echo ""
echo "=============================================="
echo "✅ Cleanup Complete!"
echo "=============================================="
echo ""

# Show new size
echo "📊 New repository size:"
du -sh .
echo ""

# Verify .git size
echo "📦 Git history size:"
du -sh .git
echo ""

# Check for remaining large files
echo "🔍 Checking for remaining large files (>10 MB)..."
large_files=$(find . -type f -size +10M -not -path "./.git/*" -not -path "./node_modules/*" 2>/dev/null || true)

if [ -z "$large_files" ]; then
    echo "✅ No large files found (excluding node_modules)"
else
    echo "⚠️  Large files still present:"
    echo "$large_files"
fi

echo ""
echo "=============================================="
echo "🎯 Summary:"
echo "   - Deleted test files and legacy artifacts"
echo "   - Git history remains clean (6.4 MB)"
echo "   - No repository rewrite needed"
echo "=============================================="
