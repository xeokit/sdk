# Earth Generator

Builds a streamable xeokit XGF Stream Earth dataset from Natural Earth 1:10m land, optional coastline data, and optional country boundary data.

## Requirements

- Node.js 18 or newer.
- The repo dependencies installed with `npm install` or `pnpm install`.

## Usage

```bash
npm run build
npm run build-earth -- --tile-degrees 10 --max-edge-angle 0.1 --water --coastlines --country-boundaries --country-regions --out ./dist/earth
npm run build-earth -- --no-land --country-boundaries --out ./dist/earth-country-boundaries
npm run build-earth -- --no-land --water --country-regions --country-boundaries --out ./dist/earth-country-regions
```

The tool downloads official Natural Earth ZIP archives into `./data/cache/` and extracts shapefiles into `./data/natural-earth/`. Existing cached files are reused unless `--force-download` is supplied.

Natural Earth data is public domain. See https://www.naturalearthdata.com/about/terms-of-use/ for attribution and terms.

## CLI Options

- `--out`: output directory, default `./dist/earth`
- `--force-download`: refresh cached Natural Earth ZIPs and extracted shapefiles
- `--no-land`: skip `ne_10m_land`, useful for generating an independent boundary overlay stream
- `--water`: include a tiled water polygon underlay
- `--country-regions`: include filled `ne_10m_admin_0_countries` meshes on the `countryRegions` ViewLayer, with deterministic per-country object IDs
- `--coastlines`: include `ne_10m_coastline`
- `--country-boundaries`: include `ne_10m_admin_0_boundary_lines_land` on the `countryBoundaries` ViewLayer
- `--ocean`: include a moderate-resolution ocean sphere
- `--tile-degrees`: geographic tile size, default `10`
- `--max-edge-angle`: maximum geodesic segment angle before densification, default `0.1`
- `--simplify`: reserved; currently only `0` is accepted
- `--earth-radius`: default `6371000`
- `--ocean-offset`: ocean radius offset from `--earth-radius`, default `-5000`
- `--land-offset`: default `1500`
- `--coastline-offset`: default `20`
- `--boundary-offset`: country boundary height above land, default `35`
- `--chunk-size`: target XGF Stream objects per chunk, default `500`
- `--verbose`: progress logging
- `--debug-geojson`: write tiled intermediate polygons to `debug/land.tiled.geojson`
- `--debug-obj`: write `debug/earth.obj`

## Output

```text
dist/earth/
  index.json
  index.runtime.json
  chunks/
    *.xgf
```

`index.json` is the author-readable XGF Stream index. `index.runtime.json` is the compact runtime index for `XGFViewStreamController`.

## Implementation Notes

Land polygons are clipped to deterministic longitude/latitude tiles before triangulation. Each source polygon is evaluated at longitude shifts `-360`, `0`, and `+360`, then intersected with each tile. This avoids interpreting antimeridian-wrapped geometry as a world-spanning polygon.

After clipping, every ring is densified on the sphere using great-circle interpolation. Triangulated land interiors are then tessellated on the sphere, using a coarser 2 degree minimum angular limit, so large Earcut triangles do not become visible chords through the ocean shell. The default `--max-edge-angle 0.1` keeps coastlines tight while the interior tessellation keeps filled land close enough to the globe surface without exploding triangle counts.

Triangulation uses `earcut` per clipped tile polygon in a local tile projection. Tile sizes are intentionally small by default, so projection distortion is bounded while holes from the clipped polygon are preserved.

Coordinates remain Earth-centered meters with an identity meter coordinate system. Land is placed at `earthRadius + landOffset`; coastline lines and country boundary lines are placed above land; the optional ocean sphere is placed at `earthRadius + oceanOffset`. The default ocean offset pulls the sea shell slightly inward to avoid z-fighting at globe scale without leaving a large visible coastline gap.

Land objects do not receive a `layerId`, so they enter each View's default ViewLayer. Country boundary objects are emitted with `layerId: "countryBoundaries"`, coastline objects with `layerId: "coastlines"`, and filled country-region meshes with `layerId: "countryRegions"`. Country map mode uses filled admin-0 country polygons above a continuous tiled water underlay. This avoids coastline cracks from subtractive water clipping while still giving spatially streamable water and country objects; country mode should be shown as an alternate map mode rather than drawn on top of the base physical land/water meshes.

## Viewer

Build the viewer bundle and serve the repo root with any static server:

```bash
npm run build-earth-viewer
../../node_modules/.bin/http-server . -p 8080
```

Open `http://localhost:8080/packages/website/tools/earth-generator/viewer/index.html`.

## Troubleshooting

- If download fails, verify network access to `naturalearth.s3.amazonaws.com`.
- If validation reports a long chord, reduce `--tile-degrees` or `--max-edge-angle`.
- If memory use is high, increase `--tile-degrees` only cautiously; smaller tiles keep objects localized and triangulation bounded.
- A global ocean object is simple and low density but not spatially chunked like land/coastline tiles.
