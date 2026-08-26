#!/bin/bash
# Usage: ./ride.sh "saturday morning ride"
set -e
cd ~/11blog/eleventy-garden
git -C cycling_page add .
git -C cycling_page commit -m "${1:-ride: $(date +%Y-%m-%d)}"
git -C cycling_page push
git add cycling_page
git commit -m "bump cycling_page"
git push
echo "done — CI is building your site"
