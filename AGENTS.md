# Number Lab

Static GitHub Pages site (no build step), served from `main` at https://tstout729.github.io/bite-number-machine/. Read `SPEC.md` for the design rules.

- Fast check: `uv run -q --with playwright python tools/check.py <page>.html --clicks "#big" --wait 4500 --out /tmp/shots`, then look at both screenshots. Expect no console errors and no overflow at 390px.
- Production check: after merging, wait for the Pages build (`gh api repos/tstout729/bite-number-machine/pages/builds/latest --jq .status` is `built`), then `curl -s https://tstout729.github.io/bite-number-machine/<page>.html` shows the change.
