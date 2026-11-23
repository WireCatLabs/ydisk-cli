#!/usr/bin/env bash
# The release's live check against the real service (WC-TEST-18, WC-REL-17). The owner runs bin/live, which prints
# the `# Needs:` lines below, passes the token on stdin and records the pass. Every folder is a temporary one and the
# keyring is out of reach, so nothing touches the owner's store, keyring or settings.
#   scripts/live.sh < token-file
# It creates /ydisk-live and its live-check.txt (holding the word wirecatlive) when they are missing. It reads, then
# uploads one temporary file into /ydisk-live, moves it and deletes it to the trash: the download and
# upload confirm the hosts the docs name, and the move confirms that a file keeps its resource_id. A mirror step
# syncs a fresh folder /ydisk-live/mirror-<time> both ways and deletes it to the trash at the end. An edit step works in
# a fresh folder /ydisk-live/edit-<time>: files update at a wrong and the right sha256, history and restore, sheets
# update of a small .xlsx, documents update of a small .docx (src/testing/fixtures), and a mirror merge of a Markdown
# file edited in two sections, one here and one on the Disk; the folder goes to the trash at the end.
# Needs: a token for a test Yandex account, never one that matters (cloud_api:disk.read, disk.write, disk.info)
set -euo pipefail
root=$(cd -- "$(dirname -- "$0")/.." && pwd)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

export YDISK_CONFIG_DIR="$work/config" YDISK_STATE_DIR="$work/state" YDISK_CACHE_DIR="$work/cache"
export MESSAGING_STORE="$work/wirecat.db"
export DBUS_SESSION_BUS_ADDRESS="disabled:"
unset YDISK_TOKEN
cli=(node "$root/dist/bin/ydisk.js")

pnpm --dir "$root" -s build >/dev/null
# Set after the build, which needs the owner's pnpm store: a CLI that moves its folders on start must not see the
# owner's home.
export HOME="$work/home" XDG_CONFIG_HOME="$work/xdg/config" XDG_DATA_HOME="$work/xdg/data"
export XDG_STATE_HOME="$work/xdg/state" XDG_CACHE_HOME="$work/xdg/cache"
mkdir -p "$HOME"

"${cli[@]}" --wcat-describe | node -e '
  const answer = JSON.parse(require("fs").readFileSync(0, "utf8"))
  if (answer.wcat_describe !== 2 || !/^[0-9a-f]{64}$/.test(answer.manifest_sha256)) throw new Error("not format 2")'

"${cli[@]}" live session start --credential-storage file --json >/dev/null
trap '"${cli[@]}" live session end --json >/dev/null 2>&1 || true; rm -rf "$work"' EXIT

"${cli[@]}" live session status --check --json >/dev/null
has_fixture() {
  "${cli[@]}" live files list --folder /ydisk-live --json >"$work/list.json" 2>/dev/null || return 2
  node -e '
    const list = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"))
    process.exit(list.items?.some((item) => item.name === "live-check.txt") ? 0 : 1)' "$work/list.json"
}
status=0
has_fixture || status=$?
if [ "$status" -ne 0 ]; then
  [ "$status" -eq 2 ] && "${cli[@]}" live files create /ydisk-live --json >/dev/null
  echo "wirecatlive: the ydisk live check reads this file" >"$work/fixture.txt"
  "${cli[@]}" live files upload "$work/fixture.txt" --folder /ydisk-live --name live-check.txt --json >/dev/null
  has_fixture
fi
"${cli[@]}" live files download /ydisk-live/live-check.txt --output "$work/live-check.txt" --json >/dev/null
grep -q wirecatlive "$work/live-check.txt"
"${cli[@]}" live folders browse --json >"$work/browse.json"
node -e '
  const items = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).items
  const live = items.find((item) => item.path === "disk:/ydisk-live" || item.name === "ydisk-live")
  if (!live) throw new Error("folders browse does not list /ydisk-live")
  if (live.kind !== "folder" || ![true, false, null].includes(live.has_children)) throw new Error("folders browse item lacks kind or has_children")' "$work/browse.json"
"${cli[@]}" live folders add /ydisk-live --json >/dev/null
"${cli[@]}" live sync --json >/dev/null
"${cli[@]}" live search wirecatlive --json >"$work/found.json"
node -e '
  const found = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"))
  if (!JSON.stringify(found).includes("live-check.txt")) throw new Error("search did not find live-check.txt")' "$work/found.json"
stamp=$(date +%s)
echo "ydisk live check $stamp" >"$work/upload.txt"
"${cli[@]}" live files upload "$work/upload.txt" --folder /ydisk-live --name "upload-$stamp.txt" --json >/dev/null
"${cli[@]}" live files show "/ydisk-live/upload-$stamp.txt" --json >"$work/before.json"
"${cli[@]}" live files move "/ydisk-live/upload-$stamp.txt" --folder /ydisk-live --name "moved-$stamp.txt" --json >/dev/null
"${cli[@]}" live files show "/ydisk-live/moved-$stamp.txt" --json >"$work/after.json"
node -e '
  const read = (file) => JSON.parse(require("fs").readFileSync(file, "utf8")).item.id
  if (read(process.argv[1]) !== read(process.argv[2])) throw new Error("a moved file got a new resource_id")' \
  "$work/before.json" "$work/after.json"
"${cli[@]}" live files delete "/ydisk-live/moved-$stamp.txt" --yes --json >/dev/null
# Facts a two-way sync builds on that Yandex's docs leave open (seen on 2026-11-18): the Disk's sha256 is the content's,
# a replacing upload keeps the resource_id, the Disk revision moves with a write, a delete with a wrong md5 gets 409.
raw() { "${cli[@]}" live api "$@" 2>&1 || true; }
echo "probe one $stamp" >"$work/probe.txt"
"${cli[@]}" live files upload "$work/probe.txt" --folder /ydisk-live --name "probe-$stamp.txt" --json >/dev/null
raw resources-list --path "disk:/ydisk-live/probe-$stamp.txt" >"$work/probe-1.json"
raw disk-get --fields revision >"$work/rev-1.json"
echo "probe two, longer $stamp" >"$work/probe.txt"
"${cli[@]}" live files upload "$work/probe.txt" --folder /ydisk-live --name "probe-$stamp.txt" --replace --yes --json >/dev/null
# A replace the Disk took with 202 lands later: until then the file reads as missing or with the old sha256.
want=$(sha256sum "$work/probe.txt" | cut -d" " -f1)
for _ in $(seq 20); do
  raw resources-list --path "disk:/ydisk-live/probe-$stamp.txt" >"$work/probe-2.json"
  grep -q "$want" "$work/probe-2.json" && break
  sleep 1
done
raw disk-get --fields revision >"$work/rev-2.json"
raw resources-delete --path "disk:/ydisk-live/probe-$stamp.txt" --md5 00000000000000000000000000000000 --yes >"$work/del-wrong.json"
raw resources-list --path "disk:/ydisk-live/probe-$stamp.txt" --fields path >"$work/after-wrong.json"
node -e '
  const fs = require("fs")
  const read = (f) => JSON.parse(fs.readFileSync(f, "utf8"))
  const [one, two, r1, r2, del, after] = process.argv.slice(1, 7).map(read)
  const local = require("crypto").createHash("sha256").update(fs.readFileSync(process.argv[7])).digest("hex")
  const fail = (message) => { throw new Error(message) }
  if (two.item?.sha256 !== local) fail(`the Disk sha256 is not the sha256 of the content: ${JSON.stringify(two)}`)
  if (one.item.resource_id !== two.item.resource_id) fail("a replacing upload gave the file a new resource_id")
  if (!(r2.item.revision > r1.item.revision)) fail("the Disk revision did not move with a write")
  if (del.error?.details?.status !== 409) fail("a delete with a wrong md5 was not refused with 409")
  if (!after.item?.path) fail("a delete with a wrong md5 removed the file")' \
  "$work/probe-1.json" "$work/probe-2.json" "$work/rev-1.json" "$work/rev-2.json" "$work/del-wrong.json" \
  "$work/after-wrong.json" "$work/probe.txt"
# The flat listing a whole-Disk mirror reads (GET /v1/disk/resources/files): Yandex's docs show neither sha256 nor
# resource_id on its items and name no largest page, so both are checked here, with limit and offset. A page of 1,000
# did not come back within 30 s on 2026-11-21, and 100 files show the same fields. On 2026-11-23 even 100 took over
# 30 s, so these two calls get the 2 minutes a mirror's page has.
raw resources-files-list --limit 100 --timeout 2m >"$work/flat-all.json"
raw resources-files-list --limit 1 --offset 1 --timeout 2m >"$work/flat-one.json"
node -e '
  const fs = require("fs")
  const page = (f) => { const body = JSON.parse(fs.readFileSync(f, "utf8")); return body.item ?? body }
  const [all, one] = process.argv.slice(1, 3).map(page)
  const fail = (message) => { throw new Error(message) }
  if (!Array.isArray(all.items) || all.items.length < 2)
    fail(`the flat listing returned too few files: ${JSON.stringify(all).slice(0, 300)}`)
  const bad = all.items.find((item) => !item.sha256 || !item.resource_id || !String(item.path).startsWith("disk:/"))
  if (bad) fail(`a flat listing item lacks sha256, resource_id or a disk: path: ${JSON.stringify(bad)}`)
  if (one.items?.length !== 1 || one.items[0].path !== all.items[1].path)
    fail("the flat listing does not honour limit and offset")' \
  "$work/flat-all.json" "$work/flat-one.json"
"${cli[@]}" live files delete "/ydisk-live/probe-$stamp.txt" --yes --json >/dev/null
# A two-way mirror of a fresh folder under /ydisk-live: sync up, edit on the Disk, sync down, delete on each side, and
# find each deletion in the other side's trash. Its folder skip/ is excluded: the exact lists below show that nothing in
# it is sent, brought down or trashed on either side.
mirror="/ydisk-live/mirror-$stamp"
mkdir -p "$work/mirror"
echo "mirror a $stamp" >"$work/mirror/a.txt"
echo "mirror b $stamp" >"$work/mirror/b.txt"
mkdir -p "$work/mirror/skip"
echo "excluded here $stamp" >"$work/mirror/skip/c.txt"
"${cli[@]}" live files create "$mirror" --json >/dev/null
"${cli[@]}" live files create "$mirror/skip" --json >/dev/null
echo "excluded there $stamp" >"$work/d.txt"
"${cli[@]}" live files upload "$work/d.txt" --folder "$mirror/skip" --name d.txt --json >/dev/null
# A failed run leaves no mirror folder behind: it goes to the trash like the rest.
trap '"${cli[@]}" live files delete "$mirror" --yes --json >/dev/null 2>&1 || true
  "${cli[@]}" live session end --json >/dev/null 2>&1 || true; rm -rf "$work"' EXIT
"${cli[@]}" live mirrors add "$mirror" "$work/mirror" --ignore skip --json >"$work/m-add.json"
id=$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).item.id)' "$work/m-add.json")
"${cli[@]}" live mirrors sync "$id" --json >"$work/m-up.json"
echo "edited on the disk $stamp" >"$work/edit.txt"
"${cli[@]}" live files upload "$work/edit.txt" --folder "$mirror" --name a.txt --replace --yes --json >/dev/null
"${cli[@]}" live mirrors sync "$id" --yes --json >"$work/m-down.json"
grep -q "edited on the disk $stamp" "$work/mirror/a.txt"
test ! -e "$work/mirror/skip/d.txt"
"${cli[@]}" live mirrors versions list "$id" a.txt --json >"$work/m-versions.json"
rm "$work/mirror/b.txt"
"${cli[@]}" live files delete "$mirror/a.txt" --yes --json >/dev/null
"${cli[@]}" live mirrors sync "$id" --yes --json >"$work/m-delete.json"
# Every page of the trash: the docs name no sort by deletion time, so a first page alone misses b.txt in a full trash.
raw trash-resources-list --path "trash:/" --limit 1000 --all >"$work/m-trash.json"
node -e '
  const fs = require("fs")
  const read = (f) => JSON.parse(fs.readFileSync(f, "utf8"))
  const [up, down, versions, deleted] = process.argv.slice(1, 5).map(read)
  const [trash, mirror, root] = [fs.readFileSync(process.argv[5], "utf8"), process.argv[6], process.argv[7]]
  const fail = (message) => { throw new Error(message) }
  const one = (body) => body.items[0]
  if (one(up).uploaded.sort().join() !== "a.txt,b.txt") fail("the first sync did not upload a.txt and b.txt")
  if (one(down).downloaded.join() !== "a.txt") fail("the sync did not bring down the file edited on the Disk")
  if (!versions.items.some((event) => event.event === "changed" && event.available))
    fail("the version the sync replaced is not kept")
  const trashed = one(deleted).trashed.map((item) => `${item.side}:${item.path}`).sort().join()
  if (trashed !== "local:a.txt,remote:b.txt") fail(`the deletions did not cross sides: ${trashed}`)
  if (!trash.includes(`${mirror.slice(1)}/b.txt`)) fail("b.txt deleted here is not in the Disk trash")
  if (!fs.readdirSync(`${root}/.wirecat-trash`, { recursive: true }).some((name) => String(name).endsWith("a.txt")))
    fail("a.txt deleted on the Disk is not in the local trash")' \
  "$work/m-up.json" "$work/m-down.json" "$work/m-versions.json" "$work/m-delete.json" "$work/m-trash.json" \
  "$mirror" "$work/mirror"
"${cli[@]}" live mirrors remove "$id" --json >/dev/null
"${cli[@]}" live files delete "$mirror" --yes --json >/dev/null
trap '"${cli[@]}" live session end --json >/dev/null 2>&1 || true; rm -rf "$work"' EXIT

# Edits in place, each at the sha256 it was read at. The Disk can answer an upload before it lists the new sha256, so
# each read waits for the hash of the content just sent.
edit="/ydisk-live/edit-$stamp"
"${cli[@]}" live files create "$edit" --json >/dev/null
trap '"${cli[@]}" live files delete "$edit" --yes --json >/dev/null 2>&1 || true
  "${cli[@]}" live session end --json >/dev/null 2>&1 || true; rm -rf "$work"' EXIT
sha_of() {
  "${cli[@]}" live files show "$1" --json 2>/dev/null |
    node -e 'console.log(JSON.parse(require("fs").readFileSync(0, "utf8")).item?.sha256 ?? "")' || true
}
wait_sha() {
  for _ in $(seq 30); do
    [ "$(sha_of "$1")" = "$2" ] && return 0
    sleep 1
  done
  echo "the Disk never listed $1 with sha256 $2" >&2
  return 1
}
# An edit's answer may carry no sha256 when the Disk has not listed one yet; then the edit is seen as a new hash.
wait_changed() {
  for _ in $(seq 30); do
    now=$(sha_of "$1")
    [ -n "$now" ] && [ "$now" != "$2" ] && return 0
    sleep 1
  done
  echo "the Disk never listed $1 with a new sha256" >&2
  return 1
}
hash_of() { sha256sum "$1" | cut -d" " -f1; }
printf '# Notes %s\n\nthe first draft\n' "$stamp" >"$work/notes.md"
printf '# Notes %s\n\nthe second draft\n' "$stamp" >"$work/notes-2.md"
old=$(hash_of "$work/notes.md")
new=$(hash_of "$work/notes-2.md")
"${cli[@]}" live files upload "$work/notes.md" --folder "$edit" --json >/dev/null
wait_sha "$edit/notes.md" "$old"
"${cli[@]}" live files update "$edit/notes.md" --expected-fingerprint "$(printf '0%.0s' $(seq 64))" --yes --json \
  <"$work/notes-2.md" >"$work/e-wrong.json" 2>&1 || true
[ "$(sha_of "$edit/notes.md")" = "$old" ]
"${cli[@]}" live files update "$edit/notes.md" --expected-fingerprint "$old" --yes --json \
  <"$work/notes-2.md" >"$work/e-right.json"
wait_sha "$edit/notes.md" "$new"
"${cli[@]}" live files history "$edit/notes.md" --json >"$work/e-history.json"
"${cli[@]}" live files restore "$edit/notes.md" "$old" --expected-fingerprint "$new" --yes --json >"$work/e-restore.json"
wait_sha "$edit/notes.md" "$old"
node -e '
  const fs = require("fs")
  const read = (f) => JSON.parse(fs.readFileSync(f, "utf8"))
  const [wrong, right, history, restore] = process.argv.slice(1, 5).map(read)
  const [old, now] = process.argv.slice(5, 7)
  const fail = (message) => { throw new Error(message) }
  if (wrong.error?.code !== "conflict") fail(`an update at a wrong sha256 was not a conflict: ${JSON.stringify(wrong)}`)
  if (right.item?.replaced?.sha256 !== old || ![now, null].includes(right.item?.sha256))
    fail(`files update answered other hashes: ${JSON.stringify(right)}`)
  if (!history.item.versions.some((one) => one.version === old && one.available)) fail("history does not list the old version")
  if (restore.item?.restored !== old) fail("files restore did not put the old version back")' \
  "$work/e-wrong.json" "$work/e-right.json" "$work/e-history.json" "$work/e-restore.json" "$old" "$new"

fixtures="$root/src/testing/fixtures"
"${cli[@]}" live files upload "$fixtures/budget.xlsx" --folder "$edit" --json >/dev/null
wait_sha "$edit/budget.xlsx" "$(hash_of "$fixtures/budget.xlsx")"
"${cli[@]}" live files sheets show "$edit/budget.xlsx" "Synthetic Budget!A1:C4" --json >"$work/s-show.json"
fingerprint=$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).item.sha256)' "$work/s-show.json")
"${cli[@]}" live files sheets update "$edit/budget.xlsx" "B2:C2" --values '[[1300, "paid"]]' \
  --expected-fingerprint "$fingerprint" --yes --json >"$work/s-update.json"
wait_changed "$edit/budget.xlsx" "$fingerprint"
"${cli[@]}" live files sheets show "$edit/budget.xlsx" "Synthetic Budget!B2:C2" --json >"$work/s-after.json"
node -e '
  const cells = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).item.sheets[0].cells
  const value = (address) => cells.find((cell) => cell.address === address)?.value
  if (value("B2") !== 1300 || value("C2") !== "paid") throw new Error(`sheets update did not land: ${JSON.stringify(cells)}`)' \
  "$work/s-after.json"

"${cli[@]}" live files upload "$fixtures/letter.docx" --folder "$edit" --json >/dev/null
wait_sha "$edit/letter.docx" "$(hash_of "$fixtures/letter.docx")"
"${cli[@]}" live files documents show "$edit/letter.docx" --json >"$work/d-show.json"
fingerprint=$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).item.sha256)' "$work/d-show.json")
"${cli[@]}" live files documents update "$edit/letter.docx" --payload "[{\"index\": 2, \"text\": \"Edited live $stamp.\"}]" \
  --expected-fingerprint "$fingerprint" --yes --json >"$work/d-update.json"
wait_changed "$edit/letter.docx" "$fingerprint"
"${cli[@]}" live files documents show "$edit/letter.docx" --json >"$work/d-after.json"
node -e '
  const paragraphs = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).item.paragraphs
  if (paragraphs[2]?.text !== `Edited live ${process.argv[2]}.`) throw new Error("documents update did not land")
  if (paragraphs[1]?.text !== "Dear heron, the pond is ready.") throw new Error("documents update changed another paragraph")' \
  "$work/d-after.json" "$stamp"

# A mirror merge: the same Markdown file edited in two sections with unchanged lines between them, one here and one on
# the Disk, lands on both sides with both edits.
mkdir -p "$work/merge"
printf '# Plan %s\n\n## Monday\n\nwrite the brief\n\n## Friday\n\nsend the report\n' "$stamp" >"$work/merge/plan.md"
"${cli[@]}" live files create "$edit/merge" --json >/dev/null
"${cli[@]}" live mirrors add "$edit/merge" "$work/merge" --json >"$work/g-add.json"
merge_id=$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).item.id)' "$work/g-add.json")
"${cli[@]}" live mirrors sync "$merge_id" --yes --json >/dev/null
wait_sha "$edit/merge/plan.md" "$(hash_of "$work/merge/plan.md")"
sed 's/send the report/send the report to Anna/' "$work/merge/plan.md" >"$work/plan-disk.md"
"${cli[@]}" live files upload "$work/plan-disk.md" --folder "$edit/merge" --name plan.md --replace --yes --json >/dev/null
wait_sha "$edit/merge/plan.md" "$(hash_of "$work/plan-disk.md")"
sed -i 's/write the brief/write the brief and the budget/' "$work/merge/plan.md"
"${cli[@]}" live mirrors sync "$merge_id" --yes --json >"$work/g-sync.json"
wait_sha "$edit/merge/plan.md" "$(hash_of "$work/merge/plan.md")"
"${cli[@]}" live files download "$edit/merge/plan.md" --output "$work/plan-merged.md" --json >/dev/null
node -e '
  const fs = require("fs")
  const synced = JSON.parse(fs.readFileSync(process.argv[1], "utf8")).items[0]
  const fail = (message) => { throw new Error(message) }
  if (synced.merged?.join() !== "plan.md") fail(`the sync did not merge plan.md: ${JSON.stringify(synced)}`)
  for (const file of process.argv.slice(2, 4)) {
    const text = fs.readFileSync(file, "utf8")
    if (!text.includes("write the brief and the budget") || !text.includes("send the report to Anna"))
      fail(`${file} lacks one of the two edits`)
  }' "$work/g-sync.json" "$work/merge/plan.md" "$work/plan-merged.md"
"${cli[@]}" live mirrors remove "$merge_id" --json >/dev/null
"${cli[@]}" live files delete "$edit" --yes --json >/dev/null
trap '"${cli[@]}" live session end --json >/dev/null 2>&1 || true; rm -rf "$work"' EXIT
"${cli[@]}" live doctor --json >/dev/null

"${cli[@]}" live session end --json >/dev/null
echo "live check passed: describe format 2, sign-in, files list, folders browse, download, upload, move and delete, the sync facts, sync, search, the flat listing, a two-way mirror with an exclusion, files update at a wrong and the right sha256, history and restore, sheets update, documents update, a mirror merge, doctor, sign-out"
