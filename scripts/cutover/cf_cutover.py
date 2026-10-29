#!/usr/bin/env python3
"""Cloudflare cutover for reach.radio + reachradiotucson.com (Pages -> Vercel).

Modes (default is dry run: prints every call, sends nothing that changes state):
  snapshot   read-only: save all DNS records + Pages custom domains to a backup JSON
  cutover    per host: detach Pages custom domain, then point DNS at Vercel (grey, TTL 300)
  rollback   per host: restore the proxied CNAME to pages.dev and re-attach the Pages domain

Writes only happen with --apply. Token comes from env CF_API_TOKEN (never stored).
Only the four apex/www hosts are touched. TXT records, stream.reach.radio and pages.dev stay.
"""
import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request

API = "https://api.cloudflare.com/client/v4"
ACCOUNT = "0a8e48b3e091dedab060a87d59d8218c"
PAGES_PROJECT = "reach-radio-web"
PAGES_TARGET = "reach-radio-web.pages.dev"
VERCEL_TARGET = "32eebd4ba8fac32a.vercel-dns-016.com"
HOSTS = {
    "reach.radio": "e40ed9bfd6c48280845b700725efeaf4",
    "www.reach.radio": "e40ed9bfd6c48280845b700725efeaf4",
    "reachradiotucson.com": "2b12f050a3dc9c5434753291ef5b7683",
    "www.reachradiotucson.com": "2b12f050a3dc9c5434753291ef5b7683",
}


def call(method, path, body=None):
    req = urllib.request.Request(
        API + path,
        method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={
            "Authorization": "Bearer " + os.environ["CF_API_TOKEN"],
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        try:
            return json.load(e)
        except Exception:
            return {"success": False, "errors": [str(e)]}


def host_records(host):
    zone = HOSTS[host]
    d = call("GET", f"/zones/{zone}/dns_records?name={host}&per_page=50")
    if not d.get("success"):
        sys.exit(f"read records failed for {host}: {d.get('errors')}")
    return [r for r in d["result"] if r["type"] in ("CNAME", "A", "AAAA")]


def pages_domains():
    d = call("GET", f"/accounts/{ACCOUNT}/pages/projects/{PAGES_PROJECT}/domains")
    if not d.get("success"):
        sys.exit(f"read pages domains failed: {d.get('errors')}")
    return [x["name"] for x in d["result"]]


def snapshot(out):
    data = {
        "taken": time.strftime("%Y-%m-%d %H:%M:%S"),
        "pages_domains": pages_domains(),
        "records": {h: host_records(h) for h in HOSTS},
    }
    with open(out, "w") as f:
        json.dump(data, f, indent=2)
    print(f"snapshot saved: {out}")
    for h, recs in data["records"].items():
        for r in recs:
            print(f"  {h}: {r['type']} {r['content']} proxied={r['proxied']} ttl={r['ttl']}")
    print("  pages domains:", data["pages_domains"])


def run(label, method, path, body, apply):
    print(f"  {'APPLY' if apply else 'DRY  '} {label}: {method} {path} {json.dumps(body) if body else ''}")
    if not apply:
        return True
    d = call(method, path, body)
    ok = d.get("success", False)
    print(f"        -> {'ok' if ok else 'FAILED ' + str(d.get('errors'))}")
    return ok


def upsert_record(host, content, proxied, ttl, apply):
    zone = HOSTS[host]
    body = {"type": "CNAME", "name": host, "content": content, "proxied": proxied, "ttl": ttl}
    recs = host_records(host)
    if len(recs) > 1:
        sys.exit(f"{host}: expected at most 1 address record, found {len(recs)}; stop and look")
    if recs:
        return run(f"{host} update record", "PUT", f"/zones/{zone}/dns_records/{recs[0]['id']}", body, apply)
    return run(f"{host} create record", "POST", f"/zones/{zone}/dns_records", body, apply)


def cutover(apply):
    attached = set(pages_domains())
    for host in HOSTS:
        print(f"[{host}]")
        if host in attached:
            ok = run(f"{host} detach from Pages", "DELETE",
                     f"/accounts/{ACCOUNT}/pages/projects/{PAGES_PROJECT}/domains/{host}", None, apply)
            if not ok:
                sys.exit("detach failed, stopping before DNS change")
        else:
            print(f"  {host} not attached to Pages, skipping detach")
        if not upsert_record(host, VERCEL_TARGET, False, 300, apply):
            sys.exit(f"{host}: DNS update failed. Run rollback.")
    print("cutover steps done" if apply else "dry run complete, nothing changed")


def rollback(apply):
    attached = set(pages_domains())
    for host in HOSTS:
        print(f"[{host}]")
        if not upsert_record(host, PAGES_TARGET, True, 1, apply):
            print(f"  WARNING: DNS restore failed for {host}")
        if host not in attached:
            run(f"{host} re-attach to Pages", "POST",
                f"/accounts/{ACCOUNT}/pages/projects/{PAGES_PROJECT}/domains", {"name": host}, apply)
    print("rollback steps done" if apply else "dry run complete, nothing changed")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("mode", choices=["snapshot", "cutover", "rollback"])
    ap.add_argument("--apply", action="store_true", help="actually send write calls")
    ap.add_argument("--out", default=".cutover-backup/cf-snapshot.json")
    a = ap.parse_args()
    if "CF_API_TOKEN" not in os.environ:
        sys.exit("set CF_API_TOKEN in the environment")
    if a.mode == "snapshot":
        os.makedirs(os.path.dirname(a.out), exist_ok=True)
        snapshot(a.out)
    elif a.mode == "cutover":
        cutover(a.apply)
    else:
        rollback(a.apply)
