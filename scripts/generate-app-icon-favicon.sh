#!/bin/bash

# Create app-icon style favicons from icon.png with status badges
INPUT_FILE="../public/icon.png"
OUTPUT_DIR="../public"

echo "Generating app-icon style favicons from icon.png..."

# Check if input file exists
if [ ! -f "$INPUT_FILE" ]; then
    echo "Error: icon.png not found at $INPUT_FILE"
    exit 1
fi

# Check if ImageMagick is available
if ! command -v magick >/dev/null 2>&1; then
    echo "Error: ImageMagick not found. Please install it: brew install imagemagick"
    exit 1
fi

# Function to create favicon with rounded corners and optional status badge
create_favicon() {
    local size=$1
    local status=$2
    local output_file=$3
    
    # Calculate corner radius (about 22% of size for app icon look)
    local radius=$(( size * 22 / 100 ))
    
    # Create base favicon with rounded corners and transparent background
    magick "$INPUT_FILE" \
        -resize ${size}x${size} \
        \( +clone -alpha extract \
           -draw "fill black polygon 0,0 0,$radius $radius,0 fill white circle $radius,$radius $radius,0" \
           \( +clone -flip -flop \) \
           -compose Multiply -composite \
           \( +clone -flip \) \
           -compose Multiply -composite \) \
        -alpha off -compose CopyOpacity -composite \
        "$OUTPUT_DIR/temp_base_${size}.png"
    
    # Add status badge if specified
    case "$status" in
        "printing")
            # Add amber/yellow badge in bottom-right corner
            local badge_size=$(( size / 4 ))
            local badge_x=$(( size - badge_size / 2 ))
            local badge_y=$(( size - badge_size / 2 ))
            
            magick "$OUTPUT_DIR/temp_base_${size}.png" \
                -fill "#f59e0b" \
                -draw "circle $badge_x,$badge_y $(( badge_x - badge_size/2 )),$badge_y" \
                -stroke "rgba(0,0,0,0.2)" \
                -strokewidth 1 \
                -draw "circle $badge_x,$badge_y $(( badge_x - badge_size/2 )),$badge_y" \
                "$output_file"
            ;;
        "ready")
            # Add green badge in bottom-right corner
            local badge_size=$(( size / 4 ))
            local badge_x=$(( size - badge_size / 2 ))
            local badge_y=$(( size - badge_size / 2 ))
            
            magick "$OUTPUT_DIR/temp_base_${size}.png" \
                -fill "#22c55e" \
                -draw "circle $badge_x,$badge_y $(( badge_x - badge_size/2 )),$badge_y" \
                -stroke "rgba(0,0,0,0.2)" \
                -strokewidth 1 \
                -draw "circle $badge_x,$badge_y $(( badge_x - badge_size/2 )),$badge_y" \
                "$output_file"
            ;;
        "cancelled")
            # Add grey badge in bottom-right corner
            local badge_size=$(( size / 4 ))
            local badge_x=$(( size - badge_size / 2 ))
            local badge_y=$(( size - badge_size / 2 ))
            
            magick "$OUTPUT_DIR/temp_base_${size}.png" \
                -fill "#6b7280" \
                -draw "circle $badge_x,$badge_y $(( badge_x - badge_size/2 )),$badge_y" \
                -stroke "rgba(0,0,0,0.2)" \
                -strokewidth 1 \
                -draw "circle $badge_x,$badge_y $(( badge_x - badge_size/2 )),$badge_y" \
                "$output_file"
            ;;
        "offline"|"error")
            # Add red badge in bottom-right corner
            local badge_size=$(( size / 4 ))
            local badge_x=$(( size - badge_size / 2 ))
            local badge_y=$(( size - badge_size / 2 ))
            
            magick "$OUTPUT_DIR/temp_base_${size}.png" \
                -fill "#dc2626" \
                -draw "circle $badge_x,$badge_y $(( badge_x - badge_size/2 )),$badge_y" \
                -stroke "rgba(0,0,0,0.2)" \
                -strokewidth 1 \
                -draw "circle $badge_x,$badge_y $(( badge_x - badge_size/2 )),$badge_y" \
                "$output_file"
            ;;
        *)
            # No badge, just copy the base
            cp "$OUTPUT_DIR/temp_base_${size}.png" "$output_file"
            ;;
    esac
    
    # Clean up temp file
    rm -f "$OUTPUT_DIR/temp_base_${size}.png"
    
    echo "Created: $(basename "$output_file")"
}

# Remove old favicon files
rm -f "$OUTPUT_DIR"/favicon-*.png "$OUTPUT_DIR"/apple-touch-icon-*.png "$OUTPUT_DIR"/favicon-*.svg "$OUTPUT_DIR"/apple-touch-icon-*.svg

# Create ready state favicons (no badge)
create_favicon 16 "ready" "$OUTPUT_DIR/favicon-ready-16x16.png"
create_favicon 32 "ready" "$OUTPUT_DIR/favicon-ready-32x32.png" 
create_favicon 48 "ready" "$OUTPUT_DIR/favicon-ready-48x48.png"
create_favicon 180 "ready" "$OUTPUT_DIR/apple-touch-icon-ready.png"

# Create printing state favicons (green badge)
create_favicon 16 "printing" "$OUTPUT_DIR/favicon-printing-16x16.png"
create_favicon 32 "printing" "$OUTPUT_DIR/favicon-printing-32x32.png"
create_favicon 48 "printing" "$OUTPUT_DIR/favicon-printing-48x48.png"
create_favicon 180 "printing" "$OUTPUT_DIR/apple-touch-icon-printing.png"

# Create cancelled state favicons (grey badge)
create_favicon 16 "cancelled" "$OUTPUT_DIR/favicon-cancelled-16x16.png"
create_favicon 32 "cancelled" "$OUTPUT_DIR/favicon-cancelled-32x32.png"
create_favicon 48 "cancelled" "$OUTPUT_DIR/favicon-cancelled-48x48.png"
create_favicon 180 "cancelled" "$OUTPUT_DIR/apple-touch-icon-cancelled.png"

# Create offline/error state favicons (red badge)
create_favicon 16 "offline" "$OUTPUT_DIR/favicon-offline-16x16.png"
create_favicon 32 "offline" "$OUTPUT_DIR/favicon-offline-32x32.png"
create_favicon 48 "offline" "$OUTPUT_DIR/favicon-offline-48x48.png"
create_favicon 180 "offline" "$OUTPUT_DIR/apple-touch-icon-offline.png"

# Create default favicon files (use ready state)
cp "$OUTPUT_DIR/favicon-ready-16x16.png" "$OUTPUT_DIR/favicon-16x16.png"
cp "$OUTPUT_DIR/favicon-ready-32x32.png" "$OUTPUT_DIR/favicon-32x32.png"
cp "$OUTPUT_DIR/favicon-ready-48x48.png" "$OUTPUT_DIR/favicon-48x48.png"
cp "$OUTPUT_DIR/apple-touch-icon-ready.png" "$OUTPUT_DIR/apple-touch-icon.png"

# Create favicon.ico from multiple sizes
magick "$OUTPUT_DIR/favicon-ready-16x16.png" "$OUTPUT_DIR/favicon-ready-32x32.png" "$OUTPUT_DIR/favicon-ready-48x48.png" "$OUTPUT_DIR/favicon.ico"

echo ""
echo "App-icon style favicon generation complete!"
echo "Generated files:"
echo "  - Ready state: favicon-ready-*.png (green badge - bottom right)"
echo "  - Printing state: favicon-printing-*.png (amber/yellow badge - bottom right)"
echo "  - Cancelled state: favicon-cancelled-*.png (grey badge - bottom right)"
echo "  - Offline/Error state: favicon-offline-*.png (red badge - bottom right)"
echo "  - Default favicons set to ready state"
echo "  - All with rounded corners like app icons"