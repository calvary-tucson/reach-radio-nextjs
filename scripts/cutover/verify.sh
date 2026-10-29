#!/usr/bin/env bash
# Read-only checks for C4/C6/C8. Usage: verify.sh dns | smoke | canon
set -u
HOSTS="reach.radio www.reach.radio reachradiotucson.com www.reachradiotucson.com"
case "${1:-}" in
  dns)
    for h in $HOSTS; do
      echo "== $h"
      dig +short "$h" | head -3
      curl -sI --max-time 15 "https://$h/" | grep -iE '^(HTTP|server|x-vercel-id|location)' | head -4
    done ;;
  smoke)
    for h in reach.radio reachradiotucson.com; do
      echo "== $h"
      for p in / /donate /teachers /about /about/privacy-policy /api/native-config /sitemap.xml /robots.txt /not-a-page; do
        printf '%-28s ' "$p"; curl -s -o /dev/null --max-time 20 -w '%{http_code} %{time_total}s\n' "https://$h$p"
      done
      printf '%-28s ' "/api/audio-stream"; curl -s -o /dev/null --max-time 20 -w '%{http_code} -> %{redirect_url}\n' "https://$h/api/audio-stream"
    done
    echo "== pages.dev unchanged (live iOS store build loads it)"
    printf '%-28s ' "/"; curl -s -o /dev/null --max-time 20 -w '%{http_code}\n' "https://reach-radio-web.pages.dev/"
    printf '%-28s ' "/api/audio-stream"; curl -s -o /dev/null --max-time 20 -w '%{http_code}\n' "https://reach-radio-web.pages.dev/api/audio-stream" ;;
  canon)
    for h in reach.radio reachradiotucson.com; do
      echo "== $h"
      curl -s --max-time 20 "https://$h/api/native-config" | grep -o '"webUrl":"[^"]*"'
      curl -s --max-time 20 "https://$h/" | grep -oE '<link rel="canonical" href="[^"]*"|property="og:url" content="[^"]*"' | head -2
    done ;;
  *) echo "usage: $0 dns|smoke|canon"; exit 2 ;;
esac
