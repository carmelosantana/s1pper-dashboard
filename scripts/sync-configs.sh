#!/bin/bash

# Load environment variables from .env.local if it exists
if [ -f .env.local ]; then
    export $(grep -v '^#' .env.local | xargs)
fi

# Configuration with ENV fallbacks
PRINTER_IP="${PRINTER_HOST}"
PRINTER_PORT="${MOONRAKER_PORT:-7127}"

# Check if PRINTER_HOST is set
if [ -z "$PRINTER_IP" ]; then
    echo -e "${RED}✗${NC} PRINTER_HOST environment variable is not set!"
    echo -e "${YELLOW}Please set PRINTER_HOST in your .env.local file${NC}"
    echo -e "${BLUE}Example: PRINTER_HOST=192.168.1.100${NC}"
    exit 1
fi
LOCAL_CONFIGS_DIR="./public/configs"
PRINTER_API_URL="http://${PRINTER_IP}:${PRINTER_PORT}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Starting config sync from printer...${NC}"

# Create local configs directory if it doesn't exist
mkdir -p "$LOCAL_CONFIGS_DIR"

# Function to log with timestamp
log() {
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Function to download file if it doesn't exist or is different
download_file() {
    local filename="$1"
    local local_path="$LOCAL_CONFIGS_DIR/$filename"
    # URL encode the filename for the remote request
    local encoded_filename=$(printf '%s\n' "$filename" | curl -Gso /dev/null -w %{url_effective} --data-urlencode @- "" | cut -c 3-)
    local remote_url="$PRINTER_API_URL/server/files/config/$encoded_filename"
    
    # Check if file already exists locally
    if [ -f "$local_path" ]; then
        # Get local file size
        local_size=$(stat -f%z "$local_path" 2>/dev/null || stat -c%s "$local_path" 2>/dev/null || echo "0")
        
        # Get remote file size
        remote_size=$(curl -sI "$remote_url" | grep -i content-length | cut -d' ' -f2 | tr -d '\r\n')
        
        if [ "$local_size" = "$remote_size" ] && [ "$remote_size" != "" ]; then
            log "${GREEN}✓${NC} $filename already exists and is up to date"
            return 0
        fi
    fi
    
    log "${YELLOW}↓${NC} Downloading $filename..."
    
    # Download the file
    if curl -s "$remote_url" -o "$local_path"; then
        log "${GREEN}✓${NC} Downloaded $filename successfully"
        return 0
    else
        log "${RED}✗${NC} Failed to download $filename"
        return 1
    fi
}

# Fetch list of config files from printer
log "${BLUE}Fetching config file list from printer...${NC}"

file_list=$(curl -s "$PRINTER_API_URL/server/files/list?root=config")

if [ $? -ne 0 ] || [ -z "$file_list" ]; then
    log "${RED}✗${NC} Failed to fetch file list from printer"
    exit 1
fi

# Parse JSON and extract filenames
# Using basic shell parsing since we don't have jq guaranteed
filenames=$(echo "$file_list" | grep -o '"path": "[^"]*"' | cut -d'"' -f4)

if [ -z "$filenames" ]; then
    log "${YELLOW}No config files found on printer${NC}"
    exit 0
fi

# Count total files
total_files=$(echo "$filenames" | wc -l | tr -d ' ')
log "${BLUE}Found $total_files config files${NC}"

# Download each file
downloaded=0
failed=0

while IFS= read -r filename; do
    if [ -n "$filename" ]; then
        if download_file "$filename"; then
            ((downloaded++))
        else
            ((failed++))
        fi
    fi
done <<< "$filenames"

# Summary
log "${BLUE}Sync complete!${NC}"
log "${GREEN}Downloaded: $downloaded files${NC}"
if [ $failed -gt 0 ]; then
    log "${RED}Failed: $failed files${NC}"
fi

# Clean up old files that no longer exist on printer (optional)
if [ "$1" = "--clean" ]; then
    log "${BLUE}Cleaning up old files...${NC}"
    
    # Get list of local files
    if [ -d "$LOCAL_CONFIGS_DIR" ]; then
        for local_file in "$LOCAL_CONFIGS_DIR"/*; do
            if [ -f "$local_file" ]; then
                basename_file=$(basename "$local_file")
                
                # Check if this file exists in the remote list
                if ! echo "$filenames" | grep -q "^$basename_file$"; then
                    log "${YELLOW}🗑${NC}  Removing old file: $basename_file"
                    rm "$local_file"
                fi
            fi
        done
    fi
fi

echo -e "${GREEN}Config sync completed successfully!${NC}"