import {Scene} from "../Scene";
import {
  LinearFilter,
  LinearMipMapNearestFilter,
  NearestFilter,
} from "../../../base/constants";


describe("SceneTexture", () => {

  it("defaults magFilter to a magnification-safe filter", () => {
    const model = new Scene().createModel({id: "m"}).value!;

    const result = model.createTexture({id: "t", src: "texture.png"});

    expect(result.ok).toBe(true);
    const texture = result.value!;
    expect(texture.magFilter).toBe(LinearFilter);
    expect(texture.minFilter).toBe(LinearMipMapNearestFilter);
    expect(texture.toParams().value!.magFilter).toBe(LinearFilter);
  });

  it("preserves an explicit magFilter", () => {
    const model = new Scene().createModel({id: "m"}).value!;

    const result = model.createTexture({
      id: "t",
      src: "texture.png",
      magFilter: NearestFilter,
    });

    expect(result.ok).toBe(true);
    expect(result.value!.magFilter).toBe(NearestFilter);
  });
});
