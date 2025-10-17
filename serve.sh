#!/bin/bash
# Simple HTTP server for testing the mobile webapp

echo "Starting HTTP server on http://localhost:8000"
echo "Open this URL on your iPhone (make sure your iPhone is on the same network)"
echo "To access from iPhone, use your Mac's IP address: http://YOUR_MAC_IP:8000"
echo ""
echo "To find your Mac's IP address, run: ipconfig getifaddr en0"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

cd "$(dirname "$0")"
python3 -m http.server 8000 --bind 0.0.0.0
