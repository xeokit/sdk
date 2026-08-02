# OSM Sample Input

Place the local Berlin OSM extract for the end-to-end demo here:

```text
packages/website/scripts/procedural-city/data/berlin-sample.osm.pbf
```

The generator and demo do not require network access. To rebuild the profile from
a local extract, run from `packages/website`:

```bash
npm run analyze-osm -- \
  --input ./scripts/procedural-city/data/berlin-sample.osm.pbf \
  --output ./scripts/procedural-city/profiles/berlin-inner-city.json \
  --name berlin-inner-city \
  --description "Berlin inner-city OSM-derived procedural profile"
```

`.osm.pbf` input requires `osmium` on the PATH. `.geojson`, `.json`, `.osm`, and
`.xml` inputs are read directly.
