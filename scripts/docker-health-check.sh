#!/bin/bash

# Docker Health Check Script
# Verifies that all services are running correctly

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}Docker Health Check${NC}"
echo -e "${BLUE}================================${NC}"
echo ""

# Check if Docker is running
echo -e "${YELLOW}Checking Docker daemon...${NC}"
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}✗ Docker is not running${NC}"
    echo -e "${YELLOW}Please start Docker and try again${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker is running${NC}"
echo ""

# Check if containers are running
echo -e "${YELLOW}Checking containers...${NC}"
if ! docker ps | grep -q "s1pper-dashboard"; then
    echo -e "${RED}✗ Dashboard container is not running${NC}"
    echo -e "${YELLOW}Run: docker-compose up -d${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Dashboard container is running${NC}"

if ! docker ps | grep -q "s1pper-postgres"; then
    echo -e "${RED}✗ PostgreSQL container is not running${NC}"
    echo -e "${YELLOW}Run: docker-compose up -d${NC}"
    exit 1
fi
echo -e "${GREEN}✓ PostgreSQL container is running${NC}"
echo ""

# Check container health
echo -e "${YELLOW}Checking container health...${NC}"
dashboard_health=$(docker inspect --format='{{.State.Health.Status}}' s1pper-dashboard 2>/dev/null || echo "unknown")
if [ "$dashboard_health" = "healthy" ]; then
    echo -e "${GREEN}✓ Dashboard is healthy${NC}"
elif [ "$dashboard_health" = "starting" ]; then
    echo -e "${YELLOW}⚠ Dashboard is starting...${NC}"
else
    echo -e "${RED}✗ Dashboard health: $dashboard_health${NC}"
fi

postgres_health=$(docker inspect --format='{{.State.Health.Status}}' s1pper-postgres 2>/dev/null || echo "unknown")
if [ "$postgres_health" = "healthy" ]; then
    echo -e "${GREEN}✓ PostgreSQL is healthy${NC}"
elif [ "$postgres_health" = "starting" ]; then
    echo -e "${YELLOW}⚠ PostgreSQL is starting...${NC}"
else
    echo -e "${RED}✗ PostgreSQL health: $postgres_health${NC}"
fi
echo ""

# Check network connectivity
echo -e "${YELLOW}Checking network...${NC}"
if docker network ls | grep -q "s1pper-network"; then
    echo -e "${GREEN}✓ Network exists${NC}"
else
    echo -e "${RED}✗ Network not found${NC}"
    exit 1
fi
echo ""

# Check database connectivity
echo -e "${YELLOW}Checking database connectivity...${NC}"
if docker exec s1pper-postgres pg_isready -U guestbook > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Database is accepting connections${NC}"
else
    echo -e "${RED}✗ Database is not accepting connections${NC}"
    exit 1
fi
echo ""

# Check volumes
echo -e "${YELLOW}Checking volumes...${NC}"
if docker volume ls | grep -q "s1pper-dashboard_postgres_data"; then
    echo -e "${GREEN}✓ PostgreSQL data volume exists${NC}"
    volume_size=$(docker run --rm -v s1pper-dashboard_postgres_data:/data alpine du -sh /data 2>/dev/null | cut -f1)
    echo -e "${BLUE}  Volume size: $volume_size${NC}"
else
    echo -e "${RED}✗ PostgreSQL data volume not found${NC}"
fi
echo ""

# Check if dashboard is accessible
echo -e "${YELLOW}Checking dashboard accessibility...${NC}"
if curl -f -s http://localhost:3000/api/printer/status > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Dashboard API is accessible${NC}"
else
    echo -e "${RED}✗ Dashboard API is not accessible${NC}"
    echo -e "${YELLOW}  Waiting 5 seconds and trying again...${NC}"
    sleep 5
    if curl -f -s http://localhost:3000/api/printer/status > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Dashboard API is now accessible${NC}"
    else
        echo -e "${RED}✗ Dashboard API is still not accessible${NC}"
        echo -e "${YELLOW}  Check logs with: docker logs s1pper-dashboard${NC}"
    fi
fi
echo ""

# Show resource usage
echo -e "${YELLOW}Resource usage:${NC}"
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}" s1pper-dashboard s1pper-postgres
echo ""

# Summary
echo -e "${BLUE}================================${NC}"
echo -e "${GREEN}Health check complete!${NC}"
echo -e "${BLUE}================================${NC}"
echo ""
echo -e "${BLUE}Dashboard:${NC} http://localhost:3000"
echo -e "${BLUE}View logs:${NC} docker-compose logs -f"
echo -e "${BLUE}API tests:${NC} ./scripts/test-api.sh"
echo ""
