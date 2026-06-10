import { beforeEach, describe, expect, it, vi } from "vitest";

describe("J-Quants client", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.JQUANTS_API_KEY = "test-key";
  });

  it("follows options pagination and filters by underlying symbol", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              Code: "313042914",
              UndSSO: "2914",
              Date: "2025-12-01",
            },
            {
              Code: "999999999",
              UndSSO: "9999",
              Date: "2025-12-01",
            },
          ],
          pagination_key: "next-page",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              Code: "313052914",
              UndSSO: "2914",
              Date: "2025-12-01",
            },
          ],
        }),
      });

    vi.stubGlobal("fetch", fetchMock);

    const { fetchJQuantsOptions } = await import("./jquants.js");
    const response = await fetchJQuantsOptions({
      symbol: "2914",
      date: "2025-12-01",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(response.contracts).toEqual([
      {
        Code: "313042914",
        UndSSO: "2914",
        Date: "2025-12-01",
      },
      {
        Code: "313052914",
        UndSSO: "2914",
        Date: "2025-12-01",
      },
    ]);
  });
});
