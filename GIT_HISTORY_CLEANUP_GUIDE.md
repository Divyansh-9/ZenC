# Git Repository Cleanup Guide - ZenCube
**Professional Repository Size Reduction Plan**

---

## Current Status
- **Repository Size:** 4.7 GB (UNACCEPTABLE)
- **Root Cause:** Large binary files (ML models, build artifacts) committed to Git history
- **Objective:** Permanently reduce repository to minimal size (<100 MB)

---

## Part 1: Clean the Present ✅ COMPLETED

### Updated .gitignore
The `.gitignore` file has been updated with professional standards:

```gitignore
# Node.js
/node_modules/
/npm-debug.log
/yarn-error.log

# Electron Build Artifacts
/dist/
/release/
/build/
/electron-builder-cache/
/electron-builder-debug.yml

# C-Core Build Artifacts
/core_c/bin/
/core_c/*.o
/core_c/*.d

# UI Test Program Artifacts
/ui_test_programs/bin/
/ui_test_programs/*.o

# Large ML Model Files (Should NEVER be committed)
*.pt
*.pth
*.pkl
*.pickle
*.h5
*.onnx
*.pb
/models/
/backup_phase4_archive/

# OS & IDE Junk
.DS_Store
.vscode/
*.log
```

### Applied Changes
```bash
# Status: ALREADY EXECUTED
git rm -r --cached .
git add .
```

**Result:** Current working directory now respects `.gitignore`. Large files marked for deletion in next commit.

---

## Part 2: Clean the Past - EXECUTE THIS NOW

### ⚠️ CRITICAL WARNING
**Before proceeding:**
1. **Backup your repository** (create a mirror clone)
2. **Coordinate with team** (force-push will rewrite history)
3. **Run on a separate clone first** (test before applying to main repo)

---

## Step 1: Create Mirror Clone (BACKUP)

```bash
# Navigate to parent directory
cd ~/Downloads

# Create mirror clone as backup
git clone --mirror /home/Idred/Downloads/ZenCube zencube-backup.git

# Verify backup
du -sh zencube-backup.git
# Expected: ~4.7 GB
```

---

## Step 2: Download BFG Repo-Cleaner

```bash
# Download BFG (latest version)
cd ~/Downloads
wget https://repo1.maven.org/maven2/com/madgag/bfg/1.14.0/bfg-1.14.0.jar -O bfg.jar

# Verify download
java -jar bfg.jar --version
# Expected output: bfg 1.14.0
```

---

## Step 3: Execute BFG Cleanup

### Target Files/Folders for Permanent Deletion:

**Folders:**
- `node_modules` (build artifact, should never be committed)
- `backup_phase4_archive` (contains large ML models)
- `models` (contains *.pt, *.pkl files)
- `dist` (Electron build output)
- `release` (Electron release builds)
- `build` (temporary build artifacts)

**File Extensions:**
- `*.pt` (PyTorch models - LARGE)
- `*.pth` (PyTorch models - LARGE)
- `*.pkl` (Pickle files - ML artifacts)
- `*.pickle` (Pickle files)
- `*.AppImage` (Linux builds - LARGE)
- `*.exe` (Windows builds - LARGE)
- `*.deb` (Debian packages - LARGE)
- `*.dmg` (macOS builds - LARGE)
- `*.zip` (Archives - potentially large)

### **FINALIZED BFG COMMAND:**

```bash
# Navigate to parent directory
cd ~/Downloads

# Run BFG on the MIRROR clone
java -jar bfg.jar \
  --strip-blobs-bigger-than 10M \
  --delete-folders node_modules \
  --delete-folders backup_phase4_archive \
  --delete-folders models \
  --delete-folders dist \
  --delete-folders release \
  --delete-folders build \
  --delete-folders electron-builder-cache \
  --delete-files "*.pt" \
  --delete-files "*.pth" \
  --delete-files "*.pkl" \
  --delete-files "*.pickle" \
  --delete-files "*.AppImage" \
  --delete-files "*.exe" \
  --delete-files "*.deb" \
  --delete-files "*.dmg" \
  --delete-files "*.zip" \
  --no-blob-protection \
  zencube-backup.git
```

**Explanation:**
- `--strip-blobs-bigger-than 10M` - Remove any file >10MB from history
- `--delete-folders <folder>` - Remove entire folders from all commits
- `--delete-files "*.ext"` - Remove files matching pattern from all commits
- `--no-blob-protection` - Process ALL commits (including HEAD)
- `zencube-backup.git` - Target the mirror clone (safety first!)

**Expected Output:**
```
BFG Repo-Cleaner
-----------------
Using repo : /home/user/Downloads/zencube-backup.git

Found XXX commits
Found XXX blobs to delete
Deleting X GB of data

Cleaning...
[Progress bar]

Done!
```

---

## Step 4: Git Garbage Collection

After BFG completes, you MUST run Git's garbage collection to finalize the deletion and shrink the `.git` folder.

```bash
# Navigate into the cleaned mirror repository
cd ~/Downloads/zencube-backup.git

# Step 1: Expire all old reflog entries
git reflog expire --expire=now --all

# Step 2: Run aggressive garbage collection
git gc --prune=now --aggressive

# Step 3: Verify size reduction
du -sh .
# Expected: <500 MB (down from 4.7 GB)
```

**Explanation:**
- `git reflog expire --expire=now --all` - Remove all reflog history (orphan the deleted blobs)
- `git gc --prune=now --aggressive` - Garbage collect and repack, removing unreferenced objects
- `du -sh .` - Check final repository size

---

## Step 5: Clone Clean Repository

```bash
# Navigate to parent directory
cd ~/Downloads

# Clone from cleaned mirror to working repository
git clone zencube-backup.git ZenCube-clean

# Navigate into clean repo
cd ZenCube-clean

# Verify size
du -sh .git
# Expected: <100 MB

# Verify functionality
ls -lh
# Should see all source files, NO large binaries
```

---

## Step 6: Force Push to Remote (⚠️ DANGER ZONE)

**⚠️ CRITICAL WARNINGS:**
1. **Coordinate with ALL team members** - They will need to re-clone
2. **Backup remote** - Create GitHub release/tag as backup point
3. **Test locally first** - Ensure clean repo works correctly
4. **Off-hours deployment** - Do this when no one is actively working

### Pre-Push Checklist:
- [ ] Tested clean repository locally
- [ ] Application builds successfully
- [ ] All team members notified
- [ ] Backup created on remote (tag/release)
- [ ] Ready to force-push

### Force Push Commands:

```bash
# Navigate to clean repository
cd ~/Downloads/ZenCube-clean

# Add remote (if not already set)
git remote add origin git@github.com:Divyansh-9/ZenCube.git

# Force push ALL branches and tags
git push origin --force --all
git push origin --force --tags

# Alternative: Force push specific branch only
git push origin feature/phase3-core-c --force
```

---

## Step 7: Team Migration Instructions

**Send this to all team members:**

```markdown
🚨 REPOSITORY HISTORY REWRITE - ACTION REQUIRED 🚨

We have cleaned the Git history to reduce repository size from 4.7 GB to <100 MB.

**YOU MUST RE-CLONE THE REPOSITORY:**

1. Backup your local changes:
   ```bash
   cd ~/path/to/ZenCube
   git stash
   git branch my-backup-branch
   ```

2. Delete old repository:
   ```bash
   cd ~/path/to
   rm -rf ZenCube
   ```

3. Fresh clone:
   ```bash
   git clone git@github.com:Divyansh-9/ZenCube.git
   cd ZenCube
   ```

4. Restore your changes (if needed):
   ```bash
   # Apply stashed changes
   git stash pop

   # Or cherry-pick from backup
   git cherry-pick <commit-hash>
   ```

**DO NOT:**
- ❌ Try to `git pull` on old clone (will fail)
- ❌ Force push your old local commits (will re-introduce bloat)

**Verification:**
```bash
du -sh .git
# Should be <100 MB
```
```

---

## Step 8: Prevent Future Bloat

### Pre-Commit Hook (Recommended)

Create `.git/hooks/pre-commit`:

```bash
#!/bin/bash

# Prevent large files from being committed
MAX_SIZE=5242880 # 5 MB in bytes

# Get list of files being committed
files=$(git diff --cached --name-only --diff-filter=ACM)

for file in $files; do
    if [ -f "$file" ]; then
        size=$(stat -c%s "$file" 2>/dev/null || stat -f%z "$file" 2>/dev/null)
        if [ $size -gt $MAX_SIZE ]; then
            echo "❌ ERROR: File $file is too large ($(($size / 1024 / 1024)) MB)"
            echo "   Maximum allowed: 5 MB"
            echo "   Add to .gitignore or use Git LFS for large files"
            exit 1
        fi
    fi
done

exit 0
```

Make executable:
```bash
chmod +x .git/hooks/pre-commit
```

### GitHub Actions (CI Check)

Create `.github/workflows/size-check.yml`:

```yaml
name: Repository Size Check

on: [push, pull_request]

jobs:
  check-size:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Check for large files
        run: |
          find . -type f -size +5M | while read file; do
            echo "❌ Large file detected: $file ($(du -h "$file" | cut -f1))"
            exit 1
          done
```

---

## Verification Checklist

After completing all steps:

- [ ] **Backup created** (`zencube-backup.git` exists)
- [ ] **BFG executed** (no errors)
- [ ] **Garbage collection complete** (repository size reduced)
- [ ] **Clean clone tested** (application builds and runs)
- [ ] **`.git` folder size** (<100 MB)
- [ ] **Force push completed** (remote updated)
- [ ] **Team notified** (migration instructions sent)
- [ ] **Pre-commit hook installed** (prevents future bloat)

---

## Expected Results

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| **Repository Size** | 4.7 GB | <100 MB | **98%** reduction |
| **`.git` Folder** | ~4 GB | <50 MB | **99%** reduction |
| **Clone Time** | 5-10 min | <30 sec | **90%** faster |
| **Disk Usage** | High | Minimal | Sustainable |

---

## Troubleshooting

### "This will rewrite history" Warning
**Expected.** That's the entire point - we're removing files from past commits.

### Team Member Gets "Non-fast-forward" Error
**Solution:** They must re-clone (cannot pull after history rewrite).

### Application Doesn't Build After Cleanup
**Check:**
1. `.gitignore` excludes build artifacts (not source)
2. `package.json` and source files still present
3. Run `npm install` to regenerate `node_modules`

### Repository Still Large After BFG
**Cause:** Garbage collection not run or run incorrectly  
**Solution:** Re-run Step 4 (git gc --prune=now --aggressive)

---

## Final Notes

**Success Criteria:**
- ✅ Repository <100 MB
- ✅ All source code intact
- ✅ Application builds successfully
- ✅ No large files in `.git/objects/`

**This is a ONE-TIME operation.** Once complete, the repository history is permanently rewritten. There is no "undo" after force-pushing to remote.

**Use Git LFS for future large files** (if absolutely necessary):
```bash
git lfs track "*.pt"
git lfs track "*.pkl"
```

---

**Prepared:** 2024-11-17  
**Agent:** GitHub Copilot (Engineering General)  
**Status:** Ready for Execution ⚠️
