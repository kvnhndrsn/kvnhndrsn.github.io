#!/bin/bash
# Usage: ./ride.sh "saturday morning ride"
# Just drops GPX files in cycling_page/GPX_OUT/ and run this.
set -e
cd ~/11blog/eleventy-garden
git add cycling_page/GPX_OUT/
msg="${1:-ride: $(date +%Y-%m-%d)}"
git commit -m "$msg"
git push
echo "done — CI is building your site"
