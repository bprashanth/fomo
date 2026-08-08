# Deriving numeric features from site photos

i.e. "photos with >30% sky, grouped by plot", "Aug–Sep photos with >30% grass".

Spun out of [`storage_immich.md`](storage_immich.md) because it's a separate
question from "should we run Immich". Short answer: **CLIP can't do this, and we
don't need Immich for it.**

## Why CLIP is the wrong tool

CLIP produces **one embedding vector per image**, and search = cosine similarity
against an embedding of your text. That's it.

Consequences:

- **No spatial output.** It doesn't know *where* sky is, or how much of the frame
  it occupies. There's no per-pixel anything.
- **No quantitative output.** You get a similarity score, not a percentage. It
  cannot distinguish 30% sky from 60% sky. It'll rank "obviously sky-ish photo"
  above "photo with a bit of sky", but that ranking conflates *amount of sky*
  with *how prototypically sky-like the image is*. Two different things.
- **No thresholding.** "More than 30%" has no representation. You'd be
  eyeballing a similarity cutoff, and that cutoff would drift per query and per
  site.

CLIP is genuinely good at *"find me photos that look like X"* — "grassland",
"canopy gap", "standing water", "burnt ground". Fuzzy retrieval over an archive
nobody has labelled. That's a real capability and worth having. It is just not a
measurement tool, and the queries above are measurement.

## What Immich's CLIP actually is (if we want it anyway)

- runs locally in the `immich-machine-learning` container, ONNX models, no
  external API calls
- model is picked from a curated list at **Administration → Settings → Machine
  Learning → Smart Search**. Published under the
  [`immich-app` HF org](https://huggingface.co/immich-app), visual + textual
  encoders as separate ONNX files. Options range from `ViT-B-32` (fast) to
  `ViT-H-14-378-quickgelu__dfn5b` (slow, much better recall).
- embeddings live in Postgres (VectorChord extension; older versions used
  pgvecto.rs)
- **changing the model means re-running Smart Search over every asset.** Not free
  at scale.

**Can we tune it?** Not through Immich. There's no fine-tuning hook or UI. The
path would be: fine-tune CLIP yourself → export to ONNX in their exact layout
(separate visual/textual encoders) → host it → point Immich at it. Doable,
completely unsupported, and you own it forever.

Also flag for programmatic use: there's an open report that smart search
[caps at 40 results and ignores pagination](https://github.com/immich-app/immich/issues/23883)
(v2.2.3). Verify against whatever version we'd run before building on it.

## What we actually want: segmentation → numbers → SQL

The queries above are **semantic segmentation** problems. Run a model that
labels every pixel, count pixels per class, divide by total. Now "sky fraction"
is a float and everything downstream is arithmetic.

ADE20K-trained models are a near-perfect fit — the 150-class label set already
includes `sky`, `grass`, `tree`, `plant`, `earth`, `water`, `mountain`, `road`.
That's basically our vocabulary for free, no training.

`nvidia/segformer-b0-finetuned-ade-512-512` is small enough to run on CPU.
Bigger `b4`/`b5` variants if accuracy is short.

```python
from transformers import SegformerImageProcessor, SegformerForSemanticSegmentation
import torch, numpy as np

proc = SegformerImageProcessor.from_pretrained("nvidia/segformer-b0-finetuned-ade-512-512")
model = SegformerForSemanticSegmentation.from_pretrained("nvidia/segformer-b0-finetuned-ade-512-512")

# ADE20K class indices
CLASSES = {"sky": 2, "tree": 4, "grass": 9, "plant": 17, "earth": 13, "water": 21}

def fractions(pil_img):
    inputs = proc(images=pil_img, return_tensors="pt")
    with torch.no_grad():
        logits = model(**inputs).logits
    seg = logits.argmax(dim=1)[0].numpy()
    total = seg.size
    return {name: float((seg == idx).sum()) / total for name, idx in CLASSES.items()}
```

Then write the result onto the session record:

```json
{
  "sessionId": "srini_2025-09-04T13:12:28",
  "siteId": "G14R1-2025",
  "timestamp": "2025-09-04T13:12:28",
  "features": { "sky": 0.34, "grass": 0.41, "tree": 0.19, "earth": 0.05 }
}
```

**And now the whole thing is a WHERE clause in the SQL panel we already have:**

```sql
SELECT siteId, timestamp, portraitImageUrl
FROM ?
WHERE features->grass > 0.30
  AND MONTH(timestamp) IN (8, 9)
ORDER BY siteId, timestamp
```

No Immich, no vector DB, no embeddings. The AlasQL panel that already exists
does the whole job once the numbers are on the records. This is the punchline:
**the feature extraction is the hard part, and it happens offline, once.**

## The domain-correct option we're ignoring: GCC

Worth knowing before building anything ML-shaped.

Fixed-point repeat photography + **Green Chromatic Coordinate** is the
established method for vegetation phenology — it's what the PhenoCam network
runs on.

```
GCC = G / (R + G + B)
```

Averaged over a fixed region of interest, plotted over time. That's it. ~10 lines
of numpy, no model, no GPU, runs on a Lambda.

Why it fits us unusually well: **our camera position is fixed per site**, which
is exactly the precondition GCC needs — a stable ROI across years. That's the
whole point of the ghost-image capture flow. We're already collecting the right
data for it, by accident.

It's also an established method with literature behind it, which matters if
anyone wants to publish off this.

Caveats:
- sensitive to illumination, exposure, and white balance. Phone auto-exposure
  will add noise that a fixed camera wouldn't have.
- standard mitigation is a **per-window 90th percentile** rather than a raw mean,
  plus restricting to a time-of-day band. Both cheap.
- `heading` (on ~half our sessions) is useful here to sanity-check that framing
  didn't drift.

## RESULTS — ran this on the real NCF data (2026-08)

Didn't need torch. numpy + PIL was enough to answer the feasibility question.

### What's actually in the archive

`~/rtmp/data/ncf/archive/2019/` has four fixed-point series, DSLR (Nikon, all
4608x3456, consistent camera):

| site | n | span | months sampled |
|---|---|---|---|
| P1R1 | 11 | 2019-09 → 2025-03 | Mar + Sep/Nov/Dec/May |
| P1R2 | 11 | 2019-11 → 2025-03 | same |
| P2R1 | 11 | 2019-11 → 2025-03 | same |
| P2R2 | 5 | 2022-09 → 2025-03 | same |

Filenames encode `YYYY-MM`. Sites are **restoration plantings** — open grassy
clearings with scattered saplings in 2019, progressively closing canopy by 2025.
A person stands in each frame for scale.

The phone-app captures (`J12R1/`, `G14R1-2025/`, `I17R1_2016/`, etc.) are newer
and much sparser — 1–3 sessions per site, 2025-09 onward.

### Finding 1 — season dominates everything

Pooled across all sites:

| | n | gcc_lower | veg_frac_lower | sky_upper |
|---|---|---|---|---|
| dry (Mar) | 18 | 0.381 | 0.657 | 0.303 |
| wet (May/Sep/Nov/Dec) | 20 | 0.457 | 0.969 | 0.363 |

Clean, consistent separation. **GCC is an excellent season detector and a bad
restoration detector.** The seasonal swing is far larger than the multi-year
restoration trend, so any trend line over mixed months is measuring rainfall.

Corollary: only ever compare **same month to same month**.

### Finding 2 — canopy/sky fraction is the only metric with a consistent sign

March-only (season held constant), linear fit vs year:

| site | slope/yr | r | first → last |
|---|---|---|---|
| P1R1 | -0.021 | -0.34 | 2021-03: 0.330 → 2025-03: 0.193 |
| P1R2 | -0.019 | -0.38 | 2021-03: 0.321 → 2025-03: 0.205 |
| P2R1 | -0.053 | -0.62 | 2021-03: 0.230 → 2025-03: 0.004 |
| P2R2 | -0.126 | -0.90 | 2023-03: 0.493 → 2025-03: 0.241 |

**All four negative.** Sky fraction shrinking = canopy closing, which is *the*
restoration metric. Noisy (r as weak as -0.34) but the sign never flips.

This is the one to ship.

### Finding 3 — greenness trends are measuring weeding, not growth

Same March-only fit, `gcc_lower` / `veg_lower`:

- P1R1: r = **-0.75** (strong decline)
- P1R2: r = -0.18
- P2R1: r = **+0.14** (no trend)
- P2R2: r = +0.51

Signs disagree across sites. Looking at the images explains it: P1R1 2021-12 is
dense green groundcover, 2022-03 is **bare soil with cut stumps**. That's a
weeding event, not drought and not vegetation loss.

**A naive greenness dashboard would show these restoration sites "losing
vegetation" in exactly the years they were best maintained.** Worth flagging
loudly to whoever asks for a greenness chart.

(Bare-soil fraction in March is genuinely interesting *as a management
indicator* — just don't call it vegetation.)

### Finding 4 — the real blocker is framing drift, not model choice

P2R1 sky_upper: 2024-03 = 0.292, 2025-03 = **0.004**. Canopy did not close 98%
in one year — the 2025 shot is a closeup with foliage overhead. Same story at
P1R1 2025-03 (leaves directly in front of the lens).

The DSLR archive has real framing drift between visits. Every metric above is
contaminated by it, and n=5–6 March images per site is nowhere near enough to
average it out.

**No model fixes this.** Segmentation would give cleaner class labels on a frame
that's pointed somewhere different.

### Finding 5 — the phone app already fixes this

J12R1: the 2025-09 and 2026-03 phone captures are near-registerable — same tree
stems, same slope, same distant ridgeline, same foreground fern. The ghost
overlay is doing its job.

So: **metrics are viable going forward, not retroactively.** The archive gives us
a feasibility read and a nice demo timelapse; it can't give us trustworthy
numbers. Framing discipline (ghost + `reference_heading`) is the highest-leverage
thing here and it's already built and shipping.

### Finding 6 — species ID is not practical, and that's an information limit

These are wide landscape frames. Individual plants are tens of pixels of
undifferentiated foliage — no flowers, no fruit, no leaf venation, no bark
detail. **A botanist couldn't ID most of this from these frames either.** It's
not a model problem, there isn't enough signal in the pixels.

Two better framings:

1. **You don't need to detect species — you have a planting list.** The saplings
   at these sites were planted from known stock. Identity comes from records.
   What vision can add is *survival* and *growth*, which the records don't have.
2. **The person is a free scale reference.** We don't care who they are, but
   they're a ~1.7 m ruler standing in the plot in every single frame. Person
   height in pixels → rough m/px at that depth → sapling height and canopy
   height estimates. That's more useful than any species model and it works on
   data we already have.

If someone still wants species: it needs close-up leaf/flower photos as a
*separate* capture type, not the framing shot. That's a phone-app feature
request, not an ML project.

### Script

`feat.py` — pure numpy/PIL, no dependencies beyond what's already installed.
Currently in scratchpad; move to `good-shepherd/notebooks/` if we keep it.

## Registration / alignment — the design we landed on

### It's the ghost overlay, moved to analysis time

The ghost overlay already solves this problem at **capture** time: show the
reference image semi-transparent over the viewfinder, human lines the two up by
eye. Registration is the same idea at **analysis** time — an algorithm lines
them up after the fact.

| | ghost overlay | homography registration |
|---|---|---|
| when | capture time | analysis time |
| who aligns | the human, by eye | RANSAC, automatically |
| works on old images | no | yes |
| precision | ±few degrees (eyeballed) | sub-pixel where it converges |
| can fail silently | yes (nobody checks) | no — emits a quality score |

Two things follow that are easy to miss:

1. **Registration is not only for the archive.** Eyeball alignment isn't
   pixel-perfect, and the metrics are sensitive enough to care. Registration is
   a useful *refinement* on top of ghost-aligned phone captures too.
2. **The ghost overlay is still the better fix**, because prevention beats
   repair and it costs nothing at analysis time. Registration is what we do for
   the 2019–2025 DSLR archive, which can't be recaptured.

### How keypoints actually get detected

**Fully automatic. Nobody annotates anything, including on the reference image.**

ORB / SIFT don't look for "things you care about". They scan for small patches
that are *distinctive* (locally unique) and *repeatable* (findable again under
rotation, scale, and brightness change). Corners, blobs, high-contrast
junctions. Each gets a descriptor vector, and matching is nearest-neighbour
between the two images' descriptors.

In our frames specifically:

| detects well | detects badly |
|---|---|
| tree trunk edges against sky | foliage — self-similar, moves in wind |
| the distant ridgeline silhouette | open sky — no texture at all |
| rocks, stumps, cut branches | uniform grass |
| branch junctions, forks | anything in deep shadow |

That distribution is *favourable* for us: the good keypoints land on the
structural background — trunks, ridgeline, rocks — which is exactly the part
that doesn't change year to year. The part that does change (understory,
foliage) generates few reliable keypoints anyway, so it mostly doesn't fight the
fit.

### Two masks worth applying before matching

- **The person.** They move between visits, so every keypoint on them is a
  guaranteed bad match. RANSAC will reject them, but masking is cheaper and
  more stable. They're reliably centre-frame; a person detector or a simple
  centre-box mask both work.
- **The near foreground.** Highest parallax, worst matches. Bottom ~15% of the
  frame is usually safe to drop.

### `reference_heading` is a free hint

`sites.json` carries `reference_heading` on some sites (e.g. `2024_J12_R1`:
166.9°, `2019_LA_R1`: -169.5°), and sessions carry `heading`. Where both exist,
the difference tells us roughly how far the camera rotated — useful to seed the
search or to sanity-check a homography that RANSAC claims is good. Null on
plenty of sites, so treat it as a bonus, not a dependency.

### What to build

Per site:

1. Pick the reference frame (site's `reference_portrait`, or earliest good visit)
2. For each other visit: detect → match → RANSAC homography → warp into
   reference coordinates
3. Emit the matrix **plus an alignment score** (inlier count, inlier ratio,
   reprojection error)
4. Compute sky / canopy / ground fractions over a **fixed ROI in reference
   coordinates** — same patch of the world every year
5. **Gate on the score.** Frames that don't register get flagged and excluded
   from trends, not silently averaged in

Step 5 is the point. Today P2R1's 2025-03 closeup drags sky fraction to 0.004
and nobody notices. With a gate it gets flagged as unregisterable and dropped.

### Expected failure modes

- **Long gaps may simply not match.** Six years of growth changes the scene
  that's supposed to be the stable reference. Mitigation: chain consecutive
  visits (2019→2020→2021…) and compose the matrices, rather than matching
  everything to one reference.
- **Parallax is a hard limit.** If someone stood 2m left, no homography fixes
  it — near foliage and far ridge shift by different amounts. Homography
  assumes rotation-only or a flat scene; ours is neither, so it's an
  approximation that degrades with translation.
- **Season hurts matching** (bare March ground vs green September). Prefer
  same-season pairs when chaining.

Realistic expectation: works on adjacent same-season pairs, degrades over long
gaps. That's still a large win, because chaining turns long gaps into short
ones — and the score tells us which links held.

### Then, and only then, segmentation

Once frames are aligned, swapping the crude sky heuristic for SegFormer/ADE20K
gives proper `sky` / `tree` / `grass` / `earth` classes. Do it in that order.
Clean class labels on a misaligned frame are still misaligned — the ordering
matters more than either piece.

## How to test — cheapest first

### Test 0 — segmentation sanity check (~30 min, no infra)

`good-shepherd/notebooks/` already exists, do it there.

1. Pull ~50 images from **one** site spanning multiple seasons, via
   `/api/sessions/{org}` (filter `isDeleted`, take portrait only — see
   [`integration_brief.md`](integration_brief.md))
2. Run the SegFormer snippet above over them
3. Dump `siteId, timestamp, skyFrac, grassFrac, treeFrac` to CSV
4. Plot `grassFrac` vs month

**If that curve looks like a growing season, the approach works.** If it's
noise, stop — no amount of Immich fixes it.

### Test 1 — GCC comparison (same sitting)

Compute GCC over the same 50 images, plot alongside `grassFrac`. Whichever is
less noisy across seasons wins. My bet is GCC, because it has no model to be
wrong.

### Test 2 — backfill (only if 0 or 1 works)

Batch over all sessions, write `features` into the session JSON (or a sidecar
keyed by `sessionId`), expose it through `/api/sessions`. The dashboard's SQL
panel picks it up with zero frontend changes.

### Test 3 — CLIP, separately (only if we want fuzzy retrieval)

Stand up Immich via option A in [`storage_immich.md`](storage_immich.md), let
smart search index, then try both kinds of query:

- `"grassland"` / `"canopy gap"` / `"standing water"` → expect useful results
- `"more than 30% sky"` → expect garbage

That contrast is the whole point of the test. Run it so nobody has to take my
word for it.

## Recommendation (updated after running the numbers)

1. **Ship canopy/sky fraction, not greenness.** It's the only metric whose sign
   held across all four sites, and it's the one that means something
   ecologically.
2. **Never trend across mixed months.** Store month on the record and compare
   March-to-March. A mixed-season trend line measures rainfall.
3. **Don't ship a "greenness over time" chart** without a weeding caveat — it
   will show well-maintained sites losing vegetation.
4. **Fix framing before fixing models.** Highest-leverage item, already built
   (ghost overlay + `reference_heading`). Enforce it and the metrics get
   trustworthy without any ML.
5. **Two things worth actual model work, in order:**
   - **Homography registration** to each site's reference frame (ORB/SIFT via
     opencv, no GPU). Aligns each visit to a fixed ROI, which retroactively
     rescues the DSLR archive and permanently kills the framing-drift noise.
     Biggest accuracy win available.
   - **SegFormer/ADE20K** to replace the crude sky heuristic and split
     tree-canopy from sky properly. Needs torch (~1 GB). Do it after
     registration, not before — clean labels on a misaligned frame are still
     misaligned.
6. **Skip species ID.** Use the planting list for identity; use person-as-ruler
   for height. Revisit only if a close-up capture mode gets added to the phone
   app.
7. Treat CLIP/Immich as a *separate* question about fuzzy archive retrieval, not
   as a route to these queries. It will not get us there.

## Status / handoff

Nothing here is implemented. Current state:

- `feat.py` (scratchpad) — the numpy/PIL feature pass that produced the RESULTS
  section. Reproducible, no dependencies to install.
- Registration is **designed, not built**. No opencv code exists yet.
- Segmentation is **not started** and shouldn't be until registration works.

Decisions still open, in rough priority order:

1. Is the archive worth rescuing at all, or do we accept that trustworthy
   numbers start from the phone-capture era (2025-09 onward) and treat
   2019–2025 as demo-only? Registration is only worth building if the answer is
   "rescue it".
2. Only **4 of 27 sites** have real time depth (`2019_LA_R1` 12 visits,
   `2019_LA_R2` 11, `2019_SM_R1` 11, `2019_SM_R2` 6). Everything else is 1–3
   visits. Does a metrics feature that works on 4 sites justify itself yet, or
   do we wait for more repeat visits?
3. Where do computed features live — written back into the session JSON, or a
   sidecar keyed by `sessionId`? Session JSON is simpler and rides the existing
   API for free; a sidecar avoids rewriting data the phone app owns.
4. Chained vs all-to-reference registration. Chaining is more robust over long
   gaps but accumulates drift.

## Sources

- https://huggingface.co/immich-app (Immich's ONNX CLIP models)
- https://docs.immich.app/administration/system-settings/
- https://github.com/immich-app/immich/discussions/11862 (choosing a CLIP model)
- https://github.com/immich-app/immich/issues/23883 (smart search pagination cap)
- https://huggingface.co/nvidia/segformer-b0-finetuned-ade-512-512
