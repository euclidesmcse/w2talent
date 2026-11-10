import { isValidCelularBR, normalizeCelular } from "../lib/celular";

describe("celular BR (E.164)", () => {
  it("normaliza e valida", () => {
    expect(isValidCelularBR("+5511999999999")).toBe(true);
    expect(isValidCelularBR("+5521999999999")).toBe(true);
    expect(isValidCelularBR("11999999999")).toBe(true);
    expect(normalizeCelular("11999999999")).toBe("+5511999999999");
    expect(isValidCelularBR("123")).toBe(false);
    expect(isValidCelularBR("+1 555 123")).toBe(false);
  });
});
