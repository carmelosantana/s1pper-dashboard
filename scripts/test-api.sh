#!/bin/bash

# API Testing Script for s1pper-dashboard
# Tests all major API endpoints and displays results

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="${BASE_URL:-http://localhost:3000}"
VERBOSE="${VERBOSE:-false}"

# Print header
echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}S1pper Dashboard API Tests${NC}"
echo -e "${BLUE}================================${NC}"
echo ""
echo -e "${BLUE}Base URL:${NC} $BASE_URL"
echo ""

# Helper function to test endpoint
test_endpoint() {
    local name=$1
    local url=$2
    local method=${3:-GET}
    
    echo -e "${YELLOW}Testing:${NC} $name"
    echo -e "${BLUE}URL:${NC} $url"
    
    response=$(curl -s -w "\n%{http_code}" -X $method "$url")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
        echo -e "${GREEN}✓ Status: $http_code${NC}"
        
        if [ "$VERBOSE" = "true" ]; then
            echo -e "${BLUE}Response:${NC}"
            echo "$body" | jq '.' 2>/dev/null || echo "$body"
        else
            # Show summary
            if command -v jq &> /dev/null; then
                summary=$(echo "$body" | jq -c 'if type == "object" then keys else type end' 2>/dev/null || echo "")
                if [ -n "$summary" ]; then
                    echo -e "${BLUE}Keys:${NC} $summary"
                fi
            fi
        fi
        echo ""
        return 0
    else
        echo -e "${RED}✗ Status: $http_code${NC}"
        if [ "$VERBOSE" = "true" ]; then
            echo -e "${RED}Response:${NC}"
            echo "$body"
        fi
        echo ""
        return 1
    fi
}

# Track results
passed=0
failed=0

# Test Printer Endpoints
echo -e "${BLUE}==== Printer Endpoints ====${NC}"
echo ""

if test_endpoint "Printer Status" "$BASE_URL/api/printer/status"; then
    ((passed++))
else
    ((failed++))
fi

if test_endpoint "Temperature History" "$BASE_URL/api/printer/temperature-history"; then
    ((passed++))
else
    ((failed++))
fi

if test_endpoint "Lifetime Statistics" "$BASE_URL/api/printer/lifetime-stats"; then
    ((passed++))
else
    ((failed++))
fi

# Test Camera Endpoints
echo -e "${BLUE}==== Camera Endpoints ====${NC}"
echo ""

if test_endpoint "Camera Info" "$BASE_URL/api/camera/info"; then
    ((passed++))
else
    ((failed++))
fi

# Snapshot might fail if camera is not available
if test_endpoint "Camera Snapshot" "$BASE_URL/api/camera/snapshot" 2>/dev/null; then
    ((passed++))
else
    echo -e "${YELLOW}⚠ Camera snapshot unavailable (this is normal if camera is off)${NC}"
    echo ""
fi

# Test Guestbook Endpoints
echo -e "${BLUE}==== Guestbook Endpoints ====${NC}"
echo ""

if test_endpoint "Guestbook Entries (GET)" "$BASE_URL/api/guestbook"; then
    ((passed++))
else
    ((failed++))
fi

# Test Settings Endpoints
echo -e "${BLUE}==== Settings Endpoints ====${NC}"
echo ""

if test_endpoint "Settings (GET)" "$BASE_URL/api/settings"; then
    ((passed++))
else
    ((failed++))
fi

# Test Config Endpoints
echo -e "${BLUE}==== Config Endpoints ====${NC}"
echo ""

if test_endpoint "Printer Config" "$BASE_URL/api/config/printer.cfg"; then
    ((passed++))
else
    ((failed++))
fi

# Summary
echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}Test Summary${NC}"
echo -e "${BLUE}================================${NC}"
echo -e "${GREEN}Passed: $passed${NC}"
echo -e "${RED}Failed: $failed${NC}"
echo ""

if [ $failed -eq 0 ]; then
    echo -e "${GREEN}All critical tests passed! ✓${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed. Check the output above for details.${NC}"
    exit 1
fi
