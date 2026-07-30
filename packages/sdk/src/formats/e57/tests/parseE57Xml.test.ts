import {parseE57Xml} from "../parser/parseE57Xml";
import {installE57TestGlobals} from "./installE57TestGlobals";

let restoreGlobals: (() => void) | null = null;

beforeAll(async () => {
  restoreGlobals = await installE57TestGlobals();
});

afterAll(() => {
  restoreGlobals?.();
});

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<e57Root type="Structure" xmlns="http://www.astm.org/COMMIT/E57/2010-e57-v1.0">
  <data3D type="Vector" allowHeterogeneousChildren="1">
    <vectorChild type="Structure">
      <guid type="String"><![CDATA[{abc}]]></guid>
      <name type="String"><![CDATA[Scan 1]]></name>
      <pose type="Structure">
        <rotation type="Structure">
          <w type="Float">1</w><x type="Float">0</x><y type="Float">0</y><z type="Float">0</z>
        </rotation>
        <translation type="Structure">
          <x type="Float">10.5</x><y type="Float">-2</y><z type="Float">3</z>
        </translation>
      </pose>
      <cartesianBounds type="Structure">
        <xMinimum type="Float">-1</xMinimum><xMaximum type="Float">1</xMaximum>
        <yMinimum type="Float">-2</yMinimum><yMaximum type="Float">2</yMaximum>
        <zMinimum type="Float">-3</zMinimum><zMaximum type="Float">3</zMaximum>
      </cartesianBounds>
      <points type="CompressedVector" fileOffset="48" recordCount="7">
        <prototype type="Structure">
          <cartesianX type="Float" precision="single" minimum="-1" maximum="1"/>
          <cartesianY type="ScaledInteger" minimum="-100" maximum="100" scale="0.01" offset="5"/>
          <colorRed type="Integer" minimum="0" maximum="255"/>
        </prototype>
      </points>
    </vectorChild>
  </data3D>
</e57Root>`;

describe("parseE57Xml", () => {

  it("parses a scan's descriptor, prototype, pose and bounds", () => {
    const doc = parseE57Xml(XML);
    expect(doc.pointClouds).toHaveLength(1);
    const pc = doc.pointClouds[0];

    expect(pc.name).toBe("Scan 1");
    expect(pc.recordCount).toBe(7);
    expect(pc.pointsFileOffset).toBe(48);

    expect(pc.prototype.map(f => f.name)).toEqual(["cartesianX", "cartesianY", "colorRed"]);
    const [x, y, r] = pc.prototype;
    expect(x).toMatchObject({type: "Float", precision: "single"});
    expect(y).toMatchObject({type: "ScaledInteger", minimum: -100, maximum: 100, scale: 0.01, offset: 5});
    expect(r).toMatchObject({type: "Integer", minimum: 0, maximum: 255, scale: 1, offset: 0});

    expect(pc.pose?.rotation).toEqual([1, 0, 0, 0]);
    expect(pc.pose?.translation).toEqual([10.5, -2, 3]);
    expect(pc.cartesianBounds).toMatchObject({xMinimum: -1, xMaximum: 1, zMaximum: 3});
  });

  it("throws on a non-e57Root document", () => {
    expect(() => parseE57Xml(`<notE57/>`)).toThrow(/e57Root/);
  });
});
