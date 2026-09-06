#!/bin/bash
# Usage: ./ride.sh "saturday morning ride"
# Drop new .gpx files into GPX_OUT/, commit, and push. CI rebuilds the site.
set -e
cd ~/11blog/eleventy-garden
git add GPX_OUT _data/rides.json _data/everystreet.json
git commit -m "${1:-ride: $(date +%Y-%m-%d)}"
git push
echo "done — CI is building your site"