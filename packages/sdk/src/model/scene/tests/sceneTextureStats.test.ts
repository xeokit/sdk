import {Scene} from "../Scene";


function imageData(width: number, height: number) {
  return {
    data: new Uint8Array(width * height * 4),
    width,
    height,
  };
}

describe("SceneTexture stats", () => {

  it("subtracts imageData texture bytes when a texture is destroyed", () => {
    const model = new Scene().createModel({id: "m"}).value!;
    const result = model.createTexture({
      id: "t",
      imageData: imageData(3, 2),
    });
    expect(result.ok).toBe(true);
    expect(model.stats.textureBytes).toBe(24);

    result.value!.destroy();

    expect(model.stats.numTextures).toBe(0);
    expect(model.stats.textureBytes).toBe(0);
  });

  it("subtracts decoded image texture bytes when a texture is destroyed", () => {
    const model = new Scene().createModel({id: "m"}).value!;
    const result = model.createTexture({
      id: "t",
      image: {width: 5, height: 4} as any,
    });
    expect(result.ok).toBe(true);
    expect(model.stats.textureBytes).toBe(80);

    result.value!.destroy();

    expect(model.stats.numTextures).toBe(0);
    expect(model.stats.textureBytes).toBe(0);
  });

  it("updates texture bytes and dimensions when imageData is replaced", () => {
    const model = new Scene().createModel({id: "m"}).value!;
    const texture = model.createTexture({
      id: "t",
      imageData: imageData(1, 1),
    }).value!;
    expect(model.stats.textureBytes).toBe(4);

    texture.imageData = imageData(2, 3);

    expect(model.stats.textureBytes).toBe(24);
    expect(texture.width).toBe(2);
    expect(texture.height).toBe(3);
    expect(texture.toParams().value!.width).toBe(2);
    expect(texture.toParams().value!.height).toBe(3);
    texture.destroy();
    expect(model.stats.textureBytes).toBe(0);
  });
});
